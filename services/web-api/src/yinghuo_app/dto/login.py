from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CredentialsSchema(BaseModel):
    username: Optional[str] = Field(None, description="用户名", example="admin")
    email: str = Field(None, description="邮箱", example="admin@admin.com", max_length=100)
    password: str = Field(None, description="密码", example="123456", max_length=32)
    captchaId: Optional[str] = None
    captchaText: Optional[str] = None
    mobile_phone_no: Optional[str] = None
    accountType: Optional[str] = None
    useMobileMsgCode: Optional[bool] = False


class JWTPayload(BaseModel):
    user_id: int
    is_superuser: bool
    exp: datetime
    iat: datetime | None = None
    jti: str | None = None
    ver: int = 1
    token_type: str = "access"  # access / refresh


class JWTOut(BaseModel):
    access_token: str
    refresh_token: str
    user_name: str
    expires_in: int  # access token 有效期(秒)


class RefreshIn(BaseModel):
    refresh_token: str = Field(..., description="refresh token")


class LogoutIn(BaseModel):
    """可选传入 refresh_token,登出时一并吊销"""
    refresh_token: Optional[str] = None
