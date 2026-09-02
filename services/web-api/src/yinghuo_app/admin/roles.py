"""租户内角色 CRUD + 权限编辑(管理面 admin app)。

挂载:admin app,前缀 /api/v1/a/roles。
权限:
- GET 类:admin:role:read
- 写入类:admin:role:write

scope 限制:仅管理 scope='business' AND tenant_id=current 的角色。
平台面/管理面内置角色(is_builtin=True, scope=platform/admin)不在此处编辑。
"""
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from redis import asyncio as aioredis

from ..apps.ctx import CTX_USER_ID, get_current_tenant_id
from ..apps.dependency import permission_required, require_tenant
from ..biz.db.models import Permission, Role, UserRole
from ..biz.rbac.permissions import ALL_PERMISSIONS
from ..biz.rbac.resolver import CACHE_KEY_TMPL, invalidate_user_permissions
from ..biz.services.audit import audit_service
from ..dto.response import SuccessJson
from ..redis_conf import init_redis_pool

router = APIRouter()


def _actor_id() -> Optional[int]:
    uid = CTX_USER_ID.get()
    try:
        return int(uid) if uid is not None else None
    except (TypeError, ValueError):
        return None


# —— Schemas ———————————————————————————————

class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    description: Optional[str] = Field(None, max_length=255)


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=64)
    description: Optional[str] = Field(None, max_length=255)


class PermissionsIn(BaseModel):
    permissions: list[str] = Field(default_factory=list)


# —— Helpers ———————————————————————————————

async def _invalidate_role_users_cache(role_id: int, redis: aioredis.Redis) -> int:
    """批量失效所有绑了此 role 的 user 的权限缓存。返回失效条数。"""
    user_ids = await UserRole.filter(role_id=role_id).distinct().values_list("user_id", flat=True)
    if not user_ids:
        return 0
    pipe = redis.pipeline()
    for uid in user_ids:
        pipe.delete(CACHE_KEY_TMPL.format(uid=uid))
    await pipe.execute()
    return len(user_ids)


async def _serialize_role(role: Role, include_perms: bool = False) -> dict:
    user_count = await UserRole.filter(role_id=role.id).count()
    perm_keys: list[str] = []
    perm_count = 0
    if include_perms:
        perms = await role.permissions.all()
        perm_keys = [p.key for p in perms]
        perm_count = len(perm_keys)
    else:
        perm_count = await role.permissions.all().count()
    return {
        "id": role.id,
        "name": role.name,
        "scope": role.scope,
        "tenant_id": role.tenant_id,
        "description": role.description,
        "is_system": role.is_system,
        "is_builtin": role.is_builtin,
        "user_count": user_count,
        "perm_count": perm_count,
        "permissions": perm_keys,
    }


# —— 端点 ———————————————————————————————

@router.get(
    "",
    summary="租户内角色列表(只列 scope=business AND 当前 tenant)",
    dependencies=[permission_required("admin:role:read")],
)
async def list_roles():
    tenant_id = require_tenant()
    rows = await Role.filter(scope="business", tenant_id=tenant_id).order_by("-id")
    items = [await _serialize_role(r) for r in rows]
    return SuccessJson(data=items)


