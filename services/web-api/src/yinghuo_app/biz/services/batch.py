"""Stage 7 批次与任务调度。

Batch 是 Project 下的批量任务容器:绑定一个数据序列(seq_uuid)、一个 mission、
一组标注员池和一种分派策略。spawn_units 从数据序列展开 (stream, frame) 笛卡尔积,
按策略分派;manual 留空待认领,round_robin 轮转,load_aware 用 Redis ZSET 取最闲。

数据序列结构(运行期观察):
- MG_DATA_SEQ_META 文档:datas.openlabel.streams 是 dict,keys=stream 名
- MG_DATA_STREAM_META 文档:datas.openlabel.frames 是 dict,keys=字符串整数
"""
from __future__ import annotations

import asyncio
import hashlib
from typing import Any, Optional

from bson import ObjectId
from pydantic import BaseModel, Field, field_validator
from redis import asyncio as aioredis
from tortoise.expressions import Q

from ...apps.ctx import get_current_tenant_id
from ...config import Conf
from ...log import logger
from ..db.models import Batch, Unit, User, Workflow, WorkflowInstance
from ..rbac.resolver import get_user_role_names


VALID_STRATEGIES = {"manual", "round_robin", "load_aware"}
VALID_BATCH_STATUS = {"pending", "active", "done", "cancelled"}


class BatchError(Exception):
    """批次服务内部错误,转 400。"""


class BatchConflict(Exception):
    """并发抢占(如 claim 已被别人拿走)。"""


class BatchCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    slug: str = Field(..., min_length=2, max_length=64,
                      pattern=r"^[a-z0-9][a-z0-9-]*$")
    mission: str = Field(..., min_length=1, max_length=64)
    seq_uuid: str = Field(..., min_length=1, max_length=64)
    assignee_strategy: str = Field("manual")
    assignees: list[int] = Field(default_factory=list)
    reviewers: list[int] = Field(default_factory=list)
    qa_pool: list[int] = Field(default_factory=list)
    frame_range: dict = Field(default_factory=dict)
    sampling_rate: float = Field(1.0, ge=0.0, le=1.0)

    @field_validator("assignee_strategy")
    @classmethod
    def _check_strategy(cls, v: str) -> str:
        if v not in VALID_STRATEGIES:
            raise ValueError(f"assignee_strategy 必须 in {VALID_STRATEGIES}")
        return v

    @field_validator("frame_range")
    @classmethod
    def _check_range(cls, v: dict) -> dict:
        for k in v.keys():
            if k not in {"start", "end", "step"}:
                raise ValueError(f"frame_range 非法字段:{k}")
        for k, val in v.items():
            if not isinstance(val, int) or val < 0:
                raise ValueError(f"frame_range.{k} 必须为非负整数")
        return v


