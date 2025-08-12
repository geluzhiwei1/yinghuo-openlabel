# Copyright (C) 2025 geluzhiwei.com
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from pydantic import EmailStr
from fastapi import Depends, FastAPI, Body, BackgroundTasks
from redis import asyncio as aioredis

from yinghuo_app.biz.services.user import user_service
from yinghuo_app.biz.db.models import User
from yinghuo_app.dto.login import *
from yinghuo_conf import settings
from yinghuo_app.utils.jwt import create_access_token
from yinghuo_app.utils.password import get_password_hash, verify_password
from yinghuo_app.dto.users import UserCreate, UserRegister, UserRegister2
from ..redis_conf import init_redis_pool
from ..dto.response import SuccessJson, SuccessPage, FailJson
from ..log import logger
from yinghuo_conf.loader import app_settings

router = APIRouter(tags=["登录接口，不需要权限"])


@router.post("/token", summary="获取token")
async def login_access_token(credentials: CredentialsSchema,
        redis: aioredis.Redis = Depends(init_redis_pool)):
    
    # 系统账号
    if app_settings.admin.user == credentials.email:
        logger.info(f"admin user login {app_settings.admin.user}")
    else:
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
                    # return FailJson(statusText="未注册")
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
        
    user: User = await user_service.authenticate(credentials)
    await user_service.update_last_login(user.id)
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + access_token_expires

    data = JWTOut(
        access_token=create_access_token(
            data=JWTPayload(
                user_id=user.id,
                is_superuser=user.is_superuser,
                exp=expire,
            )
        ),
        user_name=user.email if user.email is not None else user.mobile_phone_no,
    )
    return SuccessJson(data=data.model_dump())


@router.post("/config", summary="获取token")
async def config():
    """系统配置
    """
    pass