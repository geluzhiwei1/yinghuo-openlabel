"""JWT 工具:access + refresh 双 token 生成与解码。

设计要点:
- access 与 refresh 都是独立的 JWT,各自有 jti 与 exp
- refresh 通过 Redis 黑名单(jti)支持主动吊销
- access 同样进黑名单,以支持"立即下线"
- ver 字段预留给"改密码后旧 token 全部失效";目前恒为 1,在用户表加 password_changed_at 后启用
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

import jwt

from yinghuo_app.config import settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    *,
    user_id: int,
    is_superuser: bool,
    ver: int = 1,
    tenant_id: str | None = None,
) -> tuple[str, str, int]:
    """返回 (token, jti, expires_in_seconds)"""
    now = _now()
    jti = str(uuid.uuid4())
    expire = now + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    payload = {
        "user_id": user_id,
        "is_superuser": is_superuser,
        "iat": now,
        "exp": expire,
        "jti": jti,
        "ver": ver,
        "token_type": "access",
    }
    if tenant_id:
        payload["tenant_id"] = tenant_id
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, jti, settings.JWT_ACCESS_EXPIRE_MINUTES * 60


def create_refresh_token(
    *,
    user_id: int,
    is_superuser: bool,
    ver: int = 1,
    tenant_id: str | None = None,
) -> tuple[str, str, int]:
    """返回 (token, jti, expires_in_seconds)"""
    now = _now()
    jti = str(uuid.uuid4())
    expire = now + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    payload = {
        "user_id": user_id,
        "is_superuser": is_superuser,
        "iat": now,
        "exp": expire,
        "jti": jti,
        "ver": ver,
        "token_type": "refresh",
    }
    if tenant_id:
        payload["tenant_id"] = tenant_id
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, jti, settings.JWT_REFRESH_EXPIRE_DAYS * 86400


def create_platform_token(*, user_id: int, ver: int = 1) -> tuple[str, str, int]:
    """平台面专用 access token。
    - 仅签发给 is_superuser=True 的平台账号
    - token_type=platform_access,与普通 access/refresh 区分,中间件按类型隔离
    - TTL 由 PLATFORM_TOKEN_TTL_MINUTES 控制(默认 2 小时)
    - 不签发 refresh:平台会话过期后强制重新登录,降低被盗用窗口
    """
    now = _now()
    jti = str(uuid.uuid4())
    ttl_minutes = settings.PLATFORM_TOKEN_TTL_MINUTES
    expire = now + timedelta(minutes=ttl_minutes)
    payload = {
        "user_id": user_id,
        "is_superuser": True,
        "iat": now,
        "exp": expire,
        "jti": jti,
        "ver": ver,
        "token_type": "platform_access",
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, jti, ttl_minutes * 60


def decode_token(token: str) -> dict[str, Any]:
    """解码并校验签名 + 过期。失败抛 jwt 异常。"""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def revoked_key(jti: str) -> str:
    return f"{settings.JWT_REDIS_PREFIX}:{jti}"
