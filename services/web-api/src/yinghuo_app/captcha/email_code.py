import io
import logging
import uuid
from datetime import datetime, timedelta
import random
from fastapi import FastAPI, Request
import emails
from emails.template import JinjaTemplate as T
import base64
import io
import re
import pydash as _
import traceback

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from redis import asyncio as aioredis


from .captcha import Captcha
from .database import (
    add_captcha_to_db,
    async_session,
    delete_captcha_from_db,
    get_generated_captcha,
    increment_captcha_validation_counter,
)
from .schemas import CaptchaValidationRequest, CaptchaValidationResponse
from ..redis_conf import init_redis_pool
from ..biz.services.user import user_service
from ..config import settings
from ..utils.throttle import RateLimitExceeded, rate_limit
from ..utils.email_config import get_smtp_config, get_mail_from
from ..log import logger

MAX_VALIDATION_REQUESTS = 3
MAX_DURATION_IN_MINUTES = 10



api_router = APIRouter(prefix="/emailcode")


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
        
def pillow_image_to_base64_string(img):
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

MAIL_CONTENT = """
<html>
<body>
该邮件为自动发送，请勿回复。
<br/>
若该邮件并非源自您的请求，请忽略。
<br/>
您的<b>验证码ID</b>: {{ captcha_id_1 }}-<span style="color:red">{{ captcha_id_2 }}</span>-{{ captcha_id_3 }}
<br/>
您的<b>验证码（6位数字的图片）</b>：<img src="data:image/jpeg;base64,{{ image_b64_str }}">
<br/>
本次验证码一次有效，有效期为<b>30分钟</b>，请在有效期内完成验证。
</body>
</html>
"""

def send_email(captcha:Captcha, captcha_id:tuple, to_email: str):
    
    image_b64_str = pillow_image_to_base64_string(captcha.image)
    
    m = emails.html(html=T(MAIL_CONTENT),
                    subject=T("邮箱验证码"),
                    mail_from=get_mail_from())
    temp = io.BytesIO()
    captcha.image.save(temp, format="png")
    m.attach(data=temp.getvalue(), filename="captcha.png", content_disposition="inline")

    captcha_id_1, captcha_id_2, captcha_id_3 = captcha_id
    response = m.send(render={"captcha_id_1": captcha_id_1, "captcha_id_2": captcha_id_2, "captcha_id_3": captcha_id_3, "image_b64_str": image_b64_str},
                    to=to_email,
                    smtp=get_smtp_config())
    logger.debug(response)
    if response.status_code not in [250, ]:
        return False
    else:
        return True

