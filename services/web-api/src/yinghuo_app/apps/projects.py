"""标注项目 CRUD /projects。

挂载:main app 下,前缀 /api/v1/b/projects(经 nginx strip /api/v1/b → 实际暴露 /projects)。
挂 business:project:read|write 权限。

设计要点:
- 所有查询带 tenant_id 过滤(强制 require_tenant)
- slug 在租户内唯一
- 状态机:draft → active ⇄ paused → archived
- taxonomy_version_id 应指向当前租户内的 taxonomy;创建时不强制校验,后续 Stage 5 引用
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..apps.ctx import get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.db.models import Project
from ..biz.services.audit import audit_service

router = APIRouter()


class ProjectCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    slug: str = Field(..., min_length=2, max_length=64,
                     pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")
    org_unit_id: Optional[int] = None
    taxonomy_version_id: Optional[int] = None
    settings: dict = Field(default_factory=dict)


class ProjectUpdateIn(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    status: Optional[str] = Field(
        None, pattern=r"^(draft|active|paused|archived)$",
    )
    org_unit_id: Optional[int] = None
    taxonomy_version_id: Optional[int] = None
    workflow_id: Optional[int] = None
    settings: Optional[dict] = None


@router.get(
    "",
    summary="项目列表",
    dependencies=[permission_required("business:project:read")],
)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    org_unit_id: Optional[int] = None,
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")

    qs = Project.filter(tenant_id=tenant_id)
    if status:
        qs = qs.filter(status=status)
    if org_unit_id is not None:
        qs = qs.filter(org_unit_id=org_unit_id)

    total = await qs.count()
    rows = (await qs.offset((page - 1) * page_size).limit(page_size)
            .order_by("-created_at"))
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [await r.to_dict() for r in rows],
    }


@router.post(
    "",
    summary="创建项目",
    dependencies=[permission_required("business:project:write")],
)
async def create_project(payload: ProjectCreateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")

    if await Project.filter(tenant_id=tenant_id, slug=payload.slug).exists():
        raise HTTPException(status_code=409, detail=f"slug 已存在:{payload.slug}")

    project = await Project.create(
        tenant_id=tenant_id,
        org_unit_id=payload.org_unit_id,
        name=payload.name,
        slug=payload.slug,
        status="draft",
        taxonomy_version_id=payload.taxonomy_version_id,
        settings=payload.settings,
    )
    await audit_service.log(
        action="project.create", tenant_id=tenant_id,
        resource_type="project", resource_id=str(project.id),
        detail={"name": project.name, "slug": project.slug},
    )
    return await project.to_dict()


@router.get(
    "/{project_id}",
    summary="项目详情",
    dependencies=[permission_required("business:project:read")],
)
async def get_project(project_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    project = await Project.filter(tenant_id=tenant_id, id=project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return await project.to_dict()


@router.patch(
    "/{project_id}",
    summary="更新项目",
    dependencies=[permission_required("business:project:write")],
)
async def update_project(project_id: int, payload: ProjectUpdateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    project = await Project.filter(tenant_id=tenant_id, id=project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    update_fields = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="未提供更新字段")

    # 归档后不允许再激活(避免历史项目被随意回滚)
    if project.status == "archived" and update_fields.get("status") != "archived":
        raise HTTPException(status_code=409, detail="已归档项目不可改状态,需新建")

    for k, v in update_fields.items():
        setattr(project, k, v)
    await project.save(update_fields=list(update_fields.keys()))
    await audit_service.log(
        action="project.update", tenant_id=tenant_id,
        resource_type="project", resource_id=str(project.id),
        detail={"fields": list(update_fields.keys())},
    )
    return await project.to_dict()


@router.delete(
    "/{project_id}",
    summary="归档项目(软删除)",
    dependencies=[permission_required("business:project:write")],
)
async def archive_project(project_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    project = await Project.filter(tenant_id=tenant_id, id=project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.status == "archived":
        raise HTTPException(status_code=409, detail="项目已归档")
    project.status = "archived"
    await project.save(update_fields=["status", "updated_at"])
    await audit_service.log(
        action="project.archive", tenant_id=tenant_id,
        resource_type="project", resource_id=str(project.id),
    )
    return {"statusText": "已归档"}
