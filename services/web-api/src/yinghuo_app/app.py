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
"""
role rest api
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-08-31"
from dotenv import load_dotenv
load_dotenv()

import time
import jwt
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
from tortoise.contrib.fastapi import register_tortoise

from yinghuo_conf.loader import app_settings

from yinghuo_app.apps.ctx import CTX_USER_ID,CTX_USER_FRESHNESS
from tortoise import Tortoise
from .biz.init_app import init_mongo_indexes, init_user_admin
from yinghuo_conf import settings
from .log import logger
from .apps.init_app import register_exceptions, register_routers
from .middleware.auth import AuthMiddleware
from .middleware.i18n import I18nMiddleware


# Redis 连接池，初始时为 None
redis_pool = None
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_mongo_indexes()
    await Tortoise.init(config=settings.TORTOISE_ORM)
    await Tortoise.generate_schemas()
    await init_user_admin()
    global redis_pool
    try:
        redis_pool = aioredis.from_url(f"{app_settings.global_config.redis.uri}", encoding="utf-8", decode_responses=True)
        # Test Redis connection
        await redis_pool.ping()
        logger.info("Redis connection established successfully")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise
    try:
        yield
    finally:
        await Tortoise.close_connections()
        if redis_pool:
            await redis_pool.close()
            logger.info("Redis connection closed")

APP_NAME = "yinghuo-app"
app = FastAPI(
    title=APP_NAME,
    lifespan=lifespan
)
register_exceptions(app)
register_routers(app)
register_tortoise(
    app,
    config=settings.TORTOISE_ORM,
    generate_schemas=True,
    add_exception_handlers=True,
)

app.add_middleware(
    I18nMiddleware,
    translation_path="src/yinghuo_app/locales"
)
app.add_middleware(AuthMiddleware)

origins = [
    "*"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"Starting {APP_NAME} server...")
