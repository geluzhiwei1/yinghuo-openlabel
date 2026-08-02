from datetime import datetime, timedelta, timezone

import jwt as jwt_lib
from fastapi import APIRouter, Header, Request
from pydantic import EmailStr
from fastapi import Depends, FastAPI, Body, BackgroundTasks, HTTPException
from redis import asyncio as aioredis

from yinghuo_app.biz.services.user import user_service
from yinghuo_app.biz.services.audit import audit_service
from yinghuo_app.biz.db.models import User
from yinghuo_app.dto.login import (
    CredentialsSchema, JWTOut, RefreshIn, LogoutIn,
)
from ..config import settings
from yinghuo_app.utils.jwt import (
    create_access_token, create_refresh_token, decode_token, revoked_key,
)
from yinghuo_app.utils.password import get_password_hash, verify_password
from yinghuo_app.dto.users import UserCreate, UserRegister, UserRegister2
from ..redis_conf import init_redis_pool
from ..dto.response import SuccessJson, SuccessPage, FailJson
from ..log import logger

router = APIRouter(tags=["登录接口，不需要权限"])


async def _revoke_jti(redis: aioredis.Redis, jti: str, ttl_seconds: int) -> None:
    """把 jti 加入黑名单,TTL = 剩余有效期。TTL <= 0 时跳过(已过期,自然失效)。"""
    if ttl_seconds <= 0 or not jti:
        return
    await redis.setex(revoked_key(jti), ttl_seconds, "1")


async def _is_revoked(redis: aioredis.Redis, jti: str) -> bool:
    if not jti:
        return False
    return bool(await redis.exists(revoked_key(jti)))


@router.post("/token", summary="获取token")
async def login_access_token(
    request: Request,
    credentials: CredentialsSchema,
    redis: aioredis.Redis = Depends(init_redis_pool),
):

    # 需要的话，直接注册
    if credentials.accountType == '1':
        # 手机号登录
        if credentials.useMobileMsgCode:
            # 使用手机验证码登录
            tag = await redis.get(f'user:capt:msg:{credentials.mobile_phone_no}')
            if tag is None:
                return FailJson(statusText="手机验证码已过期")

            # 是否注册过
            user = await user_service.get_by_mobile(credentials.mobile_phone_no)
            if user is None:
                # 默认密码是手机号码后 6 位
                credentials.password = credentials.mobile_phone_no[-6:]
                user = await user_service.register_mobile_phone_user(UserRegister2(
                    password=credentials.password,
                    mobile_phone_no=credentials.mobile_phone_no
                ))
            if user is None:
                return FailJson(statusText="未注册或者创建失败")

    if credentials.accountType == '2' \
        or (credentials.accountType == '1' and (not credentials.useMobileMsgCode)):
        # 经过验证码了吗
        tag = await redis.get(f'user:capt:{credentials.captchaId}')
        logger.info(f'user:capt:{credentials.captchaId} = {tag}')
        if tag is None:
            return FailJson(statusText="图像验证码已过期")

    user: User = None
    try:
        user = await user_service.authenticate(
            credentials, redis=redis, client_ip=request.client.host if request.client else None,
        )
    except HTTPException as he:
        # 审计登录失败(账号可能不存在 → actor_id=None)
        account = credentials.email or credentials.mobile_phone_no
        await audit_service.log_from_request(
            request,
            action="user.login_failed",
            detail={
                "account": account,
                "account_type": credentials.accountType,
                "status_code": he.status_code,
                "detail": he.detail,
            },
        )
        raise

    await user_service.update_last_login(user.id)
    await user_service.reset_login_fail_count(user.id, redis=redis)
    await audit_service.log_from_request(
        request,
        action="user.login_success",
        actor_id=user.id,
        detail={"account_type": credentials.accountType},
    )

    # 推导登录后的当前租户:用户首个非 null tenant 的角色;超级用户无 tenant
    from yinghuo_app.biz.db.models import UserRole
    tenant_role = await UserRole.filter(user_id=user.id, tenant_id__not_isnull=True).first()
    login_tenant_id = tenant_role.tenant_id if tenant_role else None

    access_token, _, expires_in = create_access_token(
        user_id=user.id, is_superuser=user.is_superuser, tenant_id=login_tenant_id,
    )
    refresh_token, refresh_jti, refresh_ttl = create_refresh_token(
        user_id=user.id, is_superuser=user.is_superuser, tenant_id=login_tenant_id,
    )
    # 把 refresh jti 记入"已签发"集合,仅用于审计(可选)
    await redis.setex(f"jwt:jti:issued:refresh:{refresh_jti}", refresh_ttl, user.id)

    data = JWTOut(
        access_token=access_token,
        refresh_token=refresh_token,
        user_name=user.email if user.email is not None else user.mobile_phone_no,
        expires_in=expires_in,
    )
    return SuccessJson(data=data.model_dump())


