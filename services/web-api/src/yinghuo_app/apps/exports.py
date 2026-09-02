"""Stage 8 导出路由 /exports。

挂载:main app,前缀 /api/v1/b/exports。
权限:business:export:read。
同步返回 OpenLABEL dict;超 1000 unit 拒绝(返 400)。
"""
from fastapi import APIRouter, HTTPException

from ..apps.dependency import permission_required
from ..biz.services.export import ExportError, ExportIn, export_service

router = APIRouter()


@router.post(
    "",
    summary="导出 Unit(已审核)为 OpenLABEL",
    dependencies=[permission_required("business:export:read")],
)
async def export_units(payload: ExportIn):
    try:
        return await export_service.export_units_to_openlabel(payload)
    except ExportError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/coco",
    summary="(兼容)老 COCO 导出 - 暂转发到 anno_service",
    dependencies=[permission_required("business:export:read")],
)
async def export_coco_compat(payload: dict):
    """兼容入口。payload: {job_uuid}。"""
    from ..biz.services.anno import anno_service
    job_uuid = (payload or {}).get("job_uuid")
    if not job_uuid:
        raise HTTPException(status_code=400, detail="job_uuid 必填")
    try:
        d = await anno_service.export_to_coco(job_uuid=str(job_uuid))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"老 COCO 导出失败:{e!r}")
    return d
