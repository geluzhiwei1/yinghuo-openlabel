"""审计日志服务。

设计要点:
- 所有写入 fail-safe:审计写失败不能阻塞业务,仅记 error 日志
- `log_from_request` 从 FastAPI Request 提取 ip / user_agent,简化调用方
- `actor_id` 可空(用户不存在但仍要记录失败尝试)
"""
from typing import Any, Optional

from fastapi import Request

from ...log import logger
from ..db.models import AuditLog


class AuditService:

    async def log(
        self,
        *,
        action: str,
        actor_id: Optional[int] = None,
        tenant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        detail: Optional[dict[str, Any]] = None,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        try:
            await AuditLog.create(
                actor_id=actor_id,
                tenant_id=tenant_id,
                action=action,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id is not None else None,
                detail=detail or {},
                ip=ip,
                user_agent=(user_agent[:512] if user_agent else None),
            )
        except Exception as e:  # noqa: BLE001
            logger.error(f"audit log write failed: action={action} actor={actor_id} err={e!r}")

    async def log_from_request(
        self,
        request: Request,
        *,
        action: str,
        actor_id: Optional[int] = None,
        tenant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        detail: Optional[dict[str, Any]] = None,
    ) -> None:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
        await self.log(
            action=action,
            actor_id=actor_id,
            tenant_id=tenant_id,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
            ip=ip,
            user_agent=ua,
        )


audit_service = AuditService()
