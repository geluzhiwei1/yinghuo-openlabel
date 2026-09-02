"""权限解析器。

设计要点:
- 权限"生效集合"= 用户所有 UserRole 关联 Role 的 permissions 并集
- 超级用户(is_superuser=True)直接返回 "*" 通配,跳过查询
- 通配规则:owned 含 `face:*` 命中该面任意 key;含 `face:resource:*` 命中该资源任意 action
- 缓存走 Redis,key 形如 `rbac:perms:user:{uid}`,TTL 5 分钟;权限/角色变更时由调用方主动失效
"""
from __future__ import annotations

from typing import Iterable

from redis import asyncio as aioredis

from ...config import settings
from ..db.models import Permission, Role, User, UserRole

CACHE_KEY_TMPL = "rbac:perms:user:{uid}"
CACHE_TTL_SECONDS = 300


def _expand_wildcards(perms: Iterable[str]) -> set[str]:
    """把 `face:*` / `face:resource:*` 展开成显式 key 集合,方便精确比较。

    另外应用一条约定:`face:resource:write` 蕴含 `face:resource:read`,
    `face:resource:manage` 蕴含 write+read。便于路由级用单一 :write 权限覆盖 GET+POST。
    """
    expanded: set[str] = set()
    for p in perms:
        expanded.add(p)
        parts = p.split(":")
        if len(parts) == 3:
            face, resource, action = parts
            if action in ("write", "manage"):
                expanded.add(f"{face}:{resource}:read")
            if action == "manage":
                expanded.add(f"{face}:{resource}:write")
        for i in range(1, len(parts)):
            expanded.add(":".join(parts[:i]) + ":*")
    return expanded


def has_permission(owned: Iterable[str], required: str) -> bool:
    """required 必须是显式 key(`face:resource:action`)。
    owned 中的通配符 * 在此处理,不依赖外部展开。
    """
    owned_set = set(owned)
    if "*" in owned_set or required in owned_set:
        return True
    parts = required.split(":")
    for i in range(1, len(parts)):
        if ":".join(parts[:i]) + ":*" in owned_set:
            return True
    return False


async def compute_user_permissions(user: User) -> set[str]:
    """从 DB 拉取用户的全部有效权限 key(未缓存)。
    返回的集合已展开通配符,可直接用 `required in perms` 比较。
    """
    if user.is_superuser:
        return {"*"}

    user_roles = await UserRole.filter(user_id=user.id)
    if not user_roles:
        return set()
    role_ids = [ur.role_id for ur in user_roles]
    roles = await Role.filter(id__in=role_ids)
    perms: set[str] = set()
    for role in roles:
        role_perms = await role.permissions.all()
        for p in role_perms:
            perms.add(p.key)
    return _expand_wildcards(perms)


async def get_user_permissions_cached(
    user: User,
    redis: aioredis.Redis | None,
) -> set[str]:
    """带 Redis 缓存的版本。无 redis 时直接落 DB。"""
    if user.is_superuser:
        return {"*"}

    cache_key = CACHE_KEY_TMPL.format(uid=user.id)
    if redis is not None:
        cached = await redis.smembers(cache_key)
        if cached:
            return set(cached)

    perms = await compute_user_permissions(user)

    if redis is not None and perms:
        # sadd + expire,保证 TTL 不被刷新前缀积压
        pipe = redis.pipeline()
        pipe.delete(cache_key)
        pipe.sadd(cache_key, *perms)
        pipe.expire(cache_key, CACHE_TTL_SECONDS)
        await pipe.execute()

    return perms


async def invalidate_user_permissions(user_id: int, redis: aioredis.Redis) -> None:
    """角色/权限变更后调用,主动失效缓存。"""
    await redis.delete(CACHE_KEY_TMPL.format(uid=user_id))


async def get_user_role_names(user: User) -> set[str]:
    """返回用户的所有 role name 集合(用于 stage assignee_source 角色匹配)。

    superuser 返回 {"*"},调用方按「通配命中」处理。
    跨 scope 全收:business / admin / platform 都返回,由调用方自己筛。
    """
    if user.is_superuser:
        return {"*"}
    user_roles = await UserRole.filter(user_id=user.id)
    if not user_roles:
        return set()
    role_ids = [ur.role_id for ur in user_roles]
    roles = await Role.filter(id__in=role_ids)
    return {r.name for r in roles}
