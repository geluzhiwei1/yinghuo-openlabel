"""Redis 后端:每用户 list + pub/sub channel。

Key 设计:
- list   `notif:user:{user_id}`  — 最近 MAX_KEEP 条事件(LPUSH + LTRIM)
- pubsub `notif:pubsub:user:{user_id}` — 新事件即时推

为什么不用 hash / sorted set:
- list 的 LPUSH+LTRIM 是 O(1) 截断,语义"最近 N 条"贴 MVP 场景;
- 已读态变更直接 LSET 整条 JSON,不维护额外索引。
"""
from __future__ import annotations

import json
import time
import uuid
from typing import Optional

from redis.asyncio import Redis

MAX_KEEP = 100  # 每用户保留 100 条


def _list_key(user_id: int) -> str:
    return f"notif:user:{user_id}"


def _channel(user_id: int) -> str:
    return f"notif:pubsub:user:{user_id}"


def _now_iso() -> str:
    # ISO 8601 UTC,带 Z 后缀;前端 new Date(s) 直接吃
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def make_event(
    *, type: str, title: str, body: str,
    tenant_id: str, user_id: int,
    data: Optional[dict] = None,
) -> dict:
    """构造事件对象;不写入存储。"""
    return {
        "id": f"evt_{uuid.uuid4().hex[:12]}",
        "type": type,
        "title": title,
        "body": body,
        "tenant_id": tenant_id,
        "user_id": user_id,
        "data": data or {},
        "created_at": _now_iso(),
        "read": False,
    }


async def push(redis: Redis, event: dict) -> dict:
    """写入 list(LPUSH+LTRIM)并 PUBLISH 给在线连接。"""
    user_id = event["user_id"]
    raw = json.dumps(event, ensure_ascii=False)
    pipe = redis.pipeline()
    pipe.lpush(_list_key(user_id), raw)
    pipe.ltrim(_list_key(user_id), 0, MAX_KEEP - 1)
    pipe.publish(_channel(user_id), raw)
    await pipe.execute()
    return event


async def list_recent(
    redis: Redis, user_id: int,
    *, limit: int = 50, offset: int = 0,
) -> list[dict]:
    """按时间倒序取最近事件(LPUSH 后 0 是最新)。"""
    raw_list = await redis.lrange(_list_key(user_id), offset, offset + limit - 1)
    out = []
    for raw in raw_list:
        try:
            out.append(json.loads(raw))
        except (json.JSONDecodeError, TypeError):
            continue
    return out


async def unread_count(redis: Redis, user_id: int) -> int:
    """扫 list 数 read=False;MAX_KEEP 上限 100,O(N) 可接受。"""
    items = await list_recent(redis, user_id, limit=MAX_KEEP)
    return sum(1 for e in items if not e.get("read"))


async def mark_read(redis: Redis, user_id: int, event_id: str) -> bool:
    """单条标记已读;返回是否命中。"""
    key = _list_key(user_id)
    raw_list = await redis.lrange(key, 0, MAX_KEEP - 1)
    for idx, raw in enumerate(raw_list):
        try:
            evt = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        if evt.get("id") == event_id and not evt.get("read"):
            evt["read"] = True
            await redis.lset(key, idx, json.dumps(evt, ensure_ascii=False))
            return True
    return False


async def mark_all_read(redis: Redis, user_id: int) -> int:
    """批量标记已读;返回变更条数。"""
    key = _list_key(user_id)
    raw_list = await redis.lrange(key, 0, MAX_KEEP - 1)
    changed = 0
    for idx, raw in enumerate(raw_list):
        try:
            evt = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        if not evt.get("read"):
            evt["read"] = True
            await redis.lset(key, idx, json.dumps(evt, ensure_ascii=False))
            changed += 1
    return changed
