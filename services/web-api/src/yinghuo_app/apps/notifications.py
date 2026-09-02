"""通知路由 /notifications。

挂载:main app,前缀 /api/v1/b/notifications。
权限:business:notification:read|write(默认业务账号都给)。

SSE 端点 GET /notifications/stream:
- 客户端用 EventSource 连接
- 服务端先 push 一段最近 24h 未读事件(防止连上时错过),
  再订阅 Redis pubsub 增量推
- 心跳每 25s 一次(`: keepalive\n\n`),保活防 nginx proxy_read_timeout

REST 端点:
- GET  /notifications           列表(分页,默认最近 50)
- GET  /notifications/unread    返回 unread_count
- POST /notifications/{id}/read 单条标记已读
- POST /notifications/read-all  全部标记已读
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncIterator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from redis import asyncio as aioredis

from ..apps.ctx import CTX_USER_ID, get_current_tenant_id
from ..apps.dependency import permission_required, require_tenant
from ..biz.notification import publisher, store
from ..redis_conf import init_redis_pool


def _require_authed_user() -> int:
    """SSE 路由专用:EventSource 不能设 header,token 走 ?token= 由 app 中间件解码,
    这里直接信任中间件写入的 CTX_USER_ID。REST 端点仍走标准 permission_required。"""
    user_id = CTX_USER_ID.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录(EventSource 需 ?token= 参数)")
    return user_id

router = APIRouter()


# ===== Schemas =====

class NotificationListOut(BaseModel):
    items: list[dict]
    unread: int
    total: int


# ===== SSE stream =====

async def _sse_iter(
    redis: aioredis.Redis, user_id: int,
) -> AsyncIterator[bytes]:
    """订阅 Redis pub/sub,以 SSE 帧格式 yield。

    连上时先把当前 list 中未读的前 50 条倒序(旧→新)flush 出去,
    再监听新事件。
    """
    # 1. flush 历史未读(避免连上时错过)
    try:
        recent = await store.list_recent(redis, user_id, limit=50)
        # recent 是新→旧,需要倒序发出旧→新
        for evt in reversed(recent):
            if not evt.get("read"):
                yield _sse_frame(evt, event=evt.get("type") or "notification")
    except Exception:
        # 历史读失败不阻断 stream
        pass

    # 2. 订阅 pub/sub
    pubsub = redis.pubsub()
    channel = store._channel(user_id)
    await pubsub.subscribe(channel)
    last_heartbeat = datetime.now(timezone.utc)
    try:
        while True:
            # get_message with timeout,避免无限阻塞
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=20.0,
            )
            if msg is not None and msg.get("type") == "message":
                raw = msg.get("data")
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="ignore")
                try:
                    evt = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    continue
                yield _sse_frame(evt, event=evt.get("type") or "notification")

            # 心跳:每 25s 一次,防 nginx proxy_read_timeout(默认 60s)
            now = datetime.now(timezone.utc)
            if (now - last_heartbeat).total_seconds() >= 25:
                yield b": keepalive\n\n"
                last_heartbeat = now
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass


def _sse_frame(payload: dict, event: Optional[str] = None) -> bytes:
    """组装 SSE 帧:id / event / data 各占一行。"""
    lines = []
    if "id" in payload:
        lines.append(f"id: {payload['id']}")
    if event:
        lines.append(f"event: {event}")
    lines.append(f"data: {json.dumps(payload, ensure_ascii=False)}")
    return ("\n".join(lines) + "\n\n").encode("utf-8")


@router.get(
    "/stream",
    summary="SSE 通知流",
)
async def stream(
    request: Request,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    """EventSource 连接。token 走 ?token= 由 app 中间件解码后写入 CTX_USER_ID;
    这里不调 permission_required 因为 EventSource 不能设 Authorization header。
    每客户端连接独立协程,断开时 asyncio.CancelledError 自然传导。"""
    user_id = _require_authed_user()
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")

    async def gen():
        try:
            async for chunk in _sse_iter(redis, user_id):
                if await request.is_disconnected():
                    break
                yield chunk
        except asyncio.CancelledError:
            raise

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 关键:让 nginx 不缓冲 SSE
            "Access-Control-Allow-Origin": "*",
        },
    )


# ===== REST =====

@router.get(
    "",
    summary="通知列表(最近 N 条)",
    dependencies=[permission_required("business:notification:read")],
)
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    _ = require_tenant()
    user_id = CTX_USER_ID.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="当前会话无 user_id")
    items = await store.list_recent(redis, user_id, limit=limit, offset=offset)
    unread = await store.unread_count(redis, user_id)
    return {"items": items, "unread": unread, "total": len(items)}


@router.get(
    "/unread",
    summary="未读数",
    dependencies=[permission_required("business:notification:read")],
)
async def unread_only(
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    _ = require_tenant()
    user_id = CTX_USER_ID.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="当前会话无 user_id")
    return {"unread": await store.unread_count(redis, user_id)}


@router.post(
    "/{event_id}/read",
    summary="单条标记已读",
    dependencies=[permission_required("business:notification:write")],
)
async def mark_one_read(
    event_id: str,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    _ = require_tenant()
    user_id = CTX_USER_ID.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="当前会话无 user_id")
    hit = await store.mark_read(redis, user_id, event_id)
    if not hit:
        raise HTTPException(status_code=404, detail="事件不存在或已读")
    return {"ok": True}


@router.post(
    "/read-all",
    summary="全部标记已读",
    dependencies=[permission_required("business:notification:write")],
)
async def mark_all_read_endpoint(
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    _ = require_tenant()
    user_id = CTX_USER_ID.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="当前会话无 user_id")
    changed = await store.mark_all_read(redis, user_id)
    return {"ok": True, "changed": changed}


# ===== 测试 / 调试用(开发期触发广播) =====

class _TestPushIn(BaseModel):
    type: str = "test"
    title: str = "测试"
    body: str = ""


@router.post(
    "/_test/self",
    summary="[dev] 给自己发一条测试通知",
    dependencies=[permission_required("business:notification:write")],
)
async def test_self_push(
    payload: _TestPushIn,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    """供 e2e / 手动验证 SSE 是否通的入口。生产可关。"""
    tenant_id = require_tenant()
    user_id = CTX_USER_ID.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="当前会话无 user_id")
    evt = await publisher.publish(
        redis,
        tenant_id=tenant_id, user_id=user_id,
        type=payload.type, title=payload.title, body=payload.body,
    )
    return evt
