"""Redis 分布式锁。

实现:SET key token NX EX ttl 进入;Lua 脚本比对 token 后 DEL 退出,避免误删别人的锁。
失败抛 WorkflowBusy,业务层转 409。
"""
import secrets
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

from redis import asyncio as aioredis


class WorkflowBusy(Exception):
    """同一资源正被另一会话锁定。"""
    def __init__(self, key: str):
        self.key = key
        super().__init__(f"resource busy: {key}")


_RELEASE_SCRIPT = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""


@asynccontextmanager
async def redis_lock(
    redis: Optional[aioredis.Redis],
    key: str,
    *,
    ttl: int = 30,
) -> AsyncIterator[None]:
    """redis=None 时降级为无锁(便于无 redis 环境/单测使用)。
    生产路径必须传真实 redis 连接。
    """
    if redis is None:
        yield
        return
    token = secrets.token_hex(16)
    ok = await redis.set(key, token, nx=True, ex=ttl)
    if not ok:
        raise WorkflowBusy(key)
    try:
        yield
    finally:
        try:
            await redis.eval(_RELEASE_SCRIPT, 1, key, token)
        except Exception:
            # 锁本身有 TTL,释放失败不阻塞业务;记日志由调用方决定
            pass
