"""Stage 6 unit 标签路由 /labels。

挂载:main app,前缀 /api/v1/b/labels。
权限:business:label:read|write。submit 联动走 business:review:approve|reject
(由 engine 按 stage.kind 二次校验)。

写入路径:
- POST /labels/units/{unit_id}         仅保存,version+1,不动工作流
- POST /labels/units/{unit_id}/submit  保存 + workflow_engine.submit(approved)

读取路径:
- GET  /labels/units/{unit_id}                最新版本
- GET  /labels/units/{unit_id}/versions       版本元信息列表
- GET  /labels/units/{unit_id}/versions/{v}   指定版本
- GET  /labels/units/{unit_id}/diff           ?from=N&to=M

注意:POST 提交 expected_version,服务端用它做乐观锁;冲突返 409。
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from redis import asyncio as aioredis
from tortoise.expressions import Q

from ..apps.ctx import CTX_USER_ID, get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.db.models import Unit, User, WorkflowInstance, Workflow
from ..biz.services.audit import audit_service
from ..biz.services.label_v2 import (
    LabelConflict,
    LabelNotFound,
    LabelSaveIn,
    label_service,
)
from ..biz.workflow.engine import AuthCtx, WorkflowEngine, WorkflowError
from ..biz.workflow.lock import WorkflowBusy
from ..biz.workflow.spec import Decision, RejectReason
from ..redis_conf import init_redis_pool

router = APIRouter()
engine = WorkflowEngine()


class SaveLabelIn(BaseModel):
    """写入载荷。expected_version=0 表示首次,>=1 表示基于 N 更新。"""
    expected_version: int = Field(0, ge=0)
    objects: list[dict] = Field(default_factory=list)
    attrs: dict = Field(default_factory=dict)

    class Config:
        extra = "allow"


class SubmitLabelIn(SaveLabelIn):
    """保存并推进工作流。review stage 的 actor 通常由 current_stage 决定。"""
    decision: Decision = "approved"
    reason: Optional[RejectReason] = None


def _require_tenant() -> str:
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    return tenant_id


async def _load_unit_or_404(unit_id: int, tenant_id: str) -> Unit:
    unit = await Unit.filter(tenant_id=tenant_id, id=unit_id).first()
    if unit is None:
        raise HTTPException(status_code=404, detail=f"unit {unit_id} 不存在")
    return unit


@router.get(
    "/units/{unit_id}",
    summary="读取 unit 最新版本 label",
    dependencies=[permission_required("business:label:read")],
)
async def get_label(unit_id: int):
    tenant_id = _require_tenant()
    await _load_unit_or_404(unit_id, tenant_id)
    try:
        rec = await label_service.get_label(unit_id=unit_id)
    except LabelNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    return rec.model_dump(mode="json")


@router.get(
    "/units/{unit_id}/versions",
    summary="unit 版本元信息列表",
    dependencies=[permission_required("business:label:read")],
)
async def list_versions(unit_id: int):
    tenant_id = _require_tenant()
    await _load_unit_or_404(unit_id, tenant_id)
    items = await label_service.list_versions(unit_id=unit_id)
    return {"items": items}


@router.get(
    "/units/{unit_id}/versions/{version}",
    summary="读取指定版本",
    dependencies=[permission_required("business:label:read")],
)
async def get_label_version(unit_id: int, version: int):
    tenant_id = _require_tenant()
    await _load_unit_or_404(unit_id, tenant_id)
    try:
        rec = await label_service.get_label(unit_id=unit_id, version=version)
    except LabelNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    return rec.model_dump(mode="json")


@router.get(
    "/units/{unit_id}/diff",
    summary="两个版本之间的对象 diff",
    dependencies=[permission_required("business:label:read")],
)
async def diff_label(
    unit_id: int,
    frm: int = Query(..., alias="from", ge=0),
    to: int = Query(..., ge=0),
):
    tenant_id = _require_tenant()
    await _load_unit_or_404(unit_id, tenant_id)
    try:
        return await label_service.diff(unit_id=unit_id, from_version=frm, to_version=to)
    except LabelNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/units/{unit_id}",
    summary="保存 label(乐观锁,不推进工作流)",
    dependencies=[permission_required("business:label:write")],
)
async def save_label(unit_id: int, payload: SaveLabelIn):
    tenant_id = _require_tenant()
    unit = await _load_unit_or_404(unit_id, tenant_id)
    actor_id = CTX_USER_ID.get() or None
    try:
        rec = await label_service.save_label(
            unit_id=unit.id, project_id=unit.project_id, mission=unit.mission,
            payload=LabelSaveIn(**payload.model_dump()),
            expected_version=payload.expected_version,
            actor_id=actor_id,
        )
    except LabelConflict as e:
        raise HTTPException(
            status_code=409,
            detail=(
                f"版本冲突:期望 v{e.expected},实际 "
                f"{('v' + str(e.actual)) if e.actual is not None else '不存在/被并发覆盖'}"
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 同步 unit.data_version,便于工作流侧 fetch 当前版本
    unit.data_version = rec.version
    await unit.save(update_fields=["data_version", "updated_at"])
    await audit_service.log(
        action="label.save",
        actor_id=actor_id, tenant_id=tenant_id,
        resource_type="unit_label", resource_id=str(unit.id),
        detail={"version": rec.version, "mission": unit.mission},
    )
    return rec.model_dump(mode="json")


@router.post(
    "/units/{unit_id}/submit",
    summary="保存 label 并推进工作流",
    dependencies=[permission_required("business:label:write")],
)
async def submit_label(
    unit_id: int,
    payload: SubmitLabelIn,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    tenant_id = _require_tenant()
    unit = await _load_unit_or_404(unit_id, tenant_id)
    actor_id = CTX_USER_ID.get() or 0

    # 1) 先保存(乐观锁)
    try:
        rec = await label_service.save_label(
            unit_id=unit.id, project_id=unit.project_id, mission=unit.mission,
            payload=LabelSaveIn(**payload.model_dump(exclude={"expected_version", "decision", "reason"})),
            expected_version=payload.expected_version,
            actor_id=actor_id,
        )
    except LabelConflict as e:
        raise HTTPException(
            status_code=409,
            detail=(
                f"版本冲突:期望 v{e.expected},实际 "
                f"{('v' + str(e.actual)) if e.actual is not None else '不存在/被并发覆盖'}"
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    unit.data_version = rec.version
    await unit.save(update_fields=["data_version", "updated_at"])

    # 2) 找到当前进行中的实例
    inst = await WorkflowInstance.filter(
        tenant_id=tenant_id, unit_id=unit.id,
        current_status__in=["pending", "in_progress", "arbitrate"],
    ).first()
    if inst is None:
        raise HTTPException(
            status_code=400,
            detail=f"unit {unit.id} 没有进行中的工作流实例,仅保存了 label",
        )

    # 3) 推进
    user = await User.filter(id=actor_id).first()
    actor = AuthCtx(
        user_id=actor_id, tenant_id=tenant_id,
        is_superuser=user.is_superuser if user else False,
    )
    try:
        updated_inst = await engine.submit(
            instance_id=inst.id,
            decision=payload.decision, reason=payload.reason,
            actor=actor, redis=redis,
        )
    except WorkflowBusy:
        raise HTTPException(status_code=409, detail="资源正被另一会话操作,请重试")
    except WorkflowError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await audit_service.log(
        action="label.submit",
        actor_id=actor_id, tenant_id=tenant_id,
        resource_type="workflow_instance", resource_id=str(updated_inst.id),
        detail={
            "unit_id": unit.id, "version": rec.version,
            "decision": payload.decision, "stage": updated_inst.current_stage,
        },
    )
    return {
        "label": rec.model_dump(mode="json"),
        "instance": await updated_inst.to_dict(),
    }
