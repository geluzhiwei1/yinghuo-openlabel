"""工作流规格模型(Pydantic)。

这些是 `Workflow.stages` JSON 字段内的结构契约,引擎与路由共享。
不直接对应 Tortoise 表;持久化时整体序列化进 `Workflow.stages` / `WorkflowInstance.stage_history`。
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


StageKind = Literal["annotate", "review", "sample_review", "accept", "arbitrate"]
SampleStrategy = Literal["full", "random", "stratified", "adaptive"]
PassMode = Literal["any", "majority", "all"]
Decision = Literal["approved", "rejected", "escalated"]
RejectCategory = Literal[
    "geometry", "class_error", "missing_attr", "undercount", "overcount", "other"
]
RejectSeverity = Literal["major", "minor"]


class SamplePolicy(BaseModel):
    """抽样策略。仅 review / sample_review stage 使用。"""
    strategy: SampleStrategy = "full"
    rate: float = Field(1.0, ge=0.0, le=1.0, description="抽样比例 0.0-1.0")
    seed: Optional[int] = Field(None, description="随机种子,保证可复现")
    min_per_labeler: int = Field(0, ge=0, description="stratified 用,每标注员最少抽样数")
    # adaptive 用
    base_rate: Optional[float] = Field(None, ge=0.0, le=1.0)
    alpha: Optional[float] = Field(None, ge=0.0, le=10.0, description="自适应放大系数")
    window: Optional[int] = Field(None, ge=1, description="回看历史样本数")


class PassCondition(BaseModel):
    """通过条件。multi-review 时用 quorum 决定投票池大小。"""
    mode: PassMode = "any"
    quorum: Optional[int] = Field(None, ge=1, description="多数/全票所需的最少投票数")


class Stage(BaseModel):
    """工作流中的一个阶段定义。"""
    code: str = Field(..., min_length=1, max_length=64,
                     pattern=r"^[a-z0-9][a-z0-9_]*$",
                     description="阶段编码,如 label / review_1 / qa / accept")
    kind: StageKind
    assignee_source: str = Field(
        "role:annotator",
        max_length=64,
        description="分配来源,如 role:annotator / role:reviewer / pool / specific_users",
    )
    sample_policy: Optional[SamplePolicy] = None
    pass_condition: PassCondition = Field(default_factory=PassCondition)
    reject_action: str = Field(
        "to_stage:label",
        max_length=128,
        description="驳回去向:to_stage:<code> / escalate / hold",
    )
    next_stage_on_approve: Optional[str] = Field(
        None, description="通过后进入的下一阶段 code;None 表示工作流结束(accept)"
    )

    @model_validator(mode="after")
    def _validate_kind_policy(self):
        if self.kind in ("review", "sample_review") and self.sample_policy is None:
            # review 默认 full 抽样
            self.sample_policy = SamplePolicy(strategy="full", rate=1.0)
        if self.kind == "accept" and self.next_stage_on_approve is not None:
            raise ValueError("accept stage 不可有 next_stage_on_approve")
        return self


class RejectReason(BaseModel):
    category: RejectCategory
    severity: RejectSeverity = "major"
    frame_id: Optional[str] = None
    object_id: Optional[str] = None
    note: str = Field("", max_length=1024)


class StageRun(BaseModel):
    """一次 stage 执行记录,append 到 WorkflowInstance.stage_history。"""
    stage_code: str
    actor_id: int
    started_at: datetime
    finished_at: Optional[datetime] = None
    decision: Optional[Decision] = None
    reject_reason: Optional[RejectReason] = None
    duration_ms: Optional[int] = Field(None, ge=0)
    sample_skipped: bool = False


class WorkflowSpec(BaseModel):
    """整份 workflow 模板的校验入口。stages 必须自洽:
    - code 唯一
    - 至少一个 accept
    - next_stage_on_approve / reject_action 引用的 code 必须存在(或 'escalate' / 'hold' / None)
    """
    stages: list[Stage]

    @model_validator(mode="after")
    def _validate_stages(self):
        if not self.stages:
            raise ValueError("workflow 至少需要一个 stage")
        codes = [s.code for s in self.stages]
        if len(set(codes)) != len(codes):
            raise ValueError(f"stage code 重复:{codes}")
        if not any(s.kind == "accept" for s in self.stages):
            raise ValueError("workflow 必须至少有一个 accept stage")
        valid_codes = set(codes) | {"escalate", "hold"}
        for s in self.stages:
            if s.next_stage_on_approve is not None and s.next_stage_on_approve not in valid_codes:
                raise ValueError(f"stage {s.code} 的 next_stage_on_approve 引用未知 stage:{s.next_stage_on_approve}")
            ra = s.reject_action
            if ra.startswith("to_stage:"):
                target = ra.split(":", 1)[1]
                if target not in valid_codes:
                    raise ValueError(f"stage {s.code} 的 reject_action 引用未知 stage:{target}")
            elif ra not in ("escalate", "hold"):
                raise ValueError(f"stage {s.code} 的 reject_action 非法:{ra}")
        return self

    def stage_by_code(self, code: str) -> Optional[Stage]:
        for s in self.stages:
            if s.code == code:
                return s
        return None

    def topology_errors(self) -> list[str]:
        """跨 stage 拓扑检查(基础字段校验之外)。

        检查项:
        - 入度 0 的 stage 恰好一个(多入口会让 instantiate 选哪个 stage[0] 不确定)
        - next_stage_on_approve 链无环(否则永远到不了 accept)
        - 每个 accept 从入口可达(否则是孤立 accept,引擎不会走到)
        """
        errors: list[str] = []
        codes = [s.code for s in self.stages]
        code_set = set(codes)

        # 入边集合:被任何 stage 的 next_stage_on_approve 引用。
        # 注意:arbitrate stage 通常通过 reject_action='escalate' 进入(动态路由),
        # 静态图上看不到入边,因此把它视作"合法的副入口",不计入多入口告警。
        referenced: set[str] = set()
        for s in self.stages:
            if s.next_stage_on_approve and s.next_stage_on_approve in code_set:
                referenced.add(s.next_stage_on_approve)
        entries = [c for c in codes if c not in referenced]
        primary_entries = [
            c for c in entries
            if next((s for s in self.stages if s.code == c), None).kind != "arbitrate"
        ]
        if len(primary_entries) == 0 and len(entries) <= 1:
            # 仅当确实无任何入口(全循环)时报错;arbitrate 副入口除外
            errors.append("无入口 stage:所有 stage 都被引用,构成环")
        elif len(primary_entries) > 1:
            errors.append(
                f"多个主入口 stage:{primary_entries}(arbitrate 副入口不计)"
            )

        # next_stage_on_approve 链 DFS 检环
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {c: WHITE for c in codes}
        chain_cycle = [False]

        def dfs(code: str) -> None:
            color[code] = GRAY
            stage = next((s for s in self.stages if s.code == code), None)
            if stage and stage.next_stage_on_approve and stage.next_stage_on_approve in code_set:
                nxt = stage.next_stage_on_approve
                if color[nxt] == GRAY:
                    chain_cycle[0] = True
                elif color[nxt] == WHITE:
                    dfs(nxt)
            color[code] = BLACK

        for c in codes:
            if color[c] == WHITE:
                dfs(c)
        if chain_cycle[0]:
            errors.append("next_stage_on_approve 链中存在环(无法到达 accept)")

        # accept 可达性:从每个 entry 沿 next_stage_on_approve 走,看能否到达 accept
        accepts = {s.code for s in self.stages if s.kind == "accept"}
        if entries and accepts:
            reachable_accepts: set[str] = set()

            def walk(code: str, seen: set[str]) -> None:
                if code in seen:
                    return
                seen.add(code)
                if code in accepts:
                    reachable_accepts.add(code)
                stage = next((s for s in self.stages if s.code == code), None)
                if stage and stage.next_stage_on_approve and stage.next_stage_on_approve in code_set:
                    walk(stage.next_stage_on_approve, seen)

            for e in entries:
                walk(e, set())
            unreachable = accepts - reachable_accepts
            if unreachable:
                errors.append(f"以下 accept stage 从入口不可达:{sorted(unreachable)}")

        return errors
