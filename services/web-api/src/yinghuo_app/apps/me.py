"""Stage 8 /me 路由。

挂载:main app,前缀 /api/v1/b/me。
所有路由依赖 business:self:read|write(每个登录用户都有)。
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from redis import asyncio as aioredis

from ..apps.ctx import CTX_USER_ID, get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.services.me import (
    MeError,
    MeService,
    PasswordChangeIn,
    PreferencesPatchIn,
    ProfileUpdateIn,
    me_service,
)
from ..redis_conf import init_redis_pool

router = APIRouter()


class PreferencesBody(BaseModel):
    class Config:
        extra = "allow"


def _user_id_or_401() -> int:
    uid = CTX_USER_ID.get()
    if not uid:
        raise HTTPException(status_code=401, detail="未登录")
    return uid


@router.get(
    "",
    summary="当前用户 profile",
    dependencies=[permission_required("business:self:read")],
)
async def get_me():
    uid = _user_id_or_401()
    try:
        return await me_service.get_profile(user_id=uid)
    except MeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "",
    summary="编辑 profile(avatar/note)",
    dependencies=[permission_required("business:self:write")],
)
async def update_me(payload: ProfileUpdateIn):
    uid = _user_id_or_401()
    try:
        return await me_service.update_profile(user_id=uid, payload=payload)
    except MeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/password",
    summary="改密码",
    dependencies=[permission_required("business:self:write")],
)
async def change_password(
    payload: PasswordChangeIn,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    uid = _user_id_or_401()
    try:
        await me_service.change_password(
            user_id=uid, payload=payload, redis=redis,
        )
    except MeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"statusText": "密码已更新"}


@router.get(
    "/preferences",
    summary="通知 / UI 偏好",
    dependencies=[permission_required("business:self:read")],
)
async def get_preferences():
    uid = _user_id_or_401()
    return await me_service.get_preferences(user_id=uid)


@router.patch(
    "/preferences",
    summary="增量合并偏好",
    dependencies=[permission_required("business:self:write")],
)
async def patch_preferences(payload: PreferencesBody):
    uid = _user_id_or_401()
    patch = dict(payload.model_dump())
    return await me_service.update_preferences(user_id=uid, patch=patch)


# ===== /me/notifications(在此 router 内嵌) =====

from ..biz.services.notification import NotificationError, notification_service


@router.get(
    "/notifications",
    summary="我的通知列表(从 AuditLog 合成)",
    dependencies=[permission_required("business:self:read")],
)
async def list_notifications(
    unread_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    uid = _user_id_or_401()
    tenant_id = get_current_tenant_id()
    try:
        return await notification_service.list_for_user(
            user_id=uid, tenant_id=tenant_id,
            unread_only=unread_only,
            page=page, page_size=page_size,
            redis=redis,
        )
    except NotificationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/notifications/unread_count",
    summary="未读通知数",
    dependencies=[permission_required("business:self:read")],
)
async def unread_count(
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    uid = _user_id_or_401()
    tenant_id = get_current_tenant_id()
    count = await notification_service.unread_count(
        user_id=uid, tenant_id=tenant_id, redis=redis,
    )
    return {"unread_count": count}


@router.post(
    "/notifications/{audit_id}/read",
    summary="标记通知已读",
    dependencies=[permission_required("business:self:write")],
)
async def mark_notification_read(
    audit_id: int,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    uid = _user_id_or_401()
    await notification_service.mark_read(user_id=uid, audit_id=audit_id, redis=redis)
    return {"statusText": "已标记已读"}
