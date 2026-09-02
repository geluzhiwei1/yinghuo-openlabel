import logging
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, Query, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from redis import asyncio as aioredis
from tortoise import Tortoise

from .users import router as users_router
from .roles import router as roles_router
from .permissions import router as permissions_router
from ..apps.orgs import router as orgs_router
from ..config import settings

from ..log import logger
from ..config import Conf, gConf

redis_pool = None
@asynccontextmanager
async def lifespan(_: FastAPI):
    await Tortoise.init(config=settings.TORTOISE_ORM, _enable_global_fallback=True)
    global redis_pool
    redis_pool = aioredis.from_url(f"{gConf['global']['redis']['uri']}", encoding="utf-8", decode_responses=True)
    yield
    await Tortoise.close_connections()
    await redis_pool.close()

APP_NAME = "admin-app"
app = FastAPI(
    title=APP_NAME,
    description="system admin.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=settings.cors_methods_list,
    allow_headers=settings.cors_headers_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    expose_headers=["admin-token"],
)

api_router = APIRouter(prefix="/api/v1/a")
api_router.include_router(users_router, tags=["users"], prefix="/users")
api_router.include_router(roles_router, tags=["roles"], prefix="/roles")
api_router.include_router(permissions_router, tags=["permissions"], prefix="/permissions")
api_router.include_router(orgs_router, tags=["orgs"], prefix="/orgs")

app.include_router(api_router)

# static file router (optional, skip if directory does not exist)
_static_dir = '/home/work/prods/yinghuo/statics/dist'
import os
if os.path.isdir(_static_dir):
    app.mount('/guis/v0.3.3', StaticFiles(directory=_static_dir))

logger.info(f"Starting {APP_NAME} server...")

if __name__ == "__main__":
    uvicorn.run(app, log_config=None, host="0.0.0.0", port=8111)
