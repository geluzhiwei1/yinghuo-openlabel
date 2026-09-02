"""Stage 8 导出服务(OpenLABEL)。

把 WorkflowInstance.status=approved 的 Unit 集合导出为 OpenLABEL dict。
按 (seq, stream) 分组,frame 索引做 key,objects 从 unit_label 最新版拉取。
同步返回,上限 1000 个 unit(超过返 ExportError → 400 提示分批)。
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from pydantic import BaseModel, Field

from ...apps.ctx import get_current_tenant_id
from ...config import Conf
from ..db.models import Unit, WorkflowInstance


MAX_UNITS_PER_EXPORT = 1000


class ExportError(Exception):
    pass


class ExportIn(BaseModel):
    project_id: int
    batch_ids: Optional[list[int]] = None
    mission: Optional[str] = Field(None, max_length=64)
    only_approved: bool = True


class ExportService:

    async def export_units_to_openlabel(self, payload: ExportIn) -> dict:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise ExportError("当前会话未绑定租户")

        # 1. WorkflowInstance approved 列表
        inst_qs = WorkflowInstance.filter(
            tenant_id=tenant_id,
            project_id=payload.project_id,
        )
        if payload.only_approved:
            inst_qs = inst_qs.filter(current_status="approved")
        instances = await inst_qs

        if not instances:
            return self._empty_result(payload.project_id)

        unit_ids = [i.unit_id for i in instances]
        unit_qs = Unit.filter(tenant_id=tenant_id, id__in=unit_ids)
        if payload.mission:
            unit_qs = unit_qs.filter(mission=payload.mission)
        if payload.batch_ids:
            unit_qs = unit_qs.filter(batch_id__in=payload.batch_ids)
        units = await unit_qs
        if len(units) > MAX_UNITS_PER_EXPORT:
            raise ExportError(
                f"导出超限:{len(units)} > {MAX_UNITS_PER_EXPORT},请按 batch 分批"
            )

        if not units:
            return self._empty_result(payload.project_id)

        # 2. 拉 unit_label 最新版本
        unit_by_id = {u.id: u for u in units}
        labels = await self._fetch_latest_labels(tenant_id, list(unit_by_id.keys()))

        # 3. 按 (seq, stream) 分组组装 OpenLABEL frames
        groups: dict[tuple[str, str], dict[int, dict]] = {}
        for u in units:
            key = (u.seq, u.stream)
            grp = groups.setdefault(key, {})
            label_doc = labels.get(u.id, {})
            grp[u.frame] = {
                "frame_properties": {
                    "timestamp": u.frame,
                    "mission": u.mission,
                    "unit_id": u.id,
                    "batch_id": u.batch_id,
                },
                "objects": self._objects_to_openlabel(label_doc.get("objects") or []),
            }

        # 4. 包装为 OpenLABEL
        return {
            "openlabel": {
                "metadata": {
                    "schema_version": "1.0.0",
                    "project_id": payload.project_id,
                    "tenant_id": tenant_id,
                    "exported_at": datetime.utcnow().isoformat(),
                    "unit_count": len(units),
                    "only_approved": payload.only_approved,
                },
                "streams": {
                    f"{seq}|{stream}": {"uri": f"{seq}/{stream}"}
                    for (seq, stream) in groups.keys()
                },
                "frames": {
                    f"{seq}|{stream}|{frame_idx}": frame_data
                    for (seq, stream), frames in groups.items()
                    for frame_idx, frame_data in frames.items()
                },
            }
        }

    def _empty_result(self, project_id: int) -> dict:
        return {
            "openlabel": {
                "metadata": {
                    "schema_version": "1.0.0",
                    "project_id": project_id,
                    "exported_at": datetime.utcnow().isoformat(),
                    "unit_count": 0,
                    "note": "无可导出的 Unit(可能未审核完成)",
                },
                "streams": {},
                "frames": {},
            }
        }

    def _objects_to_openlabel(self, objects: list[dict]) -> dict:
        out: dict[str, dict] = {}
        for obj in objects:
            oid = obj.get("id")
            if not oid:
                continue
            # mission 特定字段(bbox / poly2d / cuboid 等)透传到 object_data
            object_data = {k: v for k, v in obj.items() if k != "id"}
            out[str(oid)] = {
                "object_data": object_data,
                "name": obj.get("name", str(oid)),
            }
        return out

    def _fetch_latest_labels_sync(
        self, tenant_id: str, unit_ids: list[int],
    ) -> dict[int, dict]:
        """每个 unit 取 version 最大的文档。"""
        if not unit_ids:
            return {}
        cursor = Conf.MG_UNIT_LABEL.aggregate([
            {"$match": {
                "tenant_id": tenant_id,
                "unit_id": {"$in": unit_ids},
            }},
            {"$sort": {"unit_id": 1, "version": -1}},
            {"$group": {
                "_id": "$unit_id",
                "doc": {"$first": "$$ROOT"},
            }},
        ])
        out: dict[int, dict] = {}
        for entry in cursor:
            doc = entry.get("doc") or {}
            uid = doc.get("unit_id")
            if uid is not None:
                out[int(uid)] = doc
        return out

    async def _fetch_latest_labels(
        self, tenant_id: str, unit_ids: list[int],
    ) -> dict[int, dict]:
        return await asyncio.to_thread(
            self._fetch_latest_labels_sync, tenant_id, unit_ids,
        )


export_service = ExportService()