@api_router.post(
    "/sendcode/",
    tags=["emailcode"],
)
async def sendcode(request: Request, session: AsyncSession = Depends(get_session),
        redis: aioredis.Redis = Depends(init_redis_pool)):

    status = 0
    statusText = ""
    captcha_id = ""

    j_req =  await request.json()
    to_email =  _.get(j_req, 'mail', None)
    captchaId = _.get(j_req, 'captchaId', None)

    # —— 限频:IP 维度(防止同 IP 大量枚举邮箱刷邮件)——
    client_ip = request.client.host if request.client else None
    if client_ip:
        try:
            await rate_limit(
                redis,
                f"emailcode:ip:{client_ip}",
                max_count=settings.CAPTCHA_IP_MAX * 2,
                window_seconds=settings.CAPTCHA_IP_WINDOW_SECONDS,
            )
        except RateLimitExceeded as e:
            return {
                "status": 429,
                "statusText": "请求过于频繁,请稍后再试",
                "data": []
            }

    match = re.match('^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$', to_email)
    if match == None:
        logger.error(f"Invalid email address: {to_email}")
        return {
            "status": 1,
            "statusText": "邮箱格式不正确",
            "data": []
        }

    # —— 限频:目标维度(同邮箱 60s 内 1 条,每日 10 条)——
    if to_email:
        try:
            await rate_limit(
                redis,
                f"emailcode:target:{to_email}",
                max_count=settings.CODE_TARGET_MAX,
                window_seconds=settings.CODE_TARGET_WINDOW_SECONDS,
            )
            await rate_limit(
                redis,
                f"emailcode:daily:{to_email}",
                max_count=settings.CODE_DAILY_MAX,
                window_seconds=settings.CODE_DAILY_WINDOW_SECONDS,
            )
        except RateLimitExceeded:
            return {
                "status": 429,
                "statusText": "同一邮箱请求过于频繁,请稍后再试",
                "data": []
            }
  
    if captchaId is not None:
        # 说明在重置密码，此时需要检查email是否存在
        u = await user_service.get_by_email(to_email)
        if u is None:
            return {
                "status": 2,
                "statusText": "该邮箱不存在",
                "data": []
            }
    
    code_str = "".join(random.choices(
        "1234567890", k=6
    ))

    try:
        captcha = Captcha(text=code_str, width=300, height=150)
        captcha_bytes = io.BytesIO()

        captcha.image.save(captcha_bytes, format="png", compress_level=3)
        captcha_bytes.seek(0)

        # TODO 用一定格式生成captcha_id，方便验证
        captcha_id = str(uuid.uuid4())

        await add_captcha_to_db(session, captcha_id, captcha.text, to_email)
        
        fields = captcha_id.split("-")
        captcha_id_1 = fields[0]
        captcha_id_2 = fields[1]
        captcha_id_3 = "-".join(fields[2:])
    
        if send_email(captcha, (captcha_id_1, captcha_id_2, captcha_id_3), to_email):
            logger.debug(f"Send email. '{captcha.text}' with id {captcha_id}")
            # 记录code对应的email
            await redis.set(f'user:capt:email:{captcha_id}', to_email, ex=60 * 30)
        else:
            logger.error(f"Send email failed. '{captcha.text}' with id {captcha_id}")
    except Exception as e:
        logger.error(f"Error: {e}")
        traceback.print_stack()
        status = 1
        statusText = "Unknow error when send e-mail."
    finally:
        return {
            "status": status,
            "statusText": statusText,
            "data": [captcha_id_1, captcha_id_3]
        }


@api_router.post(
    "/validate/",
    tags=["emailcode"],
    description="Validate a previously generated CAPTCHA",
    response_model=CaptchaValidationResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "CAPTCHA to validate not found",
            "model": CaptchaValidationResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": status.HTTP_404_NOT_FOUND,
                        "message": "CAPTCHA to validate not found",
                    }
                }
            },
        },
        status.HTTP_200_OK: {
            "description": "CAPTCHA validated successfully",
            "model": CaptchaValidationResponse,
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "CAPTCHA validation failed",
            "model": CaptchaValidationResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": status.HTTP_400_BAD_REQUEST,
                        "message": "CAPTCHA validation failed",
                    }
                }
            },
        },
    },
)
async def validate_captcha(
    response: Response,
    validation_request: CaptchaValidationRequest,
    session: AsyncSession = Depends(get_session),
    redis: aioredis.Redis = Depends(init_redis_pool)
):
    existing_captcha = await get_generated_captcha(session, validation_request.id)

    if (
        existing_captcha
        and existing_captcha.timestamp + timedelta(minutes=MAX_DURATION_IN_MINUTES)
        <= datetime.utcnow()
    ):
        await delete_captcha_from_db(session, existing_captcha)
        existing_captcha = None

    if not existing_captcha:
        response.status_code = status.HTTP_404_NOT_FOUND
        return CaptchaValidationResponse(
            status=response.status_code, message="CAPTCHA to validate not found"
        )

    tx = validation_request.text.lower()
    if tx == existing_captcha.text.lower():
        # Make CAPTCHA validation case insensitive.
        await delete_captcha_from_db(session, existing_captcha)
        
        await redis.set(f'user:capt:{validation_request.id}', tx, ex=60 * MAX_DURATION_IN_MINUTES)
        logger.debug(f"Captcha validation success: {validation_request.id}={tx}")
        
        response.status_code = status.HTTP_200_OK
        return CaptchaValidationResponse(
            status=response.status_code, message="CAPTCHA validated successfully"
        )
    else:
        await increment_captcha_validation_counter(session, existing_captcha)
        if existing_captcha.validation_counter >= MAX_VALIDATION_REQUESTS:
            await delete_captcha_from_db(session, existing_captcha)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return CaptchaValidationResponse(
            status=response.status_code, message="CAPTCHA validation failed"
        )
