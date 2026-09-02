"""Stage 8 通知合成服务。

不建独立 Notification 表;直接从 AuditLog 按 action + 关联用户合成。
"关联用户"判断:
- actor_id == user_id(用户自己操作产生的副本,如自己改密码)
- OR detail.assignee_id == user_id(任务被分配)
- OR detail.reviewer_id == user_id(任务被指派审核)

已读状态用 Redis SET 保存 audit_id(30 天 TTL)。
"""
from __future__ import annotations

from typing import Optional

from redis import asyncio as aioredis
from tortoise.expressions import Q

from ..db.models import AuditLog


NOTIFY_ACTIONS: dict[str, str] = {
    "workflow.submit": "审核结果",
    "workflow.instantiate": "任务分配",
    "user.password_change": "账号安全",
    "role.grant": "角色授予",
    "role.revoke": "角色撤销",
    "user.locked": "账号锁定",
    "project.update": "项目变更",
    "project.archive": "项目归档",
}


READ_SET_TTL = 30 * 86400  # 30 天


class NotificationError(Exception):
    pass


class NotificationService:

    def _read_key(self, user_id: int) -> str:
        return f"notif:read:{user_id}"

    async def list_for_user(
        self, *, user_id: int, tenant_id: Optional[str],
        unread_only: bool,
        page: int, page_size: int,
        redis: Optional[aioredis.Redis],
    ) -> dict:
        if tenant_id is None:
            # 通知需要租户上下文(否则跨租户泄露);未绑定返空
            return {"items": [], "page": page, "page_size": page_size, "total": 0}

        # tortoise JSON 字段不能用 detail__contains={"k": v} 路径过滤,
        # 先按 action + 关联条件查;assignee/reviewer 过滤放到内存里。
        qs = AuditLog.filter(
            tenant_id=tenant_id,
            action__in=list(NOTIFY_ACTIONS.keys()),
        ).order_by("-created_at")

        total = await qs.count()
        # 拉一段稍大的窗口(因为还要在内存里二次过滤)
        scan_limit = min(total, page * page_size * 4, 1000)
        rows = await qs.limit(scan_limit)

        read_set = await self._load_read_set(user_id, redis)
        items = []
        for r in rows:
            if not self._concerns_user(r, user_id):
                continue
            is_read = r.id in read_set
            if unread_only and is_read:
                continue
            items.append({
                "id": r.id,
                "action": r.action,
                "summary": NOTIFY_ACTIONS.get(r.action, r.action),
                "detail": r.detail,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "created_at": r.created_at,
                "is_read": is_read,
            })
            if len(items) >= page_size:
                break

        start = (page - 1) * page_size
        page_items = items[start:] if start < len(items) else []
        return {
            "items": page_items,
            "page": page, "page_size": page_size,
            "total": len(items),
        }

    async def unread_count(
        self, *, user_id: int, tenant_id: Optional[str],
        redis: Optional[aioredis.Redis],
    ) -> int:
        if tenant_id is None:
            return 0
        qs = AuditLog.filter(
            tenant_id=tenant_id,
            action__in=list(NOTIFY_ACTIONS.keys()),
        )
        # 滑动窗口近 500 条;通知本质是时效性,旧的也无所谓
        rows = await qs.order_by("-created_at").limit(500)
        read_set = await self._load_read_set(user_id, redis)
        count = 0
        for r in rows:
            if not self._concerns_user(r, user_id):
                continue
            if r.id in read_set:
                continue
            count += 1
        return count

    async def mark_read(
        self, *, user_id: int, audit_id: int,
        redis: Optional[aioredis.Redis],
    ) -> None:
        if redis is None:
            return
        key = self._read_key(user_id)
        await redis.sadd(key, str(audit_id))
        await redis.expire(key, READ_SET_TTL)

    def _concerns_user(self, audit: AuditLog, user_id: int) -> bool:
        if audit.actor_id == user_id:
            return True
        detail = audit.detail or {}
        for k in ("assignee_id", "reviewer_id", "user_id", "target_user_id"):
            v = detail.get(k)
            if v == user_id:
                return True
        return False

    async def _load_read_set(self, user_id: int, redis: Optional[aioredis.Redis]) -> set[int]:
        if redis is None:
            return set()
        members = await redis.smembers(self._read_key(user_id))
        out: set[int] = set()
        for m in members:
            try:
                out.add(int(m))
            except (TypeError, ValueError):
                continue
        return out


notification_service = NotificationService()
