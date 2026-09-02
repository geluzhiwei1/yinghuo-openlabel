"""Unit 标签服务(Stage 6)。

老 `label_app` 走 `MG_COLLECTION[mission]` 集合 + AnnoJob 状态机,字段散乱无 tenant/
乐观锁。Stage 6 起开新集合 `unit_label`,承载 WorkflowInstance 推动下的版本化写入:

- 一条文档 = 一个 unit 的一个版本(label 快照)
- `_id` 由 (tenant_id, unit_id, version) 唯一索引保证幂等
- 写入用 find_one_and_update + expected_version 过滤,冲突即 409
- 不动老路径,迁移留到后续阶段

pymongo 是同步客户端,异步路径用 asyncio.to_thread 包装。文档结构对齐
mongo_base.TenantScopedBase,以 mission 决定 objects 形态。
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from ...apps.ctx import get_current_tenant_id
from ...config import Conf
from ...log import logger
from ..db.mongo_base import LabelPayload


class LabelConflict(Exception):
    """乐观锁冲突。expected_version 不匹配或并发覆盖。"""

    def __init__(self, expected: int, actual: Optional[int]):
        self.expected = expected
        self.actual = actual
        super().__init__(
            f"label version conflict: expected={expected} actual={actual}"
        )


class LabelNotFound(Exception):
    pass


class LabelSaveIn(BaseModel):
    """save_label 入参。objects 走 LabelPayload(extra=allow),
    允许 mission 特定字段透传。
    """
    objects: list[dict] = Field(default_factory=list)
    attrs: dict[str, Any] = Field(default_factory=dict)

    class Config:
        extra = "allow"


class LabelRecord(BaseModel):
    """对外暴露的 label 记录(扁平化)。"""
    id: str
    tenant_id: str
    unit_id: int
    project_id: int
    mission: str
    version: int
    objects: list[dict] = Field(default_factory=list)
    attrs: dict[str, Any] = Field(default_factory=dict)
    creator: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

    class Config:
        extra = "allow"


class LabelService:
    """标签读写。所有方法假设 tenant_id 已通过 CTX 注入。"""

    @property
    def _coll(self):
        return Conf.MG_UNIT_LABEL

    async def save_label(
        self,
        *,
        unit_id: int,
        project_id: int,
        mission: str,
        payload: LabelSaveIn,
        expected_version: int,
        actor_id: Optional[int] = None,
    ) -> LabelRecord:
        """乐观锁写入。

        expected_version=0 表示首次创建,要求该 unit 还没有 label;
        expected_version>=1 表示基于 N 版本的更新,新文档 version=N+1。
        冲突(LabelConflict)由调用方决定 409 / 重试。
        """
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise ValueError("当前会话未绑定租户")

        # 简单校验:objects 内必须带 id,便于 diff
        objects = list(payload.objects)
        for i, obj in enumerate(objects):
            if "id" not in obj:
                raise ValueError(f"objects[{i}] 缺少 id 字段,无法做版本 diff")

        now = datetime.utcnow()
        new_version = expected_version + 1

        # 用 LabelPayload 收拢 mission 无关字段,extra=allow 透传其余
        normalized = LabelPayload(
            objects=objects,
            attrs=dict(payload.attrs),
        ).model_dump(mode="json")

        doc = {
            "tenant_id": tenant_id,
            "unit_id": unit_id,
            "project_id": project_id,
            "mission": mission,
            "version": new_version,
            "creator": actor_id,
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
            "objects": normalized["objects"],
            "attrs": normalized["attrs"],
        }

        def _upsert():
            coll = self._coll
            cur = coll.find_one(
                {"tenant_id": tenant_id, "unit_id": unit_id},
                {"version": 1},
                sort=[("version", -1)],
            )
            cur_version = cur.get("version") if cur else None

            # 期望前版本不匹配 → 冲突(并发或客户端基于旧版本)
            if expected_version == 0:
                if cur_version is not None:
                    raise LabelConflict(expected=0, actual=cur_version)
            else:
                if cur_version != expected_version:
                    raise LabelConflict(expected=expected_version, actual=cur_version)

            # 通过唯一索引 (tenant_id, unit_id, version) 兜底并发;
            # 正常路径下 cur_version 校验已挡住绝大多数情况。
            try:
                coll.insert_one(doc)
            except Exception as e:  # noqa: BLE001
                raise LabelConflict(expected=expected_version, actual=cur_version) from e
            return doc

        saved = await asyncio.to_thread(_upsert)
        logger.info(
            f"label saved: tenant={tenant_id} unit={unit_id} v{saved.get('version')} "
            f"by actor={actor_id}"
        )
        return self._wrap(saved)

    async def get_label(
        self, *, unit_id: int, version: Optional[int] = None,
    ) -> LabelRecord:
        """读取最新或指定版本。"""
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise ValueError("当前会话未绑定租户")

        query: dict[str, Any] = {"tenant_id": tenant_id, "unit_id": unit_id}
        if version is not None:
            query["version"] = version

        def _find():
            return self._coll.find_one(query, sort=[("version", -1)])

        doc = await asyncio.to_thread(_find)
        if doc is None:
            raise LabelNotFound(
                f"label not found: unit={unit_id} version={version or 'latest'}"
            )
        return self._wrap(doc)

    async def list_versions(self, *, unit_id: int) -> list[dict]:
        """版本元信息列表,按版本倒序。仅返回 version/creator/created_at。"""
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise ValueError("当前会话未绑定租户")

        def _list():
            return list(
                self._coll.find(
                    {"tenant_id": tenant_id, "unit_id": unit_id},
                    {"version": 1, "creator": 1, "created_at": 1, "updated_at": 1},
                ).sort("version", -1)
            )

        docs = await asyncio.to_thread(_list)
        return [
            {
                "version": d.get("version"),
                "creator": d.get("creator"),
                "created_at": d.get("created_at"),
                "updated_at": d.get("updated_at"),
            }
            for d in docs
        ]

    async def diff(
        self, *, unit_id: int, from_version: int, to_version: int,
    ) -> dict:
        """计算 added/modified/removed,按 object id 对齐。"""
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise ValueError("当前会话未绑定租户")
        if from_version == to_version:
            return {
                "unit_id": unit_id,
                "from_version": from_version,
                "to_version": to_version,
                "added": [], "modified": [], "removed": [],
            }

        def _get(v: int):
            return self._coll.find_one(
                {"tenant_id": tenant_id, "unit_id": unit_id, "version": v},
            )

        frm, to = await asyncio.gather(
            asyncio.to_thread(_get, from_version),
            asyncio.to_thread(_get, to_version),
        )
        if frm is None or to is None:
            missing = from_version if frm is None else to_version
            raise LabelNotFound(f"version {missing} not found for unit={unit_id}")

        from_objs = {o.get("id"): o for o in (frm.get("objects") or [])}
        to_objs = {o.get("id"): o for o in (to.get("objects") or [])}

        added = [o for k, o in to_objs.items() if k not in from_objs]
        removed = [o for k, o in from_objs.items() if k not in to_objs]
        modified = [
            {"id": k, "from": from_objs[k], "to": to_objs[k]}
            for k in to_objs
            if k in from_objs and from_objs[k] != to_objs[k]
        ]
        return {
            "unit_id": unit_id,
            "from_version": from_version,
            "to_version": to_version,
            "added": added,
            "modified": modified,
            "removed": removed,
        }

    def _wrap(self, doc: dict) -> LabelRecord:
        return LabelRecord(
            id=str(doc.get("_id")),
            tenant_id=doc["tenant_id"],
            unit_id=doc["unit_id"],
            project_id=doc.get("project_id"),
            mission=doc.get("mission"),
            version=doc.get("version", 0),
            objects=doc.get("objects") or [],
            attrs=doc.get("attrs") or {},
            creator=doc.get("creator"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
            is_deleted=doc.get("is_deleted", False),
            **{k: v for k, v in doc.items()
               if k not in {"_id", "tenant_id", "unit_id", "project_id", "mission",
                            "version", "objects", "attrs", "creator",
                            "created_at", "updated_at", "is_deleted"}},
        )


label_service = LabelService()
