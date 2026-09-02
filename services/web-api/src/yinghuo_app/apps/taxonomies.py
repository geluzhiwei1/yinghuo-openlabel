"""标签集版本 CRUD /taxonomies。

挂载:main app 下,前缀 /api/v1/b/taxonomies(业务面)。
权限:business:project:read 列表,business:project:write 增删改切换。

设计要点:
- 同租户同 taxonomy_key 同时仅一个 is_current=True
- set_current 切换时事务化:旧 current 置 False,新 current 置 True
- 内容字段 content 存完整 ontology JSON,结构由 Stage 5 workflow 解释
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from tortoise.transactions import in_transaction

from ..apps.ctx import get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.db.models import TaxonomyVersion

router = APIRouter()


class TaxonomyCreateIn(BaseModel):
    taxonomy_key: str = Field(..., min_length=1, max_length=64,
                              pattern=r"^[a-z0-9][a-z0-9_-]*$")
    version_label: str = Field(..., min_length=1, max_length=32)
    content: dict = Field(default_factory=dict)
    description: Optional[str] = Field(None, max_length=512)
    set_current: bool = Field(True, description="创建后立即设为当前版本")


class TaxonomyUpdateIn(BaseModel):
    description: Optional[str] = None
    content: Optional[dict] = None


@router.get(
    "",
    summary="标签集版本列表",
    dependencies=[permission_required("business:project:read")],
)
async def list_taxonomies(
    taxonomy_key: Optional[str] = None,
    only_current: bool = Query(False, description="只返回 is_current=True"),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    qs = TaxonomyVersion.filter(tenant_id=tenant_id)
    if taxonomy_key:
        qs = qs.filter(taxonomy_key=taxonomy_key)
    if only_current:
        qs = qs.filter(is_current=True)
    rows = await qs.order_by("-created_at")
    return {"items": [await r.to_dict() for r in rows]}


@router.post(
    "",
    summary="创建标签集版本",
    dependencies=[permission_required("business:project:write")],
)
async def create_taxonomy(payload: TaxonomyCreateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")

    # 同 (tenant, key, version) 唯一
    exists = await TaxonomyVersion.filter(
        tenant_id=tenant_id, taxonomy_key=payload.taxonomy_key,
        version_label=payload.version_label,
    ).exists()
    if exists:
        raise HTTPException(
            status_code=409,
            detail=f"{payload.taxonomy_key}@{payload.version_label} 已存在",
        )

    async with in_transaction():
        if payload.set_current:
            # 清掉同 key 其他版本的 current 标记
            await TaxonomyVersion.filter(
                tenant_id=tenant_id, taxonomy_key=payload.taxonomy_key,
                is_current=True,
            ).update(is_current=False)
        tax = await TaxonomyVersion.create(
            tenant_id=tenant_id,
            taxonomy_key=payload.taxonomy_key,
            version_label=payload.version_label,
            content=payload.content,
            description=payload.description,
            is_current=payload.set_current,
        )
    return await tax.to_dict()


@router.patch(
    "/{tax_id}",
    summary="更新标签集版本(描述/内容,is_current 用 set-current 接口切换)",
    dependencies=[permission_required("business:project:write")],
)
async def update_taxonomy(tax_id: int, payload: TaxonomyUpdateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    tax = await TaxonomyVersion.filter(tenant_id=tenant_id, id=tax_id).first()
    if not tax:
        raise HTTPException(status_code=404, detail="标签集版本不存在")
    update_fields = payload.model_dump(exclude_unset=True, exclude_none=True)
    for k, v in update_fields.items():
        setattr(tax, k, v)
    await tax.save(update_fields=list(update_fields.keys()))
    return await tax.to_dict()


@router.post(
    "/{tax_id}/set-current",
    summary="把指定版本设为当前",
    dependencies=[permission_required("business:project:write")],
)
async def set_current(tax_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    tax = await TaxonomyVersion.filter(tenant_id=tenant_id, id=tax_id).first()
    if not tax:
        raise HTTPException(status_code=404, detail="标签集版本不存在")

    async with in_transaction():
        await TaxonomyVersion.filter(
            tenant_id=tenant_id, taxonomy_key=tax.taxonomy_key,
            is_current=True,
        ).update(is_current=False)
        tax.is_current = True
        await tax.save(update_fields=["is_current", "updated_at"])
    return await tax.to_dict()


@router.delete(
    "/{tax_id}",
    summary="删除标签集版本(当前版本不可删)",
    dependencies=[permission_required("business:project:write")],
)
async def delete_taxonomy(tax_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    tax = await TaxonomyVersion.filter(tenant_id=tenant_id, id=tax_id).first()
    if not tax:
        raise HTTPException(status_code=404, detail="标签集版本不存在")
    if tax.is_current:
        raise HTTPException(status_code=409, detail="当前版本不可删,先切换到其他版本")
    await tax.delete()
    return {"statusText": "已删除"}
