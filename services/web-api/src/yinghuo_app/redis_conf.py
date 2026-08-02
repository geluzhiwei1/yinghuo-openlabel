from redis import asyncio as aioredis
from typing import AsyncIterator
from yinghuo_conf.config import gConf


async def init_redis_pool() -> AsyncIterator[aioredis.Redis]:
    session = aioredis.from_url(f"{gConf['global']['redis']['uri']}", encoding="utf-8", decode_responses=True)
    yield session
    await session.close()