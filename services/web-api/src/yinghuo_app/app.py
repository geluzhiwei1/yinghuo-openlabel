"""
role rest api
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-08-31"

import time
import jwt
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Response, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from redis import asyncio as aioredis

from .config import Conf, gConf

from yinghuo_app.apps.ctx import CTX_USER_ID,CTX_USER_FRESHNESS,CTX_TENANT_ID
from tortoise import Tortoise
from .biz.init_app import init_mongo_indexes, init_mongo_collections, init_user_admin
from .biz.rbac.seed import seed_rbac
from .biz.workflow.seed import seed_builtin_workflows
from .biz.dev_seed import seed_dev_data
from .biz.data_migrations import apply_data_migrations
from yinghuo_app.config import settings
from .log import logger
from .apps.init_app import register_exceptions, register_routers
from .edition import HAS_EE, HAS_SAAS

if HAS_EE:
    from .ee.platform.metrics import setup_metrics
if HAS_SAAS:
    from .saas.platform.seed import seed_platform_data



# Redis 连接池，初始时为 None
redis_pool = None


async def _init_captcha_sqlite() -> None:
    """captcha 模块用 SQLite 存验证码记录,原本在 captcha/main.py 的 lifespan 里建表。
    合并进主 app 后,这里手动调一次 create_all。
    """
    from .captcha.database import Base, engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("captcha sqlite tables ready")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_mongo_collections()
    await init_mongo_indexes()
    await Tortoise.init(config=settings.TORTOISE_ORM, _enable_global_fallback=True)
    await Tortoise.generate_schemas()
    await init_user_admin()
    await seed_rbac()
    await seed_builtin_workflows()
    if HAS_SAAS:
        await seed_platform_data()
    else:
        await seed_dev_data()
    await apply_data_migrations()
    await _init_captcha_sqlite()
    global redis_pool
    redis_pool = aioredis.from_url(f"{gConf['global']['redis']['uri']}", encoding="utf-8", decode_responses=True)
    yield
    await Tortoise.close_connections()
    await redis_pool.close()

APP_NAME = "yinghuo-app"
app = FastAPI(
    title=APP_NAME,
    lifespan=lifespan
)
register_exceptions(app)
register_routers(app)

if HAS_EE:
    # EE 增量:Prometheus 指标,GET /metrics
    setup_metrics(app)

@app.middleware("http")
async def request_middleware(request, call_next): # , cur_user: User=Depends(current_user), user_manager: UserManager = Depends(get_user_manager)
    
    async def call_next_and_log(user_id=''):
        start_time = time.time()
        response = await call_next(request)
        path = request.url.path
        method = request["method"]
        host = request.client.host + ":" + str(request.client.port)
        process_time = time.time() - start_time
        response.headers["X-Biz-Time"] = str(process_time)
        
        logger.info(f"user: {user_id}, host: {host}, path: {path}, method: {method}, process_time: {process_time}")
        
        return response
    # if gConf['global']['mode'] == 'dev' and (request.client.host == "127.0.0.1" \
    #     or request.client.host.startswith("192.168.") \
    #     or request.client.host.startswith("10.8.")):
    #     # test user
    #     CTX_USER_ID.set(3)
    #     return await call_next_and_log()
    
    if request.url.path.startswith("/u/"):
        if request.url.path in ['/u/a/noau/token', '/u/a/noau/register', '/u/a/noau/reset-password']:
            captchs_id = request.headers.get('X-Captcha-Id')
            if captchs_id is None:
                return Response(content="Require captcha", status_code=status.HTTP_401_UNAUTHORIZED)
            else:
                # r = await init_redis_pool()
                text = await redis_pool.get(f'user:capt:{captchs_id}')
                if text is None:
                    return Response(content="Captcha expired", status_code=status.HTTP_401_UNAUTHORIZED)
                # await redis_pool.delete(f'user:capt:{captchs_id}')
                return await call_next_and_log()
        else:
            return await call_next_and_log()

    # captcha / email / sms 验证码相关:登录前调用,不需要 token
    if request.url.path.startswith("/api/v1/c/captcha") \
            or request.url.path.startswith("/api/v1/c/emailcode") \
            or request.url.path.startswith("/api/v1/c/mobilecode"):
        return await call_next_and_log()

    # 平台面 /api/v1/p/* 自带 PlatformAuthControl 依赖,只接受 platform_access token。
    # 这里若再走 access-token 校验会把 platform_access 当 "Wrong token type" 拒掉,
    # 所以整段跳过,把鉴权完全交给 platform router 的 dependency。
    if request.url.path.startswith("/api/v1/p/"):
        return await call_next_and_log()
        
    # 其他接口，需要验证token
    bearer_token = None
    header_token = request.headers.get('Authorization')
    if header_token and 'Bearer' in header_token:
        # 从header中获取token
        fields = header_token.split(' ')
        if len(fields) == 2:
            bearer_token = fields[1].strip()
    else:
        # 从参数中获取token
        if 'token' in request.query_params:
            bearer_token = request.query_params['token']
        
    if bearer_token:
        try:
            decode_data = jwt.decode(bearer_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            user_id = decode_data.get("user_id")
            jti = decode_data.get("jti")
            # 黑名单检查(登出 / refresh 旋转后的 jti)
            if jti and redis_pool and await redis_pool.exists(f"{settings.JWT_REDIS_PREFIX}:{jti}"):
                return Response(content="Token revoked", status_code=status.HTTP_401_UNAUTHORIZED)
            # 只接受 access token 通过中间件;refresh 仅 /u/a/noau/refresh 使用
            if decode_data.get("token_type", "access") != "access":
                return Response(content="Wrong token type", status_code=status.HTTP_401_UNAUTHORIZED)
            CTX_USER_ID.set(int(user_id))
            # 租户上下文:从 JWT claim 提取,无 claim 时为 None(平台账号或登录未绑定租户)
            tenant_id = decode_data.get("tenant_id")
            CTX_TENANT_ID.set(tenant_id)

            freshness = request.headers.get('freshness')
            if freshness is None:
                CTX_USER_FRESHNESS.set(0)
            else:
                CTX_USER_FRESHNESS.set(int(freshness))

        except Exception as e:
            logger.error(f"decode jwt error, token: {bearer_token}, err: {e}")
            return Response(content="", status_code=status.HTTP_401_UNAUTHORIZED)
    else:
        return Response(content="", status_code=status.HTTP_401_UNAUTHORIZED)

    return await call_next_and_log(user_id=user_id)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.cors_methods_list,
    allow_headers=settings.cors_headers_list,
)

logger.info(f"Starting {APP_NAME} server...")
