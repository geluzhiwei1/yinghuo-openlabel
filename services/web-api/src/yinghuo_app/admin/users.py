"""租户内用户管理(管理面 admin app)。

挂载:admin app,前缀 /api/v1/a/users。
权限:
- read 类端点要求 admin:user:read
- write 类端点要求 admin:user:write

租户隔离:所有UserRole绑定用 require_tenant() 返回的 tenant_id。
审计:user.create / update / delete / password_reset 全写审计日志。
缓存:role_ids 变更后调用 invalidate_user_permissions。
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from redis import asyncio as aioredis

from ..apps.ctx import CTX_USER_ID, get_current_tenant_id
from ..apps.dependency import permission_required, require_tenant
from ..biz.db.models import Role, User, UserRole
from ..biz.notification import publisher
from ..biz.rbac.resolver import invalidate_user_permissions
from ..biz.services.audit import audit_service
from ..biz.services.user import user_service
from ..dto.response import SuccessJson, SuccessPage
from ..log import logger
from ..redis_conf import init_redis_pool

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _actor_id() -> Optional[int]:
    """从上下文取 actor_id;平台账号或未登录场景为 None。"""
    uid = CTX_USER_ID.get()
    try:
        return int(uid) if uid is not None else None
    except (TypeError, ValueError):
        return None


# —— Schemas ———————————————————————————————

class Pager(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=200)


class SearchFields(BaseModel):
    email: Optional[str] = None
    mobile_phone_no: Optional[str] = None
    name: Optional[str] = None


class Search(BaseModel):
    pager: Pager = Field(default_factory=Pager)
    query: SearchFields = Field(default_factory=SearchFields)


class UserCreate(BaseModel):
    email: EmailStr = Field(..., example="user@example.com")
    name: Optional[str] = Field(None, max_length=128)
    mobile_phone_no: Optional[str] = Field(None, max_length=32)
    password: str = Field(..., min_length=6, max_length=128)
    role_ids: list[int] = Field(default_factory=list)
    is_active: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    mobile_phone_no: Optional[str] = None
    is_active: Optional[bool] = None
    role_ids: Optional[list[int]] = None


class ResetPasswordIn(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)


# —— Helpers ———————————————————————————————

async def _user_roles(user_id: int) -> list[dict]:
    """取 user 的所有 role,返回 [{id, name, scope}]。
    UserRole 没有 FK 关系,手工二次查 Role。"""
    urs = await UserRole.filter(user_id=user_id)
    if not urs:
        return []
    rids = [ur.role_id for ur in urs]
    roles = await Role.filter(id__in=rids)
    rmap = {r.id: r for r in roles}
    out = []
    for ur in urs:
        r = rmap.get(ur.role_id)
        if r:
            out.append({"id": r.id, "name": r.name, "scope": r.scope})
    return out


async def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": None,  # User 模型当前无 name 字段;由前端容错处理
        "mobile_phone_no": user.mobile_phone_no,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "roles": await _user_roles(user.id),
        "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else None,
    }


async def _set_user_roles(user_id: int, role_ids: list[int], tenant_id: str) -> tuple[set[int], set[int]]:
    """把 user 的 role 列表设为 role_ids(在 tenant 内)。返回 (added, removed) id 集合。"""
    current = await UserRole.filter(user_id=user_id, tenant_id=tenant_id)
    current_role_ids = {ur.role_id for ur in current}
    target = set(role_ids)

    # 校验 role 存在且属于此 tenant(或 builtin business scope)
    valid_roles: dict[int, Role] = {}
    if target:
        rows = await Role.filter(id__in=list(target))
        for r in rows:
            valid_roles[r.id] = r

    added: set[int] = set()
    removed: set[int] = set()

    # 删除:current 中不在 target
    for ur in current:
        if ur.role_id not in target:
            await ur.delete()
            removed.add(ur.role_id)

    # 新增:target 中不在 current
    for rid in target:
        if rid in current_role_ids:
            continue
        if rid not in valid_roles:
            continue
        await UserRole.create(
            user_id=user_id, role_id=rid, tenant_id=tenant_id,
            granted_by=_actor_id(),
        )
        added.add(rid)

    return added, removed


# —— 端点 ———————————————————————————————

@router.post(
    "/search",
    summary="租户内用户列表(分页 + 过滤)",
    dependencies=[permission_required("admin:user:read")],
)
async def search_users(search: Search):
    tenant_id = require_tenant()

    qs = User.filter(deleted_at__isnull=True)
    if search.query.email:
        qs = qs.filter(email__icontains=search.query.email)
    if search.query.mobile_phone_no:
        qs = qs.filter(mobile_phone_no__icontains=search.query.mobile_phone_no)
    # name 字段目前 User 模型没有,忽略过滤(前端会传,但不报错)

    # 只返此 tenant 内的 user:通过 UserRole 关联过滤
    user_ids = await UserRole.filter(tenant_id=tenant_id).distinct().values_list("user_id", flat=True)
    if not user_ids:
        return SuccessPage(data=[], total=0, page=search.pager.page, page_size=search.pager.page_size)
    qs = qs.filter(id__in=list(user_ids))

    total = await qs.count()
    rows = (
        await qs.order_by("-id")
        .offset((search.pager.page - 1) * search.pager.page_size)
        .limit(search.pager.page_size)
    )
    items = [await _serialize_user(u) for u in rows]
    return SuccessPage(data=items, total=total, page=search.pager.page, page_size=search.pager.page_size)


@router.post(
    "",
    summary="创建租户内用户",
    dependencies=[permission_required("admin:user:write")],
)
async def create_user(
    dto: UserCreate,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    tenant_id = require_tenant()

    existing = await user_service.get_by_email(dto.email)
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被使用")

    # 注:User 模型当前只有 email/mobile/password 字段,name 丢弃;mobile 写入
    from ..dto.users import UserCreate as LegacyUserCreate
    legacy = LegacyUserCreate(
        email=dto.email,
        mobile_phone_no=dto.mobile_phone_no,
        password=dto.password,
        is_active=dto.is_active,
    )
    new_user = await user_service.create_user(obj_in=legacy)
    # 数据目录 + 默认 Mongo 角色(legacy)
    try:
        await user_service.process_after_create(new_user)
    except Exception as e:
        logger.warning(f"user {new_user.id} process_after_create failed (continued): {e}")

    added: set[int] = set()
    role_ids = list(dto.role_ids) if dto.role_ids else []
    # 若未指定角色,自动绑到 builtin annotator(scope=business),让新用户至少能登录进业务面 +
    # 出现在 tenant 用户列表(列表按 UserRole.tenant_id 过滤)
    if not role_ids:
        annotator = await Role.filter(scope="business", name="annotator", is_builtin=True).first()
        if annotator:
            role_ids = [annotator.id]
    if role_ids:
        added, _ = await _set_user_roles(new_user.id, role_ids, tenant_id)
        await invalidate_user_permissions(new_user.id, redis)

    await audit_service.log(
        action="user.create",
        actor_id=_actor_id(),
        tenant_id=tenant_id,
        resource_type="user",
        resource_id=str(new_user.id),
        detail={"email": new_user.email, "role_ids_added": sorted(added)},
    )
    return SuccessJson(data=await _serialize_user(new_user), statusText="创建成功")


@router.patch(
    "/{user_id}",
    summary="更新用户(name / mobile / is_active / role_ids 任一子集)",
    dependencies=[permission_required("admin:user:write")],
)
async def update_user(
    user_id: int,
    dto: UserUpdate,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    tenant_id = require_tenant()
    user = await User.filter(id=user_id, deleted_at__isnull=True).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    updates = dto.model_dump(exclude_unset=True)
    role_changes: Optional[dict] = None

    if "is_active" in updates:
        user.is_active = updates["is_active"]
    if "mobile_phone_no" in updates and updates["mobile_phone_no"] is not None:
        user.mobile_phone_no = updates["mobile_phone_no"]
    # name 当前模型不支持,忽略

    save_fields = [k for k in ("is_active", "mobile_phone_no") if k in updates]
    if save_fields:
        await user.save(update_fields=save_fields)

    if "role_ids" in updates and updates["role_ids"] is not None:
        added, removed = await _set_user_roles(user_id, updates["role_ids"], tenant_id)
        await invalidate_user_permissions(user_id, redis)
        role_changes = {"added": sorted(added), "removed": sorted(removed)}

        # Stage 12.2:通知 user 权限已变更(best-effort,失败只 log)
        if added or removed:
            parts = []
            if added:
                parts.append(f"新增 {len(added)} 个角色")
            if removed:
                parts.append(f"移除 {len(removed)} 个角色")
            try:
                await publisher.publish_permission_change(
                    redis, tenant_id=tenant_id, user_id=user_id,
                    summary="、".join(parts),
                    added=sorted(added), removed=sorted(removed),
                )
            except Exception as e:
                logger.warning(f"notif perm change publish failed (user={user_id}): {e}")

    await audit_service.log(
        action="user.update",
        actor_id=_actor_id(),
        tenant_id=tenant_id,
        resource_type="user",
        resource_id=str(user_id),
        detail={"updates": updates, "role_changes": role_changes},
    )
    return SuccessJson(data=await _serialize_user(user), statusText="已保存")


@router.post(
    "/{user_id}/reset-password",
    summary="管理员重置用户密码",
    dependencies=[permission_required("admin:user:write")],
)
async def reset_password(
    user_id: int,
    dto: ResetPasswordIn,
):
    require_tenant()
    try:
        await user_service.reset_password(user_id, dto.new_password)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"重置失败: {e}")

    await audit_service.log(
        action="user.password_reset",
        actor_id=_actor_id(),
        tenant_id=get_current_tenant_id(),
        resource_type="user",
        resource_id=str(user_id),
        detail={},
    )
    return SuccessJson(statusText="密码已重置")


@router.delete(
    "/{user_id}",
    summary="软删除用户",
    dependencies=[permission_required("admin:user:write")],
)
async def delete_user(
    user_id: int,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    tenant_id = require_tenant()
    user = await User.filter(id=user_id, deleted_at__isnull=True).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.is_superuser:
        raise HTTPException(status_code=403, detail="不允许删除超级用户")

    now = _utcnow()
    user.is_active = False
    user.deleted_at = now
    await user.save(update_fields=["is_active", "deleted_at"])

    # 撤销该 user 在此 tenant 内的所有 UserRole
    removed_roles = await UserRole.filter(
        user_id=user_id, tenant_id=tenant_id,
    ).delete()

    await invalidate_user_permissions(user_id, redis)

    await audit_service.log(
        action="user.delete",
        actor_id=_actor_id(),
        tenant_id=tenant_id,
        resource_type="user",
        resource_id=str(user_id),
        detail={"removed_role_bindings": removed_roles},
    )
    return SuccessJson(statusText="已删除")


# —— 老接口兼容(login_as)— 保留,但加 admin:user:write gate ———————————————————

class LoginAS(BaseModel):
    email: EmailStr = Field(..., example="admin@qq.com")
    user_id: int


@router.post(
    "/login_as",
    summary="虚拟登录(代行)",
    dependencies=[permission_required("admin:user:write")],
)
async def login_as(dto: LoginAS):
    """代行登录:发一个普通 user 的 access token,便于管理员排查用户问题。"""
    from ..utils.jwt import create_access_token

    tenant_id = get_current_tenant_id()
    access_token, _, _ = create_access_token(
        user_id=dto.user_id,
        is_superuser=False,
        tenant_id=tenant_id,
    )
    return SuccessJson(data={"access_token": access_token, "user_name": dto.email, "email": dto.email})
