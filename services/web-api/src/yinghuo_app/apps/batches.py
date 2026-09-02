"""Stage 7 批次与任务调度路由。

挂载:main app,前缀 /api/v1/b/batches。
项目嵌套路由(/projects/{pid}/batches、/projects/{pid}/units)在本 router 内用
完整 path 注册,避免拆 router 与 prefix 链式拼接的复杂性。

权限:
- business:anno-job:read|write → batch CRUD、unit 查询/分派
- business:label:write → unit 认领/退回(标注员视角)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from redis import asyncio as aioredis

from ..apps.ctx import CTX_USER_ID, get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.services.batch import (
    AssignIn,
    BatchConflict,
    BatchCreateIn,
    BatchError,
    BatchService,
    BatchUpdateIn,
    SpawnUnitsIn,
    batch_service,
)
from ..redis_conf import init_redis_pool

router = APIRouter()
_batch = BatchService()


def _require_tenant() -> str:
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    return tenant_id


# ===== Batch CRUD(项目嵌套) =====

@router.get(
    "/projects/{project_id}/batches",
    summary="项目下 Batch 列表",
    dependencies=[permission_required("business:anno-job:read")],
)
async def list_batches(
    project_id: int,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    _require_tenant()
    try:
        return await _batch.list_batches(
            project_id=project_id, status_filter=status,
            page=page, page_size=page_size,
        )
    except BatchError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/projects/{project_id}/batches",
    summary="创建 Batch",
    dependencies=[permission_required("business:anno-job:write")],
)
async def create_batch(project_id: int, payload: BatchCreateIn):
    _require_tenant()
    try:
        b = await _batch.create_batch(project_id=project_id, payload=payload)
    except BatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await _batch._batch_to_dict(b)


# ===== Batch 操作(扁平 /batches/{id}) =====

@router.get(
    "/batches/{batch_id}",
    summary="Batch 详情",
    dependencies=[permission_required("business:anno-job:read")],
)
async def get_batch(batch_id: int):
    _require_tenant()
    try:
        b = await _batch.get_batch(batch_id=batch_id)
    except BatchError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return await _batch._batch_to_dict(b)


@router.patch(
    "/batches/{batch_id}",
    summary="更新 Batch",
    dependencies=[permission_required("business:anno-job:write")],
)
async def update_batch(batch_id: int, payload: BatchUpdateIn):
    _require_tenant()
    try:
        b = await _batch.update_batch(batch_id=batch_id, payload=payload)
    except BatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await _batch._batch_to_dict(b)


@router.delete(
    "/batches/{batch_id}",
    summary="删除 Batch(仅 pending 或无关联 Unit)",
    dependencies=[permission_required("business:anno-job:write")],
)
async def delete_batch(batch_id: int):
    _require_tenant()
    try:
        await _batch.delete_batch(batch_id=batch_id)
    except BatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"statusText": "已删除"}


@router.post(
    "/batches/{batch_id}/spawn",
    summary="从数据序列铺 Unit",
    dependencies=[permission_required("business:anno-job:write")],
)
async def spawn_units(
    batch_id: int,
    payload: SpawnUnitsIn,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    _require_tenant()
    try:
        return await _batch.spawn_units(
            batch_id=batch_id, payload=payload, redis=redis,
        )
    except BatchError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== Unit 列表(项目嵌套) =====

@router.get(
    "/projects/{project_id}/units",
    summary="项目下 Unit 列表",
    dependencies=[permission_required("business:anno-job:read")],
)
async def list_units(
    project_id: int,
    batch_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    stage_status: Optional[str] = None,
    eligible_only: bool = Query(
        False, description="true=只返回当前用户角色有权认领的 unit(按 stage assignee_source 过滤)"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    _require_tenant()
    actor_id = CTX_USER_ID.get() or 0
    return await _batch.list_units(
        project_id=project_id, batch_id=batch_id,
        assignee_id=assignee_id, stage_status=stage_status,
        eligible_only=eligible_only, actor_id=actor_id,
        page=page, page_size=page_size,
    )


# ===== Unit 操作(扁平 /units/{id}) =====

@router.get(
    "/units/by-coord",
    summary="按 seq+stream+frame+mission 定位 Unit(anno 工作台使用)",
    dependencies=[permission_required("business:anno-job:read")],
)
async def find_unit_by_coord(
    seq: str = Query(..., max_length=256),
    stream: str = Query(..., max_length=128),
    frame: int = Query(..., ge=0),
    mission: str = Query(..., max_length=64),
):
    """给 anno.html 工作台用:从 jobConfig 反查 Stage 7 spawn 出来的 Unit。

    返回 200(找不到也返 200,避免前端触发错误提示):
    - {unit: null, instance: null} 老 AnnoJob,前端走 frame_save 兼容路径
    - {unit, instance} 当前 instance 含 stage_history,便于前端展示驳回横幅
    """
    from ..biz.db.models import Unit, WorkflowInstance

    tenant_id = _require_tenant()
    unit = await Unit.filter(
        tenant_id=tenant_id, seq=seq, stream=stream, mission=mission,
        frame=frame,
    ).first()
    if unit is None:
        return {"unit": None, "instance": None}
    inst = await WorkflowInstance.filter(
        tenant_id=tenant_id, unit_id=unit.id,
    ).order_by("-created_at").first()
    return {
        "unit": await _batch._unit_to_dict(unit),
        "instance": await inst.to_dict() if inst else None,
    }


@router.post(
    "/units/{unit_id}/claim",
    summary="认领 Unit(manual 模式)",
    dependencies=[permission_required("business:label:write")],
)
async def claim_unit(unit_id: int):
    _require_tenant()
    actor_id = CTX_USER_ID.get() or 0
    try:
        unit = await _batch.claim_unit(unit_id=unit_id, actor_id=actor_id)
    except BatchConflict as e:
        raise HTTPException(status_code=409, detail=str(e))
    except BatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await _batch._unit_to_dict(unit)


@router.post(
    "/units/{unit_id}/assign",
    summary="强制指派 Unit(管理员)",
    dependencies=[permission_required("business:anno-job:write")],
)
async def assign_unit(unit_id: int, payload: AssignIn):
    _require_tenant()
    try:
        unit = await _batch.assign_unit(unit_id=unit_id, payload=payload)
    except BatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await _batch._unit_to_dict(unit)


@router.post(
    "/units/{unit_id}/release",
    summary="退回 Unit",
    dependencies=[permission_required("business:label:write")],
)
async def release_unit(
    unit_id: int,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    _require_tenant()
    actor_id = CTX_USER_ID.get() or 0
    try:
        unit = await _batch.release_unit(
            unit_id=unit_id, actor_id=actor_id, redis=redis,
        )
    except BatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await _batch._unit_to_dict(unit)
