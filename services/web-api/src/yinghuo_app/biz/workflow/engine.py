"""工作流引擎核心。

submit 流程:
1. 帧级锁(redis_lock on wf:unit:{unit_id})
2. 加载 instance + unit + 模板
3. assert_assignee:按 stage.kind 检查权限
4. 写 StageRun 到 stage_history,StageVote 投影
5. 评估下一 stage(含 quorum、仲裁、抽样跳过)
6. 事务内更新 instance + unit
7. 审计(fail-safe)

设计取舍:
- 抽样在 stage 入口判定(_enter_stage),sample_review 跳过时直接快进到下一 stage
- multi-review 用 quorum 控制投票池大小;满 quorum 后判定共识,意见冲突进 arbitrate
- arbitrate stage 必须显式 submit,不做自动仲裁
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from redis import asyncio as aioredis
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from ...apps.ctx import get_current_tenant_id
from ...log import logger
from ..db.models import Unit, Workflow, WorkflowInstance, StageVote
from ..rbac.resolver import get_user_permissions_cached, has_permission
from ..services.audit import audit_service
from .lock import redis_lock
from .sampler import should_sample
from .spec import (
    Decision,
    RejectReason,
    Stage,
    StageRun,
    WorkflowSpec,
)


# stage kind → 所需 permission key(按 decision 分支)
PERM_FOR_KIND = {
    "annotate": "business:label:write",
    "review": "business:review:approve",  # reject 单独检查
    "sample_review": "business:review:approve",
    "arbitrate": "business:review:approve",
}


class WorkflowError(Exception):
    """工作流引擎内部错误,转 400。"""


@dataclass
class AuthCtx:
    user_id: int
    tenant_id: str
    is_superuser: bool


class WorkflowEngine:
    """无状态单例。所有状态在 DB。"""

    async def instantiate(
        self,
        *,
        workflow_id: int,
        unit_id: int,
        actor_id: int,
        redis: Optional[aioredis.Redis] = None,
    ) -> WorkflowInstance:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise WorkflowError("当前会话未绑定租户")

        wf = await Workflow.filter(
            Q(id=workflow_id)
            & (Q(tenant_id=tenant_id) | Q(tenant_id=None, is_builtin=True))
        ).first()
        if not wf:
            raise WorkflowError(f"workflow {workflow_id} 不存在")

        unit = await Unit.filter(tenant_id=tenant_id, id=unit_id).first()
        if not unit:
            raise WorkflowError(f"unit {unit_id} 不存在")

        # 同一 unit 不能重复挂实例(除非上一个已结束)
        existing = await WorkflowInstance.filter(
            tenant_id=tenant_id, unit_id=unit_id,
            current_status__in=["pending", "in_progress", "arbitrate"],
        ).exists()
        if existing:
            raise WorkflowError(f"unit {unit_id} 已有进行中的工作流实例")

        spec = WorkflowSpec(stages=wf.stages)
        first = spec.stages[0]

        async with in_transaction():
            inst = await WorkflowInstance.create(
                tenant_id=tenant_id,
                project_id=unit.project_id,
                unit_id=unit.id,
                workflow_id=wf.id,
                workflow_version_id=wf.current_version_id,
                current_stage=first.code,
                current_status="in_progress",
                stage_history=[],
                sample_skipped=False,
                migration_log=[],
            )
            unit.current_stage = first.code
            unit.stage_status = "in_progress"
            await unit.save(update_fields=["current_stage", "stage_status", "updated_at"])
            await self._enter_stage(inst, unit, spec, first, redis=redis, is_initial=True)

        await audit_service.log(
            action="workflow.instantiate",
            actor_id=actor_id, tenant_id=tenant_id,
            resource_type="workflow_instance", resource_id=str(inst.id),
            detail={"workflow_id": wf.id, "unit_id": unit.id, "stage": first.code},
        )
        return inst

    async def submit(
        self,
        *,
        instance_id: int,
        decision: Decision,
        reason: Optional[RejectReason],
        actor: AuthCtx,
        redis: Optional[aioredis.Redis] = None,
    ) -> WorkflowInstance:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise WorkflowError("当前会话未绑定租户")

        inst = await WorkflowInstance.filter(
            tenant_id=tenant_id, id=instance_id,
        ).first()
        if not inst:
            raise WorkflowError(f"instance {instance_id} 不存在")
        if inst.current_status in ("approved", "rejected"):
            raise WorkflowError("实例已结束,不可再推进")

        unit = await Unit.filter(tenant_id=tenant_id, id=inst.unit_id).first()
        if not unit:
            raise WorkflowError(f"unit {inst.unit_id} 不存在(数据不一致)")

        wf = await Workflow.filter(
            Q(id=inst.workflow_id)
            & (Q(tenant_id=tenant_id) | Q(tenant_id=None, is_builtin=True))
        ).first()
        if not wf:
            raise WorkflowError("工作流模板已删除")
        spec = WorkflowSpec(stages=wf.stages)
        stage = spec.stage_by_code(inst.current_stage)
        if stage is None:
            raise WorkflowError(f"current_stage {inst.current_stage} 不在模板中(模板已变更?)")

        async with redis_lock(redis, f"wf:unit:{unit.id}", ttl=30):
            await self._assert_assignee(stage, decision, actor, redis=redis)

            # 同一 actor 不可在同一 stage 重复投票(multi-review 场景)
            if stage.pass_condition.mode != "any":
                voted = any(
                    r.get("stage_code") == stage.code and r.get("actor_id") == actor.user_id
                    for r in (inst.stage_history or [])
                )
                if voted:
                    raise WorkflowError(f"actor {actor.user_id} 已在 stage {stage.code} 投过票")

            now = datetime.utcnow()
            run = StageRun(
                stage_code=stage.code,
                actor_id=actor.user_id,
                started_at=now,  # 简化:用 now 当 started
                finished_at=now,
                decision=decision,
                reject_reason=reason,
            )
            history = list(inst.stage_history or [])
            history.append(run.model_dump(mode="json"))
            inst.stage_history = history

            # 扁平投影,便于后续 stratified/adaptive 查询
            await StageVote.create(
                tenant_id=tenant_id,
                workflow_id=wf.id,
                instance_id=inst.id,
                stage_code=stage.code,
                actor_id=actor.user_id,
                decision=decision,
                reject_category=reason.category if reason else None,
                reject_severity=reason.severity if reason else None,
            )

            next_stage_code = await self._evaluate(stage, spec, inst, decision, redis=redis)

            async with in_transaction():
                if next_stage_code is None and stage.kind == "accept":
                    # 兜底路径:已停在 accept 但仍 in_progress(理论上 _enter_stage 已处理)
                    inst.current_status = "approved"
                    unit.stage_status = "done"
                    unit.current_stage = stage.code
                    inst.current_stage = stage.code
                elif next_stage_code is None:
                    # hold(reject_action=hold 或 quorum 未满)
                    inst.current_status = "in_progress"
                else:
                    next_stage = spec.stage_by_code(next_stage_code)
                    if next_stage is None:
                        raise WorkflowError(f"下一 stage {next_stage_code} 在模板中找不到")
                    inst.current_stage = next_stage.code
                    # arbitrate stage 用 'arbitrate' 状态显式区分,便于查询/权限判断
                    inst.current_status = (
                        "arbitrate" if next_stage.kind == "arbitrate" else "in_progress"
                    )
                    unit.current_stage = next_stage.code
                    # _enter_stage 可能进一步推进(accept 自动完成 / sample_review 跳过)
                    # 传 prev_stage 用于 load_aware 减载时识别旧 pool
                    await self._enter_stage(
                        inst, unit, spec, next_stage, redis=redis,
                        is_initial=False, prev_stage=stage,
                    )
                # 统一持久化:_enter_stage 可能改了 unit.stage_status / current_stage /
                # assignee_id / reviewer_id(stage 切换自动派单),以及 inst 状态字段
                await unit.save(update_fields=[
                    "current_stage", "stage_status", "assignee_id",
                    "reviewer_id", "updated_at",
                ])
                await inst.save(update_fields=[
                    "current_stage", "current_status", "stage_history",
                    "sample_skipped", "updated_at",
                ])

        await audit_service.log(
            action="workflow.submit",
            actor_id=actor.user_id, tenant_id=tenant_id,
            resource_type="workflow_instance", resource_id=str(inst.id),
            detail={
                "stage": stage.code, "decision": decision,
                "next_stage": inst.current_stage, "status": inst.current_status,
                "reject_category": reason.category if reason else None,
                # Stage 8:通知合成用,关联当前 unit 的归属
                "unit_id": unit.id,
                "assignee_id": unit.assignee_id,
                "reviewer_id": unit.reviewer_id,
            },
        )

        # Stage 12:best-effort 通知 unit.assignee_id(即提交方/labeler)。
        # reviewer 审完,通知 labeler 结果(approved → 可进入下一 stage / rejected → 打回重标)。
        # 不在事务内,失败不影响 submit 主流程。
        if redis is not None and unit.assignee_id and actor.user_id != unit.assignee_id:
            try:
                from ..notification import publisher
                await publisher.publish_workflow_event(
                    redis,
                    tenant_id=tenant_id, user_id=unit.assignee_id,
                    instance_id=inst.id, unit_id=unit.id,
                    stage_code=stage.code,
                    decision=("approve" if decision == "approved" else "reject"),
                    reason=(reason.category if reason else None),
                )
            except Exception:
                # 通知是 best-effort,失败只写日志,不阻断 submit
                pass
        return inst

    async def get_diff(
        self, *, instance_id: int, from_version: int, to_version: int,
    ) -> dict:
        """实例视角的版本 diff。委托给 label_service,按 object id 比对。"""
        inst = await WorkflowInstance.filter(id=instance_id).first()
        if inst is None:
            raise WorkflowError(f"instance {instance_id} 不存在")
        from ..services.label_v2 import LabelNotFound, label_service
        try:
            d = await label_service.diff(
                unit_id=inst.unit_id,
                from_version=from_version, to_version=to_version,
            )
        except LabelNotFound as e:
            raise WorkflowError(str(e))
        d["instance_id"] = instance_id
        return d

    # ===== 内部 =====

    async def _assert_assignee(
        self, stage: Stage, decision: Decision, actor: AuthCtx,
        *, redis: Optional[aioredis.Redis] = None,
    ) -> None:
        if actor.is_superuser:
            return
        from ..db.models import User
        user = await User.filter(id=actor.user_id).first()
        if user is None:
            raise WorkflowError(f"actor {actor.user_id} 不存在")
        perms = await get_user_permissions_cached(user, redis)
        required = PERM_FOR_KIND.get(stage.kind)
        if required and not has_permission(perms, required):
            raise WorkflowError(
                f"stage {stage.code}({stage.kind}) 需要 {required} 权限"
            )
        # 驳回需要单独的 reject 权限
        if decision == "rejected" and stage.kind in ("review", "sample_review", "arbitrate"):
            if not has_permission(perms, "business:review:reject"):
                raise WorkflowError("驳回需要 business:review:reject 权限")

    async def _enter_stage(
        self, inst: WorkflowInstance, unit: Unit, spec: WorkflowSpec, stage: Stage,
        *, redis: Optional[aioredis.Redis] = None,
        is_initial: bool = False, prev_stage: Optional[Stage] = None,
    ) -> None:
        """进入一个 stage 时调用。
        - accept:终态,进入即完成,inst.current_status=approved、unit.stage_status=done
        - sample_review:抽样跳过则快进到 next stage
        - 其它:停留等待 submit;若非 initial 且 batch 非 manual,按 stage 角色 pool 自动派单

        is_initial=True 表示这是 instantiate 触发的首次进入,unit.assignee_id 由
        spawn_units 设好,不动;False 表示是 submit 推进的 stage 切换,需要重新派单。

        prev_stage 是 stage 切换前的旧 stage,用于 load_aware 减载时识别旧 pool。
        sample_review 递归快进时,prev_stage 沿用上游(跳过的 stage 同 pool)。
        """
        if stage.kind == "accept":
            inst.current_status = "approved"
            inst.current_stage = stage.code
            unit.current_stage = stage.code
            unit.stage_status = "done"
            # Stage 7:load_aware 减载 hook
            if unit.batch_id is not None:
                from ..services.batch import batch_service
                await batch_service.on_unit_done(
                    batch_id=unit.batch_id,
                    assignee_id=unit.assignee_id,
                    redis=redis,
                )
            return

        # 非首次进入(stage 切换):按 stage 角色 + batch 策略自动派单
        if not is_initial and unit.batch_id is not None:
            await self._auto_assign_for_stage(
                unit, stage, prev_stage=prev_stage, redis=redis,
            )

        if stage.kind != "sample_review" or stage.sample_policy is None:
            return

        tenant_id = inst.tenant_id
        need = await should_sample(
            tenant_id=tenant_id, workflow_id=inst.workflow_id,
            unit_id=unit.id, assignee_id=unit.assignee_id,
            stage_code=stage.code, policy=stage.sample_policy,
        )
        if need:
            return

        # 跳过:标记 sample_skipped,直接进 next stage(如有);否则等 accept
        inst.sample_skipped = True
        if stage.next_stage_on_approve:
            nxt = spec.stage_by_code(stage.next_stage_on_approve)
            if nxt is not None:
                inst.current_stage = nxt.code
                unit.current_stage = nxt.code
                # 递归快进,直到不再被抽样跳过或进入 accept
                await self._enter_stage(
                    inst, unit, spec, nxt, redis=redis,
                    is_initial=is_initial, prev_stage=stage,
                )

    async def _auto_assign_for_stage(
        self, unit: Unit, stage: Stage, *,
        prev_stage: Optional[Stage] = None,
        redis: Optional[aioredis.Redis] = None,
    ) -> None:
        """stage 切换时调 batch_service 重派 assignee。

        - prev_stage 提供 → 用 prev_stage 角色 pool 给旧 assignee 减载(load_aware)
        - 新归属从 batch.{pool} 按 strategy 选出(load_aware 才会真正自动派;
          round_robin 在 stage 切换场景退化到 manual,因为缺少轮转索引;
          manual 不自动派)
        - review/sample_review/arbitrate kind 同步写 unit.reviewer_id
        - accept stage 不调用此函数(由 caller 保证)
        """
        from ..services.batch import Batch, batch_service
        batch = await Batch.filter(id=unit.batch_id).first()
        if batch is None:
            return

        # 给上一归属在原 pool 上减载。pool 用 prev_stage 推断;若 prev_stage 为空
        # (异常路径),跳过减载避免误减到错的 ZSET。
        old_assignee = unit.assignee_id
        if old_assignee is not None and prev_stage is not None:
            old_pool = batch_service._pool_for_stage(prev_stage)
            await batch_service.dec_stage_load(
                batch=batch, user_id=old_assignee, pool_name=old_pool, redis=redis,
            )

        picked = await batch_service.pick_stage_assignee(
            batch=batch, stage=stage, redis=redis,
        )
        if picked is not None:
            unit.assignee_id = picked
            if stage.kind in ("review", "sample_review", "arbitrate"):
                unit.reviewer_id = picked
            # 派单后需要保存;caller(submit)会 save unit。
        elif batch.assignee_strategy != "manual" and old_assignee is not None:
            # 非 manual 策略但池空/退化:清掉旧 owner 让 manual claim 重新生效。
            # manual 策略下原 assignee 可能是显式指派的,不动。
            unit.assignee_id = None

    async def _evaluate(
        self, stage: Stage, spec: WorkflowSpec, inst: WorkflowInstance,
        decision: Decision, *, redis: Optional[aioredis.Redis] = None,
    ) -> Optional[str]:
        """根据本次 decision + 历史投票,返回下一 stage code;None 表示停留/完成。"""
        if stage.kind == "accept":
            if decision == "approved":
                return None  # 由调用方标记 approved
            raise WorkflowError("accept stage 不可驳回")

        if stage.pass_condition.mode == "any":
            return self._single_decision(stage, decision)

        # majority / all:需满 quorum 才判
        votes_in_stage = [
            r for r in (inst.stage_history or [])
            if r.get("stage_code") == stage.code
        ]
        quorum = stage.pass_condition.quorum or 2
        if len(votes_in_stage) < quorum:
            return None  # 等更多投票

        approves = sum(1 for v in votes_in_stage if v.get("decision") == "approved")
        rejects = sum(1 for v in votes_in_stage if v.get("decision") == "rejected")

        if stage.pass_condition.mode == "all":
            if rejects == 0:
                return stage.next_stage_on_approve
            return self._reject_destination(stage, spec)

        # majority
        if approves > rejects:
            return stage.next_stage_on_approve
        if rejects > approves:
            return self._reject_destination(stage, spec)
        # 平票 → 仲裁
        arb = self._find_arbitrate(spec)
        if arb is not None:
            inst.current_status = "arbitrate"
            return arb.code
        return None  # hold

    def _single_decision(self, stage: Stage, decision: Decision) -> Optional[str]:
        if decision == "approved":
            return stage.next_stage_on_approve
        return self._reject_destination(stage, None)  # type: ignore[arg-type]

    def _reject_destination(self, stage: Stage, spec: Optional[WorkflowSpec]) -> Optional[str]:
        ra = stage.reject_action
        if ra == "hold":
            return None
        if ra == "escalate":
            if spec is None:
                return None
            arb = self._find_arbitrate(spec)
            return arb.code if arb else None
        if ra.startswith("to_stage:"):
            return ra.split(":", 1)[1]
        return None

    def _find_arbitrate(self, spec: WorkflowSpec) -> Optional[Stage]:
        for s in spec.stages:
            if s.kind == "arbitrate":
                return s
        return None


workflow_engine = WorkflowEngine()
