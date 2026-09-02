from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, Request
from redis import asyncio as aioredis

from yinghuo_app.apps.ctx import CTX_USER_ID, CTX_TENANT_ID, get_current_tenant_id
from yinghuo_app.biz.db.models import User
from yinghuo_app.biz.rbac.resolver import get_user_permissions_cached, has_permission
from ..config import settings
from ..redis_conf import init_redis_pool


class AuthControl:
    @classmethod
    async def is_authed(
        cls,
        authorization: Optional[str] = Header(None, alias="Authorization", description="Bearer <jwt>"),
        token: Optional[str] = Header(None, description="token 验证(裸 JWT,向后兼容"),
        request: Request = None,
    ) -> Optional["User"]:
        # 优先 Authorization: Bearer <jwt>;回退到裸 token header;最后兜底 URL ?token=
        raw = None
        if authorization and authorization.lower().startswith("bearer "):
            raw = authorization.split(" ", 1)[1].strip()
        elif token:
            raw = token
        elif request is not None:
            raw = request.query_params.get("token")
        if not raw:
            raise HTTPException(status_code=401, detail="未提供凭证")
        try:
            decode_data = jwt.decode(raw, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            # 只接受 access token 通过 dependency
            if decode_data.get("token_type", "access") != "access":
                raise HTTPException(status_code=401, detail="Token 类型错误")
            user_id = decode_data.get("user_id")
            user = await User.filter(id=user_id).first()
            if not user:
                raise HTTPException(status_code=401, detail="Authentication failed")
            CTX_USER_ID.set(int(user_id))
            # 租户上下文:依赖侧兜底设置(用于 admin/业务面路由);
            # 主 app 已在中间件中提前设置,这里是 no-op。
            tenant_id = decode_data.get("tenant_id")
            CTX_TENANT_ID.set(tenant_id)
            return user
        except jwt.DecodeError:
            raise HTTPException(status_code=401, detail="无效的Token")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="登录已过期")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"{repr(e)}")


class PermissionControl:
    @classmethod
    async def has_permission(
        cls,
        required_key: str,
        current_user: User = Depends(AuthControl.is_authed),
        redis: aioredis.Redis = Depends(init_redis_pool),
    ) -> User:
        """权限检查入口。返回 user 便于链式依赖读取。
        超级用户直通;否则从缓存或 DB 拉取有效权限集合并匹配 required_key。
        """
        if current_user.is_superuser:
            return current_user
        perms = await get_user_permissions_cached(current_user, redis)
        if not has_permission(perms, required_key):
            raise HTTPException(
                status_code=403,
                detail=f"权限不足,需要 {required_key}",
            )
        return current_user


def permission_required(required_key: str):
    """路由级声明式权限依赖。

    用法:
        @router.get("/users", dependencies=[permission_required("admin:user:read")])
        async def list_users(...): ...

        # 或作为参数依赖,拿到当前 user
        async def list_users(user: User = permission_required("admin:user:read")):
            ...
    """
    async def _dep(
        current_user: User = Depends(AuthControl.is_authed),
        redis: aioredis.Redis = Depends(init_redis_pool),
    ) -> User:
        return await PermissionControl.has_permission(
            required_key, current_user=current_user, redis=redis,
        )
    return Depends(_dep)


def require_tenant() -> str:
    """业务面路由必备依赖:从当前上下文取 tenant_id,无则 400。
    超级用户若无 tenant_id 也拒(平台账号走 platform BFF,不应混用)。
    """
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="当前会话未绑定租户;请重新登录或切换租户",
        )
    return tenant_id


DependTenant = Depends(require_tenant)
DependAuth = Depends(AuthControl.is_authed)
