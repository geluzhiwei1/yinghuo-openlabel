"""Stage 8 /me 服务。

profile 编辑、改密码、preferences 增量。preferences / avatar / note 存 Mongo
`user_profile` collection(按 user_id 主键)。改密码成功后写 User.password_changed_at
并标记 Redis 强制该用户 access token 下次校验失败(由 JWT 中间件比对时间戳实现)。
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field
from redis import asyncio as aioredis
from tortoise.expressions import Q

from ...config import Conf, settings
from ...log import logger
from ...utils.password import get_password_hash, verify_password
from ..db.models import OrgMembership, Role, User, UserRole
from ..db.collection import UserProfile
from .audit import audit_service
from .user import user_service


class MeError(Exception):
    """profile / 改密码错误。"""


class ProfileUpdateIn(BaseModel):
    avatar: Optional[str] = Field(None, max_length=512)
    note: Optional[str] = Field(None, max_length=2048)


class PasswordChangeIn(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1)


class PreferencesPatchIn(BaseModel):
    """增量合并。允许任意 key-value,前端约定语义。"""
    class Config:
        extra = "allow"


class MeService:

    async def get_profile(self, *, user_id: int) -> dict:
        user = await User.filter(id=user_id).first()
        if user is None:
            raise MeError(f"用户 {user_id} 不存在")
        profile = await self._load_profile(user_id)

        role_rows = await UserRole.filter(user_id=user_id).values("role_id", "tenant_id")
        role_ids = [r["role_id"] for r in role_rows if r["role_id"] is not None]
        roles = []
        if role_ids:
            role_objs = await Role.filter(id__in=role_ids)
            for r in role_objs:
                roles.append({"id": r.id, "name": r.name, "scope": r.scope})

        orgs = await OrgMembership.filter(user_id=user_id).values("org_unit_id", "role")

        return {
            "id": user.id,
            "email": user.email,
            "mobile_phone_no": user.mobile_phone_no,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "last_login": user.last_login,
            "password_changed_at": user.password_changed_at,
            "avatar": profile.get("avatar"),
            "note": profile.get("note"),
            "preferences": profile.get("preferences") or {},
            "roles": roles,
            "orgs": orgs,
        }

    async def update_profile(
        self, *, user_id: int, payload: ProfileUpdateIn,
    ) -> dict:
        fields = payload.model_dump(exclude_unset=True)
        if not fields:
            raise MeError("未提供更新字段")
        await self._patch_profile(user_id, fields)
        return await self.get_profile(user_id=user_id)

    async def change_password(
        self, *, user_id: int, payload: PasswordChangeIn,
        redis: Optional[aioredis.Redis] = None,
    ) -> None:
        user = await User.filter(id=user_id).first()
        if user is None:
            raise MeError(f"用户 {user_id} 不存在")
        if not user.password or not verify_password(payload.old_password, user.password):
            raise MeError("旧密码错误")
        if payload.new_password == payload.old_password:
            raise MeError("新密码不能与旧密码相同")
        if len(payload.new_password) < settings.PASSWORD_MIN_LENGTH:
            raise MeError(
                f"新密码长度不足,至少 {settings.PASSWORD_MIN_LENGTH} 位"
            )
        if settings.PASSWORD_REQUIRE_LETTER_AND_DIGIT:
            has_letter = any(c.isalpha() for c in payload.new_password)
            has_digit = any(c.isdigit() for c in payload.new_password)
            if not (has_letter and has_digit):
                raise MeError("新密码必须同时包含字母和数字")

        user.password = get_password_hash(payload.new_password)
        user.password_changed_at = datetime.utcnow()
        await user.save(update_fields=["password", "password_changed_at", "updated_at"])

        # tenant_id 从 CTX 拿,通知合成按 tenant 过滤
        from ...apps.ctx import get_current_tenant_id
        await audit_service.log(
            action="user.password_change",
            actor_id=user_id, tenant_id=get_current_tenant_id(),
            resource_type="user", resource_id=str(user.id),
        )

    async def get_preferences(self, *, user_id: int) -> dict:
        profile = await self._load_profile(user_id)
        return profile.get("preferences") or {}

    async def update_preferences(
        self, *, user_id: int, patch: dict,
    ) -> dict:
        profile = await self._load_profile(user_id)
        merged = dict(profile.get("preferences") or {})
        merged.update(patch)
        await self._patch_profile(user_id, {"preferences": merged})
        return merged

    # ===== Mongo helpers =====

    def _find_profile_sync(self, user_id: int) -> dict:
        doc = Conf.MG_USER_PROFILE.find_one({"user_id": user_id})
        return doc or {}

    def _upsert_profile_sync(self, user_id: int, set_fields: dict) -> dict:
        """upsert:set 已有文档的指定字段,否则插入新文档。"""
        now = datetime.utcnow()
        update = {
            "$set": {
                **set_fields,
                "user_id": user_id,
                "updated_time": now,
            },
            "$setOnInsert": {
                "created_time": now,
            },
        }
        Conf.MG_USER_PROFILE.update_one(
            {"user_id": user_id}, update, upsert=True,
        )
        return self._find_profile_sync(user_id)

    async def _load_profile(self, user_id: int) -> dict:
        return await asyncio.to_thread(self._find_profile_sync, user_id)

    async def _patch_profile(self, user_id: int, fields: dict) -> None:
        await asyncio.to_thread(self._upsert_profile_sync, user_id, fields)


me_service = MeService()
