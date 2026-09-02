"""项目模板库 /project-templates。

挂载:main app,前缀 /api/v1/b/project-templates。
权限:business:project:read|write。

模板是新建项目的默认值快照(包含 mission/taxonomy/workflow/review_policy/tags),
不与具体项目强引用;instantiate 时拷贝默认值创建 Project,之后所有字段可独立修改。
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from tortoise.expressions import Q

from ..apps.ctx import get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.db.models import Project, ProjectTemplate
from ..biz.services.audit import audit_service

router = APIRouter()


class TemplateCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*$")
    description: Optional[str] = Field(None, max_length=512)
    mission: str = Field(..., min_length=1, max_length=64)
    taxonomy_version_id: Optional[int] = None
    workflow_id: Optional[int] = None
    review_policy: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class TemplateUpdateIn(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = Field(None, max_length=512)
    mission: Optional[str] = Field(None, max_length=64)
    taxonomy_version_id: Optional[int] = None
    workflow_id: Optional[int] = None
    review_policy: Optional[dict] = None
    tags: Optional[list[str]] = None


class InstantiateFromTemplateIn(BaseModel):
    """从模板创建项目。slug 必须为新项目在租户内唯一的 slug,
    其它字段缺省时从模板拷贝。
    """
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")
    name: Optional[str] = Field(None, max_length=128)
    org_unit_id: Optional[int] = None
    taxonomy_version_id: Optional[int] = None
    workflow_id: Optional[int] = None


def _require_tenant() -> str:
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    return tenant_id


@router.get(
    "",
    summary="项目模板列表(含内置)",
    dependencies=[permission_required("business:project:read")],
)
async def list_templates():
    tenant_id = _require_tenant()
    qs = ProjectTemplate.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id=None, is_builtin=True)
    )
    rows = await qs.order_by("-is_builtin", "-created_at")
    return {"items": [await r.to_dict() for r in rows]}


@router.post(
    "",
    summary="创建项目模板",
    dependencies=[permission_required("business:project:write")],
)
async def create_template(payload: TemplateCreateIn):
    tenant_id = _require_tenant()
    if await ProjectTemplate.filter(tenant_id=tenant_id, slug=payload.slug).exists():
        raise HTTPException(status_code=409, detail=f"slug 已存在:{payload.slug}")
    tpl = await ProjectTemplate.create(
        tenant_id=tenant_id,
        name=payload.name, slug=payload.slug,
        description=payload.description,
        mission=payload.mission,
        taxonomy_version_id=payload.taxonomy_version_id,
        workflow_id=payload.workflow_id,
        review_policy=payload.review_policy,
        tags=payload.tags,
        is_builtin=False,
    )
    return await tpl.to_dict()


@router.get(
    "/{template_id}",
    summary="模板详情",
    dependencies=[permission_required("business:project:read")],
)
async def get_template(template_id: int):
    tenant_id = _require_tenant()
    tpl = await ProjectTemplate.filter(
        Q(id=template_id)
        & (Q(tenant_id=tenant_id) | Q(tenant_id=None, is_builtin=True))
    ).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    return await tpl.to_dict()


@router.patch(
    "/{template_id}",
    summary="更新模板(内置不可改)",
    dependencies=[permission_required("business:project:write")],
)
async def update_template(template_id: int, payload: TemplateUpdateIn):
    tenant_id = _require_tenant()
    tpl = await ProjectTemplate.filter(tenant_id=tenant_id, id=template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    if tpl.is_builtin:
        raise HTTPException(status_code=409, detail="内置模板不可修改")
    fields = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="未提供更新字段")
    for k, v in fields.items():
        setattr(tpl, k, v)
    await tpl.save(update_fields=list(fields.keys()))
    return await tpl.to_dict()


@router.delete(
    "/{template_id}",
    summary="删除模板(内置不可删)",
    dependencies=[permission_required("business:project:write")],
)
async def delete_template(template_id: int):
    tenant_id = _require_tenant()
    tpl = await ProjectTemplate.filter(tenant_id=tenant_id, id=template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    if tpl.is_builtin:
        raise HTTPException(status_code=409, detail="内置模板不可删除")
    await tpl.delete()
    return {"statusText": "已删除"}


@router.post(
    "/{template_id}/instantiate",
    summary="从模板创建项目",
    dependencies=[permission_required("business:project:write")],
)
async def instantiate_from_template(
    template_id: int,
    payload: InstantiateFromTemplateIn,
):
    tenant_id = _require_tenant()
    tpl = await ProjectTemplate.filter(
        Q(id=template_id)
        & (Q(tenant_id=tenant_id) | Q(tenant_id=None, is_builtin=True))
    ).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")

    if await Project.filter(tenant_id=tenant_id, slug=payload.slug).exists():
        raise HTTPException(status_code=409, detail=f"slug 已存在:{payload.slug}")

    project = await Project.create(
        tenant_id=tenant_id,
        org_unit_id=payload.org_unit_id,
        name=payload.name or tpl.name,
        slug=payload.slug,
        status="draft",
        taxonomy_version_id=payload.taxonomy_version_id or tpl.taxonomy_version_id,
        workflow_id=payload.workflow_id or tpl.workflow_id,
        settings={
            "mission": tpl.mission,
            "review_policy": tpl.review_policy,
            "tags": tpl.tags,
            "from_template": tpl.slug,
        },
    )
    await audit_service.log(
        action="project.instantiate_from_template",
        tenant_id=tenant_id,
        resource_type="project", resource_id=str(project.id),
        detail={"template_id": tpl.id, "template_slug": tpl.slug, "slug": project.slug},
    )
    return await project.to_dict()
