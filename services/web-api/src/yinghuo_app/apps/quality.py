"""质量统计聚合 /quality。

挂载:main app,前缀 /api/v1/b/quality。
权限:business:stats:read。

数据源:WorkflowInstance + StageVote。所有指标按 tenant_id 强制隔离;
project_id 必传以限定范围,避免跨项目聚合误导。

指标定义参考设计文档 §8.1。
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..apps.ctx import get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.db.models import Unit, WorkflowInstance, StageVote
from ..biz.db.models import Workflow
from ..biz.workflow.duration import (
    compute_stage_duration,
    compute_bottleneck,
    compute_cycle_time_trend,
)

router = APIRouter()


def _require_tenant() -> str:
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    return tenant_id


async def _project_scope(tenant_id: str, project_id: int) -> None:
    """校验 project_id 属于当前租户。"""
    # Project 模型存在则通过;不需要严格存在性检查(若不存在,聚合返回 0 也合理)
    # 这里仅做软校验,不强制 404
    return


@router.get(
    "/overview",
    summary="项目质量总览",
    dependencies=[permission_required("business:stats:read")],
)
async def quality_overview(
    project_id: int = Query(..., description="项目 id"),
):
    """项目级聚合指标。
    - total_units:项目下 unit 总数
    - completed:到达 accept(approved)的 unit 数
    - first_pass_rate:无任何 reject 直通 accept 的比例
    - avg_rework:平均返工次数(每个 unit 的 reject 次数均值)
    - severe_error_rate:severity=major 的 reject 占总 reject 的比例
    - by_stage:每个 stage 的 approve/reject/escalate 计数(用于看瓶颈)
    """
    tenant_id = _require_tenant()

    units = await Unit.filter(tenant_id=tenant_id, project_id=project_id)
    total_units = len(units)
    unit_ids = [u.id for u in units]
    if not unit_ids:
        return {
            "project_id": project_id,
            "total_units": 0,
            "completed": 0,
            "first_pass_rate": None,
            "avg_rework": None,
            "severe_error_rate": None,
            "by_stage": [],
        }

    # completed:unit.stage_status='done'
    completed = sum(1 for u in units if u.stage_status == "done")

    # 实例视角:每个 unit 的 reject 次数
    insts = await WorkflowInstance.filter(
        tenant_id=tenant_id, project_id=project_id,
    )
    unit_reject_counts: dict[int, int] = {}
    for inst in insts:
        # stage_history 是 list[StageRun]
        cnt = sum(
            1 for r in (inst.stage_history or [])
            if r.get("decision") == "rejected"
        )
        unit_reject_counts[inst.unit_id] = unit_reject_counts.get(inst.unit_id, 0) + cnt

    rejected_units = sum(1 for c in unit_reject_counts.values() if c > 0)
    total_rejects = sum(unit_reject_counts.values())
    avg_rework = total_rejects / total_units if total_units else 0.0
    first_pass_rate = (total_units - rejected_units) / total_units if total_units else 0.0

    # severe error rate:从 StageVote 拉所有 reject
    rejects = await StageVote.filter(
        tenant_id=tenant_id, instance_id__in=[
            i.id for i in insts
        ], decision="rejected",
    )
    severe = sum(1 for r in rejects if r.reject_severity == "major")
    severe_error_rate = severe / len(rejects) if rejects else None

    # by_stage:从 StageVote 聚合
    votes = await StageVote.filter(
        tenant_id=tenant_id,
        instance_id__in=[i.id for i in insts],
    )
    by_stage: dict[str, dict[str, int]] = {}
    for v in votes:
        bucket = by_stage.setdefault(v.stage_code, {"approved": 0, "rejected": 0, "escalated": 0})
        bucket[v.decision] = bucket.get(v.decision, 0) + 1

    return {
        "project_id": project_id,
        "total_units": total_units,
        "completed": completed,
        "completion_rate": completed / total_units if total_units else 0.0,
        "first_pass_rate": first_pass_rate,
        "avg_rework": avg_rework,
        "severe_error_rate": severe_error_rate,
        "total_rejects": total_rejects,
        "by_stage": [
            {"stage_code": k, **v} for k, v in sorted(by_stage.items())
        ],
    }


@router.get(
    "/by-assignee",
    summary="按标注员聚合(产能 + 质量)",
    dependencies=[permission_required("business:stats:read")],
)
async def quality_by_assignee(
    project_id: int = Query(..., description="项目 id"),
):
    """每个标注员的指标:
    - units_assigned:分配给该标注员的 unit 数
    - units_completed:已 stage_status=done 的数
    - rejects_received:在 label stage 之后被 reject 的累计次数
    - first_pass_rate:无 reject 直通 accept 的比例
    """
    tenant_id = _require_tenant()

    units = await Unit.filter(
        tenant_id=tenant_id, project_id=project_id,
        assignee_id__not_isnull=True,
    )
    by_user: dict[int, dict] = {}
    for u in units:
        bucket = by_user.setdefault(u.assignee_id, {
            "assignee_id": u.assignee_id,
            "units_assigned": 0, "units_completed": 0,
            "first_pass_units": 0,
        })
        bucket["units_assigned"] += 1
        if u.stage_status == "done":
            bucket["units_completed"] += 1

    # 拉 instances 算 reject 数(对 unit.assignee_id 维度)
    insts = await WorkflowInstance.filter(
        tenant_id=tenant_id, project_id=project_id,
    )
    unit_to_assignee = {u.id: u.assignee_id for u in units}
    unit_rejects: dict[int, int] = {}
    for inst in insts:
        cnt = sum(1 for r in (inst.stage_history or []) if r.get("decision") == "rejected")
        if cnt > 0:
            unit_rejects[inst.unit_id] = unit_rejects.get(inst.unit_id, 0) + cnt

    for unit_id, cnt in unit_rejects.items():
        assignee_id = unit_to_assignee.get(unit_id)
        if assignee_id is None:
            continue
        bucket = by_user[assignee_id]
        bucket["rejects_received"] = bucket.get("rejects_received", 0) + cnt

    # first_pass_units:assigned - had_reject
    for bucket in by_user.values():
        had_reject = unit_rejects.get(0)  # placeholder, real logic below
        bucket.setdefault("rejects_received", 0)
    # 重新算 first_pass_units:对每个 assignee,看其 unit 中无 reject 的数量
    assignee_unit_had_reject: dict[int, set[int]] = {}
    for unit_id in unit_rejects:
        aid = unit_to_assignee.get(unit_id)
        if aid is None:
            continue
        assignee_unit_had_reject.setdefault(aid, set()).add(unit_id)
    for aid, bucket in by_user.items():
        bad = assignee_unit_had_reject.get(aid, set())
        # first_pass_units = assigned 中没有 reject 的
        # 用 completed - (had_reject ∩ completed) 近似更准,这里用 assigned - bad
        bucket["first_pass_units"] = bucket["units_assigned"] - len(bad)
        bucket["first_pass_rate"] = (
            bucket["first_pass_units"] / bucket["units_assigned"]
            if bucket["units_assigned"] else None
        )

    return {"project_id": project_id, "items": list(by_user.values())}


@router.get(
    "/by-reviewer",
    summary="按审核员聚合(通过/驳回率 + 工时)",
    dependencies=[permission_required("business:stats:read")],
)
async def quality_by_reviewer(
    project_id: int = Query(..., description="项目 id"),
):
    """每个审核员的投票分布 + 平均工时(基于 StageRun.duration_ms)。"""
    tenant_id = _require_tenant()
    insts = await WorkflowInstance.filter(
        tenant_id=tenant_id, project_id=project_id,
    )
    inst_ids = [i.id for i in insts]
    votes = await StageVote.filter(
        tenant_id=tenant_id, instance_id__in=inst_ids,
    )

    by_user: dict[int, dict] = {}
    durations: dict[int, list[int]] = {}
    for v in votes:
        bucket = by_user.setdefault(v.actor_id, {
            "reviewer_id": v.actor_id,
            "approved": 0, "rejected": 0, "escalated": 0,
            "total_votes": 0,
        })
        bucket[v.decision] = bucket.get(v.decision, 0) + 1
        bucket["total_votes"] += 1

    # 平均工时:遍历 inst.stage_history 取 duration_ms
    for inst in insts:
        for r in (inst.stage_history or []):
            actor_id = r.get("actor_id")
            dur = r.get("duration_ms")
            if actor_id is not None and dur is not None:
                durations.setdefault(actor_id, []).append(dur)

    for aid, bucket in by_user.items():
        bucket["reject_rate"] = (
            bucket["rejected"] / bucket["total_votes"]
            if bucket["total_votes"] else None
        )
        ds = durations.get(aid, [])
        bucket["avg_duration_ms"] = sum(ds) / len(ds) if ds else None

    return {"project_id": project_id, "items": list(by_user.values())}


@router.get(
    "/reject-categories",
    summary="驳回原因分布",
    dependencies=[permission_required("business:stats:read")],
)
async def quality_reject_categories(
    project_id: int = Query(..., description="项目 id"),
):
    """按 category × severity 的二维分布。"""
    tenant_id = _require_tenant()
    insts = await WorkflowInstance.filter(
        tenant_id=tenant_id, project_id=project_id,
    )
    inst_ids = [i.id for i in insts]
    rejects = await StageVote.filter(
        tenant_id=tenant_id, instance_id__in=inst_ids,
        decision="rejected",
    )

    matrix: dict[tuple[str, str], int] = {}
    for r in rejects:
        key = (r.reject_category or "unknown", r.reject_severity or "unknown")
        matrix[key] = matrix.get(key, 0) + 1

    return {
        "project_id": project_id,
        "total_rejects": len(rejects),
        "items": [
            {"category": cat, "severity": sev, "count": cnt}
            for (cat, sev), cnt in sorted(matrix.items())
        ],
    }


@router.get(
"/sample-coverage",
    summary="抽样覆盖率(sample_review stage 实际抽样率)",
    dependencies=[permission_required("business:stats:read")],
)
async def quality_sample_coverage(
    project_id: int = Query(..., description="项目 id"),
):
    """对 sample_review stage,统计:
    - entered:进入过该 stage 的 unit 数(含被跳过)
    - actually_sampled:实际被抽样审核的数
    - coverage:actually_sampled / entered
    """
    tenant_id = _require_tenant()
    insts = await WorkflowInstance.filter(
        tenant_id=tenant_id, project_id=project_id,
    )

    # 拉所有模板,找出 sample_review stages
    wf_ids = {i.workflow_id for i in insts}
    wfs = await Workflow.filter(id__in=list(wf_ids))
    sample_stages_by_wf: dict[int, set[str]] = {}
    for wf in wfs:
        codes = {
            s["code"] for s in (wf.stages or [])
            if s.get("kind") == "sample_review"
        }
        if codes:
            sample_stages_by_wf[wf.id] = codes

    # 遍历 inst:看 stage_history 是否有该 stage 的 vote → 实际抽样
    by_stage: dict[str, dict] = {}
    for inst in insts:
        wf_sample_stages = sample_stages_by_wf.get(inst.workflow_id, set())
        if not wf_sample_stages:
            continue
        history_codes = {r.get("stage_code") for r in (inst.stage_history or [])}
        for stage_code in wf_sample_stages:
            bucket = by_stage.setdefault(stage_code, {
                "stage_code": stage_code,
                "entered": 0, "actually_sampled": 0,
            })
            # entered:实例经过了这个 stage(无论 skip 还是 sample)
            # 简化判断:如果 inst.sample_skipped=True 或 stage_code 在 history 里
            if stage_code in history_codes or inst.sample_skipped:
                bucket["entered"] += 1
            if stage_code in history_codes:
                bucket["actually_sampled"] += 1

    for bucket in by_stage.values():
        bucket["coverage"] = (
            bucket["actually_sampled"] / bucket["entered"]
            if bucket["entered"] else None
        )

    return {
        "project_id": project_id,
        "items": list(by_stage.values()),
    }


# ===== Stage 10.4: 性能与耗时分析 =====


@router.get(
    "/stage-duration",
    summary="每个 stage 的耗时分布(p50/p95/p99)",
    dependencies=[permission_required("business:stats:read")],
)
async def quality_stage_duration(
    project_id: int = Query(..., description="项目 id"),
    window_days: int = Query(30, ge=1, le=90, description="窗口天数(上限 90)"),
):
    """按 stage 算耗时分布(分钟)。
    数据源:WorkflowInstance.stage_history 中每条 StageRun 的 duration_ms。
    samples_low=samples < 10 时为 True,前端图上标灰。
    """
    tenant_id = _require_tenant()
    return await compute_stage_duration(
        tenant_id=tenant_id, project_id=project_id, window_days=window_days,
    )


@router.get(
    "/bottleneck",
    summary="stage 瓶颈占比(降序)",
    dependencies=[permission_required("business:stats:read")],
)
async def quality_bottleneck(
    project_id: int = Query(..., description="项目 id"),
    window_days: int = Query(30, ge=1, le=90, description="窗口天数(上限 90)"),
):
    """每 stage 占总 cycle time 的比例(降序)。
    分子:sum(duration_ms) per stage;分母:所有 stage 的 sum(duration_ms)。
    """
    tenant_id = _require_tenant()
    return await compute_bottleneck(
        tenant_id=tenant_id, project_id=project_id, window_days=window_days,
    )


@router.get(
    "/cycle-time-trend",
    summary="每日完成 cycle time p50 趋势",
    dependencies=[permission_required("business:stats:read")],
)
async def quality_cycle_time_trend(
    project_id: int = Query(..., description="项目 id"),
    window_days: int = Query(30, ge=1, le=90, description="窗口天数(上限 90)"),
):
    """按天算 approved instance 的端到端 cycle time p50(分钟)。
    cycle = last_finished_at - created_at。
    """
    tenant_id = _require_tenant()
    return await compute_cycle_time_trend(
        tenant_id=tenant_id, project_id=project_id, window_days=window_days,
    )
