#!/usr/bin/env python3

import io
import logging
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, Response
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
from ..config import settings
from ..utils.throttle import RateLimitExceeded, rate_limit

MAX_VALIDATION_REQUESTS = 3
MAX_DURATION_IN_MINUTES = 5

from ..log import logger

api_router = APIRouter(prefix="/captcha")


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session


@api_router.post(
    "/generate/",
    tags=["captcha"],
    description="Generate a new CAPTCHA",
    response_class=Response,
    responses={
        status.HTTP_200_OK: {
            "description": "CAPTCHA generated successfully",
            "content": {"image/png": {}},
        },
    },
)
async def generate_captcha(
    request: Request,
    session: AsyncSession = Depends(get_session),
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    client_ip = request.client.host if request.client else None
    if client_ip:
        try:
            await rate_limit(
                redis,
                f"captcha:gen:ip:{client_ip}",
                max_count=settings.CAPTCHA_IP_MAX,
                window_seconds=settings.CAPTCHA_IP_WINDOW_SECONDS,
            )
        except RateLimitExceeded as e:
            return JSONResponse(
                {"detail": "请求过于频繁,请稍后再试"},
                status_code=429,
                headers={"Retry-After": str(e.retry_after)},
            )

    captcha = Captcha(width=300, height=100)
    captcha_bytes = io.BytesIO()

    captcha.image.save(captcha_bytes, format="png", compress_level=3)
    captcha_bytes.seek(0)

    captcha_id = str(uuid.uuid4())

    await add_captcha_to_db(session, captcha_id, captcha.text)

    logger.debug(f"New CAPTCHA for string '{captcha.text}' with id {captcha_id}")

    return Response(
        media_type="image/png",
        content=captcha_bytes.getvalue(),
        headers={
            "Captcha-Id": captcha_id,
        },
    )


@api_router.post(
    "/validate/",
    tags=["captcha"],
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
        response.status_code = status.HTTP_200_OK
        
        # 验证成功后，将验证码存储到redis中，保持5分钟
        await redis.set(f'user:capt:{validation_request.id}', tx, ex=60 * 5)
        logger.warning(f'user:capt:{validation_request.id} = {tx}')
        
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