@router.post("/refresh", summary="刷新 access token")
async def refresh_token(
    payload: RefreshIn,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    try:
        claims = decode_token(payload.refresh_token)
    except jwt_lib.ExpiredSignatureError:
        return FailJson(status=401, statusText="refresh token 已过期,请重新登录")
    except jwt_lib.PyJWTError:
        return FailJson(status=401, statusText="无效的 refresh token")

    if claims.get("token_type") != "refresh":
        return FailJson(status=401, statusText="token 类型错误")
    jti = claims.get("jti")
    if not jti:
        return FailJson(status=401, statusText="token 缺少 jti")

    if await _is_revoked(redis, jti):
        return FailJson(status=401, statusText="refresh token 已被吊销")

    user_id = claims.get("user_id")
    user = await user_service.get(id=user_id)
    if not user or not user.is_active:
        return FailJson(status=401, statusText="用户不存在或已禁用")

    # 旋转:旧 refresh 进黑名单(剩余 TTL),签发新 access + 新 refresh
    exp = claims.get("exp")
    remaining = max(0, int(exp - datetime.now(timezone.utc).timestamp())) if exp else 0
    await _revoke_jti(redis, jti, remaining)

    refresh_tenant_id = claims.get("tenant_id")
    access_token, _, expires_in = create_access_token(
        user_id=user.id, is_superuser=user.is_superuser, tenant_id=refresh_tenant_id,
    )
    new_refresh, new_jti, new_ttl = create_refresh_token(
        user_id=user.id, is_superuser=user.is_superuser, tenant_id=refresh_tenant_id,
    )
    await redis.setex(f"jwt:jti:issued:refresh:{new_jti}", new_ttl, user.id)

    data = JWTOut(
        access_token=access_token,
        refresh_token=new_refresh,
        user_name=user.email if user.email is not None else user.mobile_phone_no,
        expires_in=expires_in,
    )
    return SuccessJson(data=data.model_dump())


@router.post("/logout", summary="登出(吊销当前会话)")
async def logout(
    request: Request,
    payload: LogoutIn | None = None,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    """从 Authorization 头取 access,从 body 可选取 refresh;把对应 jti 全部进黑名单。"""
    revoked_any = False
    actor_id = None

    authz = request.headers.get("Authorization", "")
    if authz.startswith("Bearer "):
        access = authz.split(" ", 1)[1].strip()
        try:
            acc_claims = decode_token(access)
            if acc_claims.get("token_type") == "access":
                acc_jti = acc_claims.get("jti")
                acc_exp = acc_claims.get("exp")
                ttl = max(0, int(acc_exp - datetime.now(timezone.utc).timestamp())) if acc_exp else 0
                await _revoke_jti(redis, acc_jti, ttl)
                actor_id = acc_claims.get("user_id")
                revoked_any = True
        except jwt_lib.PyJWTError:
            pass  # token 已无效,直接当作已登出

    if payload and payload.refresh_token:
        try:
            ref_claims = decode_token(payload.refresh_token)
            if ref_claims.get("token_type") == "refresh":
                ref_jti = ref_claims.get("jti")
                ref_exp = ref_claims.get("exp")
                ttl = max(0, int(ref_exp - datetime.now(timezone.utc).timestamp())) if ref_exp else 0
                await _revoke_jti(redis, ref_jti, ttl)
                revoked_any = True
        except jwt_lib.PyJWTError:
            pass

    if revoked_any and actor_id:
        await audit_service.log_from_request(request, action="user.logout", actor_id=actor_id)

    return SuccessJson(statusText="已登出" if revoked_any else "无 token,无操作")


@router.post("/reset-password", summary="重置密码")
async def reset_password(
    request: Request,
    req_in: CredentialsSchema,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    k = f'user:capt:email:{req_in.captchaId}'
    email2 = await redis.get(k)
    if req_in.email != email2:
        redis.delete(k)
        return FailJson(statusText="Token错误，请刷新页面重试")

    user = await user_service.get_by_email(req_in.email)
    if not user:
        return FailJson(statusText="用户不存在")
    if req_in.password is None or len(req_in.password) < settings.PASSWORD_MIN_LENGTH:
        return FailJson(statusText=f"密码长度不正确,至少 {settings.PASSWORD_MIN_LENGTH} 位")
    user.password = get_password_hash(req_in.password)
    user.password_changed_at = datetime.now(timezone.utc)
    await user.save(update_fields=["password", "password_changed_at"])
    await audit_service.log_from_request(
        request,
        action="user.password_reset",
        actor_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
    )
    return SuccessJson(statusText="密码重置成功")


@router.post("/register", summary="注册用户")
async def create_user(user_in: UserRegister):
    user = await user_service.get_by_email(user_in.email)
    if user:
        return FailJson(status=400, statusText="该邮箱已经被使用")
    await user_service.register_user(user_in)
    return SuccessJson(statusText="注册成功")


@router.post("/config", summary="获取token")
async def config():
    """系统配置"""
    pass
