"""通用滑动窗口限频工具。第一次 incr 时设置 expire;超出阈值抛 RateLimitExceeded。"""
from redis import asyncio as aioredis


class RateLimitExceeded(Exception):
    def __init__(self, key: str, retry_after: int, max_count: int):
        self.key = key
        self.retry_after = max(1, retry_after)
        self.max_count = max_count
        super().__init__(f"rate limit exceeded: key={key} max={max_count}")


async def rate_limit(
    redis: aioredis.Redis,
    key: str,
    *,
    max_count: int,
    window_seconds: int,
) -> int:
    """返回当前窗口内的计数;超出阈值抛 RateLimitExceeded。

    用法:
        try:
            await rate_limit(redis, f"captcha:ip:{ip}", max_count=5, window_seconds=60)
        except RateLimitExceeded as e:
            return JSONResponse({"detail": "请求过于频繁"}, status_code=429,
                                headers={"Retry-After": str(e.retry_after)})
    """
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, window_seconds)
    if count > max_count:
        ttl = await redis.ttl(key)
        raise RateLimitExceeded(key, ttl if ttl > 0 else window_seconds, max_count)
    return count
