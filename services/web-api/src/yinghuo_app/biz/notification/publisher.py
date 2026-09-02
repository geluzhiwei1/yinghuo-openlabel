"""事件类型常量 + 发布助手(供业务侧 wire-in 使用)。

调用方传 Redis 实例(已经在路由中以 Depends(init_redis_pool) 拿到),
这里只做 schema 包装和写入。
"""
from __future__ import annotations

from typing import Optional

from redis.asyncio import Redis

from . import store

# ===== Event types =====

INSTANCE_APPROVED = "instance.approved"   # 我的提交被审核通过(可进入下个 stage)
INSTANCE_REJECTED = "instance.rejected"   # 我的提交被打回(回到 reject_action 目标 stage)
INSTANCE_STUCK = "instance.stuck"         # 我负责的 instance 在我手里停留超过阈值
INSTANCE_ASSIGNED = "instance.assigned"   # 我被加入某个 anno_job 的协作者
PERMISSION_CHANGED = "permission.changed"  # 我的角色/平台权限被管理员改了


async def publish(
    redis: Redis, *,
    tenant_id: str, user_id: int,
    type: str, title: str, body: str,
    data: Optional[dict] = None,
) -> dict:
    """构造事件并写入 Redis;返回事件对象(供调用方日志/扩展)。"""
    event = store.make_event(
        type=type, title=title, body=body,
        tenant_id=tenant_id, user_id=user_id, data=data,
    )
    await store.push(redis, event)
    return event


async def publish_workflow_event(
    redis: Redis, *,
    tenant_id: str, user_id: int,
    instance_id: int, unit_id: Optional[int],
    stage_code: str, decision: str,
    reason: Optional[str] = None,
) -> dict:
    """工作流 submit 后,通知"instance 当前 assignee"。

    decision="approve" → instance.approved(我的活通过了)
    decision="reject"  → instance.rejected(被打回上家或返回我手上)

    user_id 是接收者 id;调用方自行决定给谁(通常 engine 决定)。
    """
    if decision == "approve":
        type_ = INSTANCE_APPROVED
        title = "审核通过"
        body = f"Instance #{instance_id} 已通过 stage「{stage_code}」"
    else:
        type_ = INSTANCE_REJECTED
        title = "审核打回"
        body = f"Instance #{instance_id} 在 stage「{stage_code}」被打回"
        if reason:
            body += f":{reason}"
    return await publish(
        redis,
        tenant_id=tenant_id, user_id=user_id,
        type=type_, title=title, body=body,
        data={
            "instance_id": instance_id,
            "unit_id": unit_id,
            "stage_code": stage_code,
            "decision": decision,
            "reason": reason,
        },
    )


async def publish_assignment(
    redis: Redis, *,
    tenant_id: str, user_id: int,
    job_id: str, by_user_id: int,
) -> dict:
    """被加为 anno_job 协作者。job_id 是 Mongo _id 字符串。"""
    return await publish(
        redis,
        tenant_id=tenant_id, user_id=user_id,
        type=INSTANCE_ASSIGNED, title="新任务分配",
        body=f"你已被加入任务 {job_id}",
        data={"job_id": job_id, "by_user_id": by_user_id},
    )


async def publish_permission_change(
    redis: Redis, *,
    tenant_id: str, user_id: int,
    summary: str,
    added: Optional[list[int]] = None,
    removed: Optional[list[int]] = None,
    is_active: Optional[bool] = None,
    is_superuser: Optional[bool] = None,
) -> dict:
    """角色 / 状态被管理员改了。summary 是给 user 看的中文一句话。"""
    return await publish(
        redis,
        tenant_id=tenant_id, user_id=user_id,
        type=PERMISSION_CHANGED, title="权限变更",
        body=summary,
        data={
            "added": added or [],
            "removed": removed or [],
            "is_active": is_active,
            "is_superuser": is_superuser,
        },
    )
