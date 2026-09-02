"""租户审计日志查询。

挂载:main app,前缀 /audit-logs。
权限:business/管理面共用,要求 admin:audit:read。
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..apps.ctx import CTX_USER_ID, get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.db.models import AuditLog

router = APIRouter()


def _require_tenant() -> str:
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    return tenant_id


@router.get(
    "",
    summary="租户审计日志列表(管理面 AuditLog 视图用)",
    dependencies=[permission_required("admin:audit:read")],
)
async def list_audit_logs(
    action: Optional[str] = Query(None, description="前缀匹配,如 user.login"),
    actor_id: Optional[int] = Query(None),
    resource_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    tenant_id = _require_tenant()
    qs = AuditLog.filter(tenant_id=tenant_id)
    if action:
        qs = qs.filter(action__istartswith=action)
    if actor_id is not None:
        qs = qs.filter(actor_id=actor_id)
    if resource_type:
        qs = qs.filter(resource_type=resource_type)

    total = await qs.count()
    rows = (
        await qs.order_by("-id")
        .offset((page - 1) * page_size)
        .limit(page_size)
        .values(
            "id", "actor_id", "tenant_id", "action",
            "resource_type", "resource_id", "detail",
            "ip", "user_agent", "created_at",
        )
    )
    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/actions",
    summary="审计日志 action 枚举(给前端过滤下拉用)",
    dependencies=[permission_required("admin:audit:read")],
)
async def list_audit_actions():
    tenant_id = _require_tenant()
    rows = (
        await AuditLog.filter(tenant_id=tenant_id)
        .order_by("action")
        .distinct()
        .values("action")
    )
    return {"items": [r["action"] for r in rows if r.get("action")]}
