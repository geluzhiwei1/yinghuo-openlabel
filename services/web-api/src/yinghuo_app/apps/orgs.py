"""组织单元 CRUD /orgs。

挂载:admin app 下,前缀 /api/v1/a/orgs。挂 admin:team:read|write 权限。

设计要点:
- 所有查询带 tenant_id 过滤(从 CTX_TENANT_ID 取)
- 物化路径 path:根节点 '/{tenant_slug}/{id}',子节点继承父 path 追加 '/{id}'
- 祖先查询:`path__startswith` + 反向 token 解析
- 后代查询:`path__startswith '/{tenant_slug}/{parent_id}/'`
- 删除前检查子节点 + 成员,若有则拒绝
"""
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field

from ..apps.ctx import get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.db.models import OrgMembership, OrgUnit
from ..biz.services.audit import audit_service

router = APIRouter()


class OrgCreateIn(BaseModel):
    parent_id: Optional[int] = Field(None, description="父节点 id,缺省为根")
    kind: str = Field("team", pattern=r"^(company|division|team|group)$")
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = Field(None, max_length=512)


class OrgUpdateIn(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None
    kind: Optional[str] = Field(None, pattern=r"^(company|division|team|group)$")
    is_active: Optional[bool] = None


def _root_path(tenant_id: str, node_id: int) -> str:
    return f"/{tenant_id}/{node_id}"


@router.get(
    "",
    summary="组织单元列表",
    dependencies=[permission_required("admin:team:read")],
)
async def list_orgs(
    parent_id: Optional[int] = Query(None, description="按直接父节点过滤"),
    include_descendants: bool = Query(False, description="是否包含后代"),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")

    qs = OrgUnit.filter(tenant_id=tenant_id)
    if parent_id is not None:
        if include_descendants:
            parent = await OrgUnit.filter(
                tenant_id=tenant_id, id=parent_id,
            ).first()
            if not parent:
                raise HTTPException(status_code=404, detail="父节点不存在")
            qs = qs.filter(path__startswith=f"{parent.path}/")
        else:
            qs = qs.filter(parent_id=parent_id)
    rows = await qs.order_by("path")
    return {"items": [await r.to_dict() for r in rows]}


@router.get(
    "/tree",
    summary="组织单元树(完整)",
    dependencies=[permission_required("admin:team:read")],
)
async def org_tree():
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    rows = await OrgUnit.filter(tenant_id=tenant_id, is_active=True).order_by("path")
    # 物化路径已天然排序;返回扁平列表由前端组装
    return {"items": [await r.to_dict() for r in rows]}


@router.post(
    "",
    summary="创建组织单元",
    dependencies=[permission_required("admin:team:write")],
)
async def create_org(payload: OrgCreateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")

    parent_path = f"/{tenant_id}"
    if payload.parent_id is not None:
        parent = await OrgUnit.filter(
            tenant_id=tenant_id, id=payload.parent_id, is_active=True,
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父节点不存在")
        parent_path = parent.path

    org = await OrgUnit.create(
        tenant_id=tenant_id,
        parent_id=payload.parent_id,
        path="PLACEHOLDER",  # 先占位,创建后再用真实 id 拼接
        kind=payload.kind,
        name=payload.name,
        description=payload.description,
    )
    org.path = f"{parent_path}/{org.id}"
    await org.save(update_fields=["path"])

    await audit_service.log(
        action="org.create",
        actor_id=None,  # 平台账号上下文外;service 层补
        tenant_id=tenant_id,
        resource_type="org_unit", resource_id=str(org.id),
        detail={"name": org.name, "parent_id": payload.parent_id, "kind": org.kind},
    )
    return await org.to_dict()


@router.patch(
    "/{org_id}",
    summary="更新组织单元",
    dependencies=[permission_required("admin:team:write")],
)
async def update_org(org_id: int, payload: OrgUpdateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    org = await OrgUnit.filter(tenant_id=tenant_id, id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="组织单元不存在")

    update_fields = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="未提供更新字段")
    for k, v in update_fields.items():
        setattr(org, k, v)
    await org.save(update_fields=list(update_fields.keys()))
    return await org.to_dict()


@router.delete(
    "/{org_id}",
    summary="删除组织单元(检查子节点与成员)",
    dependencies=[permission_required("admin:team:write")],
)
async def delete_org(org_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    org = await OrgUnit.filter(tenant_id=tenant_id, id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="组织单元不存在")

    children = await OrgUnit.filter(
        tenant_id=tenant_id, parent_id=org_id,
    ).exclude(id=org_id).count()
    if children > 0:
        raise HTTPException(status_code=409, detail=f"存在 {children} 个子节点,先迁移或删除")

    members = await OrgMembership.filter(
        tenant_id=tenant_id, org_unit_id=org_id,
    ).count()
    if members > 0:
        raise HTTPException(status_code=409, detail=f"存在 {members} 个成员,先移除或迁移")

    await org.delete()
    return {"statusText": "已删除"}


# —— 成员管理 ——

class MembershipIn(BaseModel):
    user_id: int
    role: str = Field("member", pattern=r"^(admin|member|leader)$")


@router.get(
    "/{org_id}/members",
    summary="组织单元成员列表",
    dependencies=[permission_required("admin:team:read")],
)
async def list_members(org_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    rows = await OrgMembership.filter(tenant_id=tenant_id, org_unit_id=org_id)
    return {"items": [await r.to_dict() for r in rows]}


@router.post(
    "/{org_id}/members",
    summary="添加成员",
    dependencies=[permission_required("admin:team:write")],
)
async def add_member(org_id: int, payload: MembershipIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    org = await OrgUnit.filter(tenant_id=tenant_id, id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="组织单元不存在")

    membership, created = await OrgMembership.get_or_create(
        tenant_id=tenant_id, user_id=payload.user_id, org_unit_id=org_id,
        defaults={"role": payload.role},
    )
    if not created:
        if membership.role != payload.role:
            membership.role = payload.role
            await membership.save(update_fields=["role"])
    return await membership.to_dict()


@router.delete(
    "/{org_id}/members/{user_id}",
    summary="移除成员",
    dependencies=[permission_required("admin:team:write")],
)
async def remove_member(org_id: int, user_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    deleted = await OrgMembership.filter(
        tenant_id=tenant_id, org_unit_id=org_id, user_id=user_id,
    ).delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="成员不存在")
    return {"statusText": "已移除"}
