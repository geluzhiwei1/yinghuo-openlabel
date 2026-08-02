import contextvars
from typing import Optional

from starlette.background import BackgroundTasks

CTX_USER_ID: contextvars.ContextVar[int] = contextvars.ContextVar("user_id", default=0)
CTX_USER_FRESHNESS: contextvars.ContextVar[int] = contextvars.ContextVar("freshness", default=0)
CTX_BG_TASKS: contextvars.ContextVar[BackgroundTasks] = contextvars.ContextVar("bg_task", default=None)
CTX_TENANT_ID: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("tenant_id", default=None)


def get_current_tenant_id() -> Optional[str]:
    """service 层读当前请求的 tenant_id。
    None 表示当前会话不绑定租户(平台账号或尚未初始化)。
    """
    return CTX_TENANT_ID.get()
