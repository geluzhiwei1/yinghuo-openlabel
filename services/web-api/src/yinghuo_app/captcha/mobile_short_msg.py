import io
import logging
import uuid
from datetime import datetime, timedelta
import random
from fastapi import FastAPI, Request
import base64
import io
import re
import pydash as _
import traceback

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from redis import asyncio as aioredis

from .aliyun_sms import send as send_aliyun_sms
from .database import (
    add_captcha_to_db,
    async_session,
    delete_captcha_from_db,
    get_generated_captcha,
    increment_captcha_validation_counter,
)
from ..redis_conf import init_redis_pool
from ..config import settings
from ..utils.throttle import RateLimitExceeded, rate_limit
from ..log import logger

MAX_VALIDATION_REQUESTS = 3
MAX_DURATION_IN_MINUTES = 10


api_router = APIRouter(prefix="/mobilecode")


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session

@api_router.post(
    "/sendcode/",
    tags=["mobile_msg"],
)
async def sendcode(request: Request, 
        session: AsyncSession = Depends(get_session),
        redis: aioredis.Redis = Depends(init_redis_pool)):
    
    j_req =  await request.json()
    mobile_phone_no =  _.get(j_req, 'mobile_phone_no', None)
    captcha_id =  _.get(j_req, 'captcha_id', None)

    status = 0
    statusText = ""

    # 检查图像验证码
    tag = await redis.get(f'user:capt:{captcha_id}')
    if tag is None:
        status = 1
        statusText = "图像验证码已过期"
        return {
            "status": status,
            "statusText": statusText,
            "data": []
        }

    # 验证是否中国大陆手机号
    match = re.match(r'^1[3-9]\d{9}$', mobile_phone_no)
    if match == None:
        logger.error(f"手机号码不正确: {mobile_phone_no}")
        return {
            "status": 1,
            "statusText": "手机号码不合法。",
            "data": []
        }

    # —— 限频:IP 维度 + 目标维度(60s 内 1 条,每日 10 条)——
    client_ip = request.client.host if request.client else None
    if client_ip:
        try:
            await rate_limit(
                redis,
                f"mobilecode:ip:{client_ip}",
                max_count=settings.CAPTCHA_IP_MAX * 2,
                window_seconds=settings.CAPTCHA_IP_WINDOW_SECONDS,
            )
        except RateLimitExceeded:
            return {
                "status": 429,
                "statusText": "请求过于频繁,请稍后再试",
                "data": []
            }

    try:
        await rate_limit(
            redis,
            f"mobilecode:target:{mobile_phone_no}",
            max_count=settings.CODE_TARGET_MAX,
            window_seconds=settings.CODE_TARGET_WINDOW_SECONDS,
        )
        await rate_limit(
            redis,
            f"mobilecode:daily:{mobile_phone_no}",
            max_count=settings.CODE_DAILY_MAX,
            window_seconds=settings.CODE_DAILY_WINDOW_SECONDS,
        )
    except RateLimitExceeded:
        return {
            "status": 429,
            "statusText": "同一手机号请求过于频繁,请稍后再试",
            "data": []
        }
  
    code_str = "".join(random.choices(
        "1238567890", k=6
    ))

    try:
        if await send_aliyun_sms(code_str, mobile_phone_no):
            logger.info(f"Send short msg. '{code_str}' to {mobile_phone_no}")
            # 记录code对应的phone  5分钟有效
            await redis.set(f'user:capt:msg:{captcha_id}', f'{mobile_phone_no}:{code_str}', ex=60 * 5)
        else:
            logger.error(f"Send short msg failed.")
            status = 1
            statusText = "发送短信失败，请等一下再试。"
    except Exception as e:
        logger.error(f"Error: {e}")
        traceback.print_stack()
        status = 1
        statusText = "发送短信失败时发生异常。"
    finally:
        return {
            "status": status,
            "statusText": statusText,
            "data": []
        }


@api_router.post(
    "/validate/",
    tags=["mobile_msg"],
    description="Validate short msg",
)
async def validate(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    redis: aioredis.Redis = Depends(init_redis_pool)
):
    j_req =  await request.json()
    mobile_phone_no =  _.get(j_req, 'mobile_phone_no', None)
    captcha_id =  _.get(j_req, 'captcha_id', None)
    
    # 验证是否中国大陆手机号
    match = re.match(r'^(\+86)?1[3-9]\d{9}$', mobile_phone_no)
    if match == None:
        logger.error(f"手机号码不正确: {mobile_phone_no}")
        return {
            "status": 1,
            "statusText": "手机号码不合法。",
            "data": []
        }
    user_code_str = _.get(j_req, 'code_str', None)
    if user_code_str is None:
        logger.error(f"用户输入的验证码为空。")
        return {
            "status": 1,
            "statusText": "用户输入的验证码为空",
            "data": []
        }

    cached_code_str = await redis.get(f'user:capt:msg:{captcha_id}') # mobile_phone_no:code_str

    if cached_code_str != f'{mobile_phone_no}:{user_code_str}':
        status = 1
        statusText = "手机验证码错误"
        return {
            "status": status,
            "statusText": statusText,
            "data": []
        }
    else:
        await redis.set(f'user:capt:msg:{mobile_phone_no}', f'{user_code_str}', ex=60 * 5)
        status = 0
        statusText = "手机验证码正确，请登录。"
        return {
            "status": status,
            "statusText": statusText,
            "data": []
        }