class BatchUpdateIn(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    assignee_strategy: Optional[str] = None
    assignees: Optional[list[int]] = None
    reviewers: Optional[list[int]] = None
    qa_pool: Optional[list[int]] = None
    frame_range: Optional[dict] = None
    sampling_rate: Optional[float] = Field(None, ge=0.0, le=1.0)
    status: Optional[str] = None

    @field_validator("assignee_strategy")
    @classmethod
    def _check_strategy(cls, v):
        if v is not None and v not in VALID_STRATEGIES:
            raise ValueError(f"assignee_strategy 必须 in {VALID_STRATEGIES}")
        return v

    @field_validator("status")
    @classmethod
    def _check_status(cls, v):
        if v is not None and v not in VALID_BATCH_STATUS:
            raise ValueError(f"status 必须 in {VALID_BATCH_STATUS}")
        return v


class SpawnUnitsIn(BaseModel):
    streams: Optional[list[str]] = Field(
        None, description="限定这些 stream;缺省取 seq_meta 全部 streams"
    )


class AssignIn(BaseModel):
    assignee_id: Optional[int] = None
    reviewer_id: Optional[int] = None


class BatchService:

    async def create_batch(
        self, *, project_id: int, payload: BatchCreateIn,
    ) -> Batch:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        if payload.assignee_strategy != "manual" and not payload.assignees:
            raise BatchError(
                f"strategy={payload.assignee_strategy} 需要非空 assignees"
            )
        if await Batch.filter(
            tenant_id=tenant_id, project_id=project_id, slug=payload.slug,
        ).exists():
            raise BatchError(f"slug 已存在:{payload.slug}")

        # 校验 seq_uuid 真实存在
        if not await asyncio.to_thread(self._seq_exists, payload.seq_uuid):
            raise BatchError(f"数据序列不存在:seq_uuid={payload.seq_uuid}")

        return await Batch.create(
            tenant_id=tenant_id,
            project_id=project_id,
            name=payload.name, slug=payload.slug,
            mission=payload.mission, seq_uuid=payload.seq_uuid,
            assignee_strategy=payload.assignee_strategy,
            assignees=list(payload.assignees),
            reviewers=list(payload.reviewers),
            qa_pool=list(payload.qa_pool),
            frame_range=dict(payload.frame_range),
            sampling_rate=payload.sampling_rate,
            status="pending",
        )

    async def update_batch(
        self, *, batch_id: int, payload: BatchUpdateIn,
    ) -> Batch:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        batch = await Batch.filter(tenant_id=tenant_id, id=batch_id).first()
        if batch is None:
            raise BatchError(f"batch {batch_id} 不存在")

        fields = payload.model_dump(exclude_unset=True)
        if not fields:
            raise BatchError("未提供更新字段")

        # 已 active 的 batch 不允许改 strategy / assignees 池,避免与已铺 Unit 不一致
        if batch.status == "active":
            locked = {"assignee_strategy", "frame_range", "sampling_rate", "seq_uuid"}
            bad = locked & fields.keys()
            if bad:
                raise BatchError(f"batch 已 active,不可修改:{bad}")

        for k, v in fields.items():
            setattr(batch, k, v)
        await batch.save(update_fields=list(fields.keys()) + ["updated_at"])
        return batch

    async def list_batches(
        self, *, project_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        page: int = 1, page_size: int = 20,
    ) -> dict:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        qs = Batch.filter(tenant_id=tenant_id)
        if project_id is not None:
            qs = qs.filter(project_id=project_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        total = await qs.count()
        rows = (await qs.offset((page - 1) * page_size).limit(page_size)
                .order_by("-created_at"))
        return {
            "total": total, "page": page, "page_size": page_size,
            "items": [await self._batch_to_dict(r) for r in rows],
        }

    async def get_batch(self, *, batch_id: int) -> Batch:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        batch = await Batch.filter(tenant_id=tenant_id, id=batch_id).first()
        if batch is None:
            raise BatchError(f"batch {batch_id} 不存在")
        return batch

    async def delete_batch(self, *, batch_id: int) -> None:
        tenant_id = get_current_tenant_id()
        batch = await self.get_batch(batch_id=batch_id)
        # 安全:仅 pending 或无关联 Unit 时可删
        unit_count = await Unit.filter(
            tenant_id=tenant_id, batch_id=batch.id,
        ).count()
        if unit_count > 0:
            raise BatchError(
                f"batch 已有 {unit_count} 个 unit,不可删除;先取消或迁移"
            )
        await batch.delete()

    # ===== spawn =====

    async def spawn_units(
        self, *, batch_id: int, payload: SpawnUnitsIn,
        redis: Optional[aioredis.Redis] = None,
    ) -> dict:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        batch = await Batch.filter(tenant_id=tenant_id, id=batch_id).first()
        if batch is None:
            raise BatchError(f"batch {batch_id} 不存在")
        if batch.status not in ("pending", "active"):
            raise BatchError(
                f"batch status={batch.status},不可 spawn(仅 pending/active)"
            )

        streams = await asyncio.to_thread(self._list_streams, batch.seq_uuid)
        if not streams:
            raise BatchError(f"seq_uuid={batch.seq_uuid} 下没有 streams")
        if payload.streams:
            wanted = set(payload.streams)
            streams = [s for s in streams if s in wanted]
            if not streams:
                raise BatchError("指定的 streams 在该序列下都不存在")

        # 收集所有 (stream, frame_index)
        targets: list[tuple[str, int, str]] = []  # (stream, frame, seq_path)
        seq_path = await asyncio.to_thread(self._get_seq_path, batch.seq_uuid)
        for stream in streams:
            frames = await asyncio.to_thread(
                self._list_frames, batch.seq_uuid, stream,
            )
            for frame_idx in self._apply_range(frames, batch.frame_range):
                if self._sample_keep(frame_idx, batch.sampling_rate):
                    targets.append((stream, frame_idx, seq_path))

        if not targets:
            logger.warning(
                f"spawn: batch={batch.id} seq={batch.seq_uuid} "
                f"frame_range/sampling_rate 过滤后 targets 为空"
            )

        created = await self._materialize_units(
            batch=batch, targets=targets, redis=redis,
        )

        # active 切换
        if batch.status == "pending":
            batch.status = "active"
            await batch.save(update_fields=["status", "updated_at"])

        return {
            "batch_id": batch.id, "created": created,
            "skipped": len(targets) - created,
            "total": len(targets),
        }

    async def _materialize_units(
        self, *, batch: Batch,
        targets: list[tuple[str, int, str]],
        redis: Optional[aioredis.Redis],
    ) -> int:
        """按 strategy 把 targets 物化成 Unit。
        bulk_create(ignore_conflicts=True) 让 PG 端去重,但 ignore_conflicts
        会让自增 id 仍占用——这里我们只关心 created 数,所以用先查后插的保守路径。
        """
        if not targets:
            return 0

        tenant_id = batch.tenant_id
        # 已存在的 (stream, frame) 集合(同一 batch 内,自然同 mission 同 seq)
        existing = {
            (u.stream, u.frame)
            for u in await Unit.filter(
                tenant_id=tenant_id, batch_id=batch.id,
            ).only("stream", "frame")
        }
        to_create: list[Unit] = []
        strategy = batch.assignee_strategy
        assignees = list(batch.assignees or [])
        round_idx = 0

        for stream, frame, seq_path in targets:
            if (stream, frame) in existing:
                continue
            assignee_id = await self._pick_assignee(
                strategy=strategy, assignees=assignees,
                idx=round_idx, batch_id=batch.id, redis=redis,
            )
            round_idx += 1
            to_create.append(Unit(
                tenant_id=tenant_id,
                project_id=batch.project_id,
                batch_id=batch.id,
                seq=seq_path or batch.seq_uuid,
                stream=stream, frame=frame,
                mission=batch.mission,
                assignee_id=assignee_id,
            ))

        if not to_create:
            return 0

        await Unit.bulk_create(to_create)
        return len(to_create)

    async def _pick_assignee(
        self, *, strategy: str, assignees: list[int],
        idx: int, batch_id: int,
        redis: Optional[aioredis.Redis],
    ) -> Optional[int]:
        if strategy == "manual":
            return None
        if not assignees:
            return None
        if strategy == "round_robin":
            return assignees[idx % len(assignees)]
        if strategy == "load_aware":
            if redis is None:
                # 测试/无 redis 环境,退化到 round_robin
                return assignees[idx % len(assignees)]
            key = f"load:{batch_id}"
            members = await redis.zrange(key, 0, 0)
            if members:
                picked = int(members[0])
            else:
                # 初始化:全部进 ZSET,score=0
                await redis.zadd(
                    key, {str(a): 0 for a in assignees},
                )
                picked = assignees[0]
            await redis.zincrby(key, 1, str(picked))
            return picked
        return None

    # ===== stage 切换时的自动派单 =====

    _ROLE_TO_POOL = {
        "annotator": "assignees",
        "reviewer": "reviewers",
        "arbitrator": "qa_pool",
    }

    def _pool_for_stage(self, stage) -> str:
        """stage.assignee_source → batch pool 字段名。"""
        src = (getattr(stage, "assignee_source", "") or "")
        if src.startswith("role:"):
            return self._ROLE_TO_POOL.get(src[len("role:"):], "assignees")
        return "assignees"

    async def pick_stage_assignee(
        self, *, batch: Batch, stage, redis: Optional[aioredis.Redis],
    ) -> Optional[int]:
        """stage 切换时,按 batch 策略 + stage 角色 pool 选下一归属。

        - manual:返回 None(走 manual claim)
        - round_robin / load_aware:从对应池按策略选
        - 池空:返回 None(降级到 manual)
        - load_aware 用独立 ZSET key `load:{batch_id}:{pool_name}`,
          避免 annotator 和 reviewer 共用一个 ZSET 互相争负载。
        """
        strategy = batch.assignee_strategy
        if strategy == "manual":
            return None
        pool_name = self._pool_for_stage(stage)
        pool = list(getattr(batch, pool_name, None) or [])
        if not pool:
            return None
        if strategy == "round_robin":
            # round_robin 在 stage 切换场景没有「第 N 个」概念,默认取池里第一个;
            # 真正的轮转由 load_aware 或显式 assign_unit 实现。
            # 这里返回 None 让其走 manual claim,避免所有 unit 永远派给同一人。
            return None
        if strategy == "load_aware":
            if redis is None:
                return None
            key = f"load:{batch.id}:{pool_name}"
            members = await redis.zrange(key, 0, 0)
            if members:
                picked = int(members[0])
            else:
                await redis.zadd(key, {str(a): 0 for a in pool})
                picked = pool[0]
            await redis.zincrby(key, 1, str(picked))
            return picked
        return None

    async def dec_stage_load(
        self, *, batch: Batch, user_id: Optional[int], pool_name: str,
        redis: Optional[aioredis.Redis],
    ) -> None:
        """stage 切换时给上一归属减载(load_aware 才有意义)。"""
        if (
            user_id is None
            or redis is None
            or batch.assignee_strategy != "load_aware"
        ):
            return
        await redis.zincrby(f"load:{batch.id}:{pool_name}", -1, str(user_id))

    # ===== unit ops =====

    async def _unit_stage_role_names(self, unit: Unit) -> set[str]:
        """解析 unit 当前 stage 的 assignee_source 角色。

        - 有 WorkflowInstance → 取 instance.current_stage,反查 Workflow.stages 找 assignee_source
        - 无 instance → 默认第一阶段(label,角色 annotator)
        - assignee_source 不以 role: 开头 → 返回空集(调用方按「不限制」处理)
        """
        inst = await WorkflowInstance.filter(
            tenant_id=unit.tenant_id, unit_id=unit.id,
        ).order_by("-created_at").first()
        if inst is None:
            return {"annotator"}
        wf = await Workflow.filter(id=inst.workflow_id).first()
        if wf is None:
            return {"annotator"}
        stages = wf.stages or []
        for s in stages:
            if s.get("code") != inst.current_stage:
                continue
            src = s.get("assignee_source", "")
            if src.startswith("role:"):
                return {src[len("role:"):]}
            return set()
        return set()

    async def _actor_can_claim_stage(
        self, *, unit: Unit, actor_id: int,
    ) -> bool:
        """actor 是否有权认领 unit 当前 stage。

        - superuser / tenant-admin → 全部放行
        - 其他 → actor 的 role names 必须与 stage 角色「有交集」,
          或 stage 角色为空(assignee_source 非 role: 形式,如 pool / specific_users)
        """
        actor = await User.filter(id=actor_id).first()
        if actor is None:
            return False
        if actor.is_superuser:
            return True
        actor_roles = await get_user_role_names(actor)
        if "tenant-admin" in actor_roles:
            return True
        stage_roles = await self._unit_stage_role_names(unit)
        if not stage_roles:
            return True
        return bool(actor_roles & stage_roles)

    async def claim_unit(self, *, unit_id: int, actor_id: int) -> Unit:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        unit = await Unit.filter(tenant_id=tenant_id, id=unit_id).first()
        if unit is None:
            raise BatchError(f"unit {unit_id} 不存在")
        if unit.stage_status == "done":
            raise BatchError("unit 已完成,不可认领")
        if not await self._actor_can_claim_stage(unit=unit, actor_id=actor_id):
            stage_roles = await self._unit_stage_role_names(unit)
            needed = ",".join(sorted(stage_roles)) or "( unrestricted)"
            raise BatchError(
                f"unit {unit_id} 当前 stage 需要 role: {needed},"
                f"你当前的角色无权认领"
            )
        # 行锁式 update:WHERE assignee_id IS NULL
        updated = await Unit.filter(
            id=unit.id, assignee_id__isnull=True,
        ).update(assignee_id=actor_id)
        if updated == 0:
            raise BatchConflict(f"unit {unit_id} 已被认领")
        return await Unit.filter(id=unit.id).first()

    async def assign_unit(
        self, *, unit_id: int, payload: AssignIn,
    ) -> Unit:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        unit = await Unit.filter(tenant_id=tenant_id, id=unit_id).first()
        if unit is None:
            raise BatchError(f"unit {unit_id} 不存在")
        update_fields: list[str] = []
        if "assignee_id" in payload.model_dump(exclude_unset=True):
            unit.assignee_id = payload.assignee_id
            update_fields.append("assignee_id")
        if "reviewer_id" in payload.model_dump(exclude_unset=True):
            unit.reviewer_id = payload.reviewer_id
            update_fields.append("reviewer_id")
        if not update_fields:
            raise BatchError("未提供更新字段")
        update_fields.append("updated_at")
        await unit.save(update_fields=update_fields)
        return unit

    async def release_unit(
        self, *, unit_id: int, actor_id: int,
        redis: Optional[aioredis.Redis] = None,
    ) -> Unit:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        unit = await Unit.filter(tenant_id=tenant_id, id=unit_id).first()
        if unit is None:
            raise BatchError(f"unit {unit_id} 不存在")
        prev_assignee = unit.assignee_id
        unit.assignee_id = None
        await unit.save(update_fields=["assignee_id", "updated_at"])

        # load_aware 减载
        if prev_assignee is not None and unit.batch_id is not None and redis is not None:
            batch = await Batch.filter(id=unit.batch_id).first()
            if batch is not None and batch.assignee_strategy == "load_aware":
                await redis.zincrby(
                    f"load:{batch.id}", -1, str(prev_assignee),
                )
        return unit

    async def list_units(
        self, *, project_id: Optional[int] = None,
        batch_id: Optional[int] = None,
        assignee_id: Optional[int] = None,
        stage_status: Optional[str] = None,
        page: int = 1, page_size: int = 20,
        eligible_only: bool = False,
        actor_id: Optional[int] = None,
    ) -> dict:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            raise BatchError("当前会话未绑定租户")
        qs = Unit.filter(tenant_id=tenant_id)
        if project_id is not None:
            qs = qs.filter(project_id=project_id)
        if batch_id is not None:
            qs = qs.filter(batch_id=batch_id)
        if assignee_id is not None:
            qs = qs.filter(assignee_id=assignee_id)
        if stage_status:
            qs = qs.filter(stage_status=stage_status)

        # eligible_only:按当前用户角色 + stage 角色交集过滤,
        # 让 annotator 只看到 label stage、reviewer 只看到 review stage。
        # superuser / tenant-admin / 显式指定 assignee_id 时跳过。
        skip_filter = (
            not eligible_only
            or actor_id is None
            or assignee_id is not None
        )
        if not skip_filter:
            actor = await User.filter(id=actor_id).first()
            if actor and not actor.is_superuser:
                actor_roles = await get_user_role_names(actor)
                if "tenant-admin" not in actor_roles and "*" not in actor_roles:
                    qs = await self._filter_by_stage_role(
                        qs, allowed_roles=actor_roles,
                    )

        total = await qs.count()
        rows = (await qs.offset((page - 1) * page_size).limit(page_size)
                .order_by("-created_at"))
        return {
            "total": total, "page": page, "page_size": page_size,
            "items": [await self._unit_to_dict(r) for r in rows],
        }

    async def _filter_by_stage_role(self, qs, *, allowed_roles: set[str]):
        """对 qs 进一步按 stage 角色过滤。

        实现:先 prefetch 所有候选 unit 的 stage 角色,筛出 allowed 的 unit_id,
        再用 id__in 回灌 Tortoise 查询。N 不会太大(list_units 本身分页),
        简单胜过跨 Workflow/Instance/Unit 多跳 JOIN 拼接。
        """
        all_units = await qs.only("id", "tenant_id").limit(2048)
        kept_ids: list[int] = []
        for u in all_units:
            stage_roles = await self._unit_stage_role_names(u)
            if not stage_roles:
                kept_ids.append(u.id)
                continue
            if stage_roles & allowed_roles:
                kept_ids.append(u.id)
        if not kept_ids:
            return qs.filter(id__in=[-1])
        return qs.filter(id__in=kept_ids)

    # ===== lifecycle hook =====

    async def on_unit_done(
        self, *, batch_id: int, assignee_id: Optional[int],
        redis: Optional[aioredis.Redis],
    ) -> None:
        """工作流进入 accept 时调用,load_aware 减载。"""
        if assignee_id is None or redis is None:
            return
        batch = await Batch.filter(id=batch_id).first()
        if batch is None or batch.assignee_strategy != "load_aware":
            return
        await redis.zincrby(f"load:{batch_id}", -1, str(assignee_id))

    # ===== Mongo 探测同步 helpers =====

    def _seq_exists(self, seq_uuid: str) -> bool:
        try:
            return Conf.MG_DATA_SEQ_META.find_one(
                {"job.uuid": ObjectId(seq_uuid)},
                {"_id": 1},
            ) is not None
        except Exception:
            return False

    def _list_streams(self, seq_uuid: str) -> list[str]:
        try:
            doc = Conf.MG_DATA_SEQ_META.find_one(
                {"job.uuid": ObjectId(seq_uuid)},
                {"datas.openlabel.streams": 1, "job.seq": 1},
            )
        except Exception:
            return []
        if not doc:
            return []
        streams = doc.get("datas", {}).get("openlabel", {}).get("streams", {})
        return list(streams.keys()) if isinstance(streams, dict) else []

    def _get_seq_path(self, seq_uuid: str) -> str:
        try:
            doc = Conf.MG_DATA_SEQ_META.find_one(
                {"job.uuid": ObjectId(seq_uuid)},
                {"job.seq": 1},
            )
        except Exception:
            return ""
        return (doc or {}).get("job", {}).get("seq", "") or ""

    def _list_frames(self, seq_uuid: str, stream: str) -> list[int]:
        try:
            doc = Conf.MG_DATA_STREAM_META.find_one(
                {"job.uuid": ObjectId(seq_uuid), "job.stream": stream},
                {"datas.openlabel.frames": 1},
            )
        except Exception:
            return []
        if not doc:
            return []
        frames = doc.get("datas", {}).get("openlabel", {}).get("frames", {})
        if not isinstance(frames, dict):
            return []
        out = []
        for k in frames.keys():
            try:
                out.append(int(k))
            except (TypeError, ValueError):
                continue
        return sorted(out)

    def _apply_range(self, frames: list[int], frame_range: dict) -> list[int]:
        if not frames:
            return []
        start = frame_range.get("start")
        end = frame_range.get("end")
        step = frame_range.get("step") or 1
        out = []
        for f in frames:
            if start is not None and f < start:
                continue
            if end is not None and f > end:
                continue
            out.append(f)
        if step > 1:
            out = out[::step]
        return out

    def _sample_keep(self, frame_idx: int, rate: float) -> bool:
        if rate >= 1.0:
            return True
        if rate <= 0.0:
            return False
        h = hashlib.sha256(f"{frame_idx}".encode()).hexdigest()[:8]
        return int(h, 16) / 0xFFFFFFFF < rate

    # ===== 序列化 =====

    async def _batch_to_dict(self, b: Batch) -> dict:
        return {
            "id": b.id,
            "tenant_id": b.tenant_id,
            "project_id": b.project_id,
            "name": b.name,
            "slug": b.slug,
            "mission": b.mission,
            "seq_uuid": b.seq_uuid,
            "assignee_strategy": b.assignee_strategy,
            "assignees": b.assignees,
            "reviewers": b.reviewers,
            "qa_pool": b.qa_pool,
            "frame_range": b.frame_range,
            "sampling_rate": b.sampling_rate,
            "status": b.status,
            "created_at": b.created_at,
            "updated_at": b.updated_at,
        }

    async def _unit_to_dict(self, u: Unit) -> dict:
        return {
            "id": u.id,
            "tenant_id": u.tenant_id,
            "project_id": u.project_id,
            "batch_id": u.batch_id,
            "seq": u.seq,
            "stream": u.stream,
            "frame": u.frame,
            "mission": u.mission,
            "assignee_id": u.assignee_id,
            "reviewer_id": u.reviewer_id,
            "current_stage": u.current_stage,
            "stage_status": u.stage_status,
            "data_version": u.data_version,
            "created_at": u.created_at,
            "updated_at": u.updated_at,
        }


batch_service = BatchService()