@router.get(
    "/{role_id}",
    summary="角色详情(含 permissions)",
    dependencies=[permission_required("admin:role:read")],
)
async def get_role(role_id: int):
    tenant_id = require_tenant()
    role = await Role.filter(id=role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.scope != "business" or role.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权访问该角色")
    return SuccessJson(data=await _serialize_role(role, include_perms=True))


@router.post(
    "",
    summary="创建角色(scope 强制为 business,tenant_id 取 context)",
    dependencies=[permission_required("admin:role:write")],
)
async def create_role(dto: RoleCreate):
    tenant_id = require_tenant()

    # unique 校验:(scope, tenant_id, name)
    existing = await Role.filter(scope="business", tenant_id=tenant_id, name=dto.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="同名角色已存在")

    role = await Role.create(
        name=dto.name,
        scope="business",
        tenant_id=tenant_id,
        description=dto.description,
        is_system=False,
        is_builtin=False,
    )
    await audit_service.log(
        action="role.create",
        actor_id=_actor_id(),
        tenant_id=tenant_id,
        resource_type="role",
        resource_id=str(role.id),
        detail={"name": role.name, "description": role.description},
    )
    return SuccessJson(data=await _serialize_role(role, include_perms=True), statusText="已创建")


@router.patch(
    "/{role_id}",
    summary="更新角色 name/description(内置角色拒绝改名)",
    dependencies=[permission_required("admin:role:write")],
)
async def update_role(role_id: int, dto: RoleUpdate):
    tenant_id = require_tenant()
    role = await Role.filter(id=role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.scope != "business" or role.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权修改该角色")

    updates = dto.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="未提供更新字段")

    if "name" in updates and updates["name"] != role.name:
        if role.is_builtin:
            raise HTTPException(status_code=403, detail="内置角色禁止改名")
        # unique 校验
        dup = await Role.filter(
            scope="business", tenant_id=tenant_id, name=updates["name"],
        ).exclude(id=role_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="同名角色已存在")

    for k, v in updates.items():
        setattr(role, k, v)
    await role.save(update_fields=list(updates.keys()))

    await audit_service.log(
        action="role.update",
        actor_id=_actor_id(),
        tenant_id=tenant_id,
        resource_type="role",
        resource_id=str(role.id),
        detail={"updates": updates},
    )
    return SuccessJson(data=await _serialize_role(role, include_perms=True), statusText="已保存")


@router.put(
    "/{role_id}/permissions",
    summary="设置角色的权限列表(整体替换)",
    dependencies=[permission_required("admin:role:write")],
)
async def set_role_permissions(
    role_id: int,
    dto: PermissionsIn,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    tenant_id = require_tenant()
    role = await Role.filter(id=role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.scope != "business" or role.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权修改该角色")

    target_keys = set(dto.permissions)
    invalid = target_keys - set(ALL_PERMISSIONS.keys())
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"未知的权限 key: {sorted(invalid)[:5]}",
        )

    # 取当前 permissions
    current = await role.permissions.all()
    current_keys = {p.key for p in current}
    before_keys = sorted(current_keys)

    # 校验目标 permission 都存在(DB seed 来的,通常都有;补防)
    target_perms = []
    if target_keys:
        target_perms = await Permission.filter(key__in=list(target_keys))
        if len(target_perms) != len(target_keys):
            found = {p.key for p in target_perms}
            missing = target_keys - found
            # 自动补建(seed 应已建,这里兜底,不阻断)
            for k in missing:
                p = await Permission.get(key=k)
                target_perms.append(p)

    # 整体替换
    await role.permissions.clear()
    if target_perms:
        await role.permissions.add(*target_perms)

    affected_users = await _invalidate_role_users_cache(role.id, redis)

    await audit_service.log(
        action="role.permission_change",
        actor_id=_actor_id(),
        tenant_id=tenant_id,
        resource_type="role",
        resource_id=str(role.id),
        detail={
            "before": before_keys,
            "after": sorted(target_keys),
            "affected_users": affected_users,
        },
    )
    return SuccessJson(
        data={"before": before_keys, "after": sorted(target_keys), "affected_users": affected_users},
        statusText=f"已保存 {len(target_keys)} 条权限",
    )


@router.delete(
    "/{role_id}",
    summary="删除角色(内置角色拒绝;级联清理 UserRole)",
    dependencies=[permission_required("admin:role:write")],
)
async def delete_role(
    role_id: int,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    tenant_id = require_tenant()
    role = await Role.filter(id=role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.scope != "business" or role.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权删除该角色")
    if role.is_system:
        raise HTTPException(status_code=403, detail="系统角色禁止删除")

    affected_users = await _invalidate_role_users_cache(role.id, redis)
    # 清理 UserRole 绑定
    await UserRole.filter(role_id=role_id).delete()
    # 清空 M2M
    await role.permissions.clear()
    await role.delete()

    await audit_service.log(
        action="role.delete",
        actor_id=_actor_id(),
        tenant_id=tenant_id,
        resource_type="role",
        resource_id=str(role_id),
        detail={"name": role.name, "affected_users": affected_users},
    )
    return SuccessJson(statusText="已删除")
