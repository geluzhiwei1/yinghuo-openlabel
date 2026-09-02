"""工作流耗时与性能聚合(Stage 10.4)。

数据源:WorkflowInstance.stage_history 中每条 StageRun 的 duration_ms / started_at / finished_at。
所有计算走 Python 后处理,避免 SQL JSON array 查询的跨库差异。
聚合粒度:tenant_id 强制隔离;project_id 必传(与 quality.py 现有端点一致)。

samples_low 阈值:< 10 样本视为不可靠,前端图上标灰。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from ..db.models import WorkflowInstance

SAMPLES_LOW_THRESHOLD = 10


def _to_aware_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_dt(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return _to_aware_utc(value)
    if isinstance(value, str):
        try:
            return _to_aware_utc(datetime.fromisoformat(value))
        except ValueError:
            return None
    return None


def _percentile(sorted_values: list[float], q: float) -> Optional[float]:
    """线性插值百分位;q ∈ [0, 1];空列表返 None。"""
    if not sorted_values:
        return None
    if len(sorted_values) == 1:
        return sorted_values[0]
    pos = q * (len(sorted_values) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(sorted_values) - 1)
    frac = pos - lo
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * frac


def _run_duration_minutes(run: dict) -> Optional[float]:
    """单条 StageRun 的耗时(分钟)。

    优先用 duration_ms;若未填,回退到 finished_at - started_at。
    """
    dur_ms = run.get("duration_ms")
    if dur_ms is not None and dur_ms >= 0:
        return dur_ms / 60000.0
    fdt = _parse_dt(run.get("finished_at"))
    sdt = _parse_dt(run.get("started_at"))
    if fdt is None or sdt is None:
        return None
    delta = (fdt - sdt).total_seconds() / 60.0
    if delta < 0:
        return None
    return delta


async def _fetch_instances(
    tenant_id: str, project_id: int, since: Optional[datetime] = None,
) -> list[WorkflowInstance]:
    """N+1 防护:用 .values() 直接拿 JSON 字段,不走 ORM 实例化。"""
    qs = WorkflowInstance.filter(tenant_id=tenant_id, project_id=project_id)
    if since is not None:
        # 用 created_at 限制窗口(实例创建时间) — cycle trend 也走这个窗口
        since_naive = since.replace(tzinfo=None)
        qs = qs.filter(created_at__gte=since_naive)
    return await qs.values(
        "id", "current_status", "created_at", "updated_at", "stage_history",
    )


async def compute_stage_duration(
    tenant_id: str, project_id: int, window_days: int = 30,
) -> dict:
    """每个 stage 的 duration p50/p95/p99(分钟)。

    过滤:只取 finished_at 落在窗口内的 StageRun。
    samples_low:samples < 10 时为 True。
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    rows = await _fetch_instances(tenant_id, project_id, since)

    buckets: dict[str, list[float]] = {}
    for r in rows:
        for run in (r.get("stage_history") or []):
            fdt = _parse_dt(run.get("finished_at"))
            if fdt is None or fdt < since:
                continue
            dur_min = _run_duration_minutes(run)
            if dur_min is None:
                continue
            stage = run.get("stage_code") or "<unknown>"
            buckets.setdefault(stage, []).append(dur_min)

    stages = []
    for stage, vals in sorted(buckets.items()):
        s = sorted(vals)
        stages.append({
            "stage": stage,
            "p50": round(_percentile(s, 0.50), 2),
            "p95": round(_percentile(s, 0.95), 2),
            "p99": round(_percentile(s, 0.99), 2),
            "samples": len(s),
            "samples_low": len(s) < SAMPLES_LOW_THRESHOLD,
        })

    return {"project_id": project_id, "window_days": window_days, "stages": stages}


async def compute_bottleneck(
    tenant_id: str, project_id: int, window_days: int = 30,
) -> dict:
    """每个 stage 占总 cycle time 的比例(降序)。

    分子:sum(duration_ms) per stage
    分母:sum(所有 stage 的 duration_ms)
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    rows = await _fetch_instances(tenant_id, project_id, since)

    sums: dict[str, list[float]] = {}
    for r in rows:
        for run in (r.get("stage_history") or []):
            fdt = _parse_dt(run.get("finished_at"))
            if fdt is None or fdt < since:
                continue
            dur_min = _run_duration_minutes(run)
            if dur_min is None:
                continue
            stage = run.get("stage_code") or "<unknown>"
            sums.setdefault(stage, []).append(dur_min)

    total_minutes = sum(sum(v) for v in sums.values())
    items = []
    for stage, vals in sums.items():
        avg = sum(vals) / len(vals) if vals else 0.0
        share = (sum(vals) / total_minutes) if total_minutes > 0 else 0.0
        items.append({
            "stage": stage,
            "share": round(share, 4),
            "avg_minutes": round(avg, 2),
            "samples": len(vals),
            "samples_low": len(vals) < SAMPLES_LOW_THRESHOLD,
        })
    items.sort(key=lambda x: x["share"], reverse=True)

    return {
        "project_id": project_id,
        "window_days": window_days,
        "total_minutes": round(total_minutes, 2),
        "items": items,
    }


async def compute_cycle_time_trend(
    tenant_id: str, project_id: int, window_days: int = 30,
) -> dict:
    """按天算完成 instance 的端到端 cycle time p50(分钟)。

    完成:current_status='approved' 且 stage_history 最后一条 decision=approved。
    cycle time = last_finished_at - created_at。
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    rows = await _fetch_instances(tenant_id, project_id, since)

    daily: dict[str, list[float]] = {}
    for r in rows:
        hist = r.get("stage_history") or []
        if not hist:
            continue
        last = hist[-1]
        if last.get("decision") != "approved":
            continue
        fdt = _parse_dt(last.get("finished_at"))
        cdt = _parse_dt(r.get("created_at"))
        if fdt is None or cdt is None or fdt < since:
            continue
        cycle_min = (fdt - cdt).total_seconds() / 60.0
        if cycle_min < 0:
            continue
        date_key = fdt.date().isoformat()
        daily.setdefault(date_key, []).append(cycle_min)

    series = []
    for i in range(window_days + 1):
        d = (since + timedelta(days=i)).date()
        key = d.isoformat()
        vals = daily.get(key) or []
        s = sorted(vals)
        p50 = _percentile(s, 0.50)
        series.append({
            "date": key,
            "p50_minutes": round(p50, 1) if p50 is not None else None,
            "samples": len(s),
            "samples_low": len(s) < SAMPLES_LOW_THRESHOLD,
        })

    return {"project_id": project_id, "window_days": window_days, "series": series}
