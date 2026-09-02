"""工作流运行态聚合统计(Stage 10.2)。

数据源:WorkflowInstance(含 stage_history JSON)+ Unit。
所有计算走 Python 后处理,避免 SQL JSON array 查询的跨库差异。
聚合粒度:tenant_id 强制隔离;project_id 可选,缺省则聚合整个租户。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from ..db.models import Unit, WorkflowInstance


def _p95(values: list[float]) -> Optional[float]:
    """简单百分位计算;样本 < 1 返 None。"""
    if not values:
        return None
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round(0.95 * (len(s) - 1)))))
    return s[k]


def _to_aware_utc(dt: datetime) -> datetime:
    """Tortoise 默认返回 naive UTC datetime,统一补 tzinfo 避免 offset-aware 比较报错。"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_dt(value) -> Optional[datetime]:
    """解析 stage_history 中的时间字段(str/datetime),失败返 None。结果统一 aware UTC。"""
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


def _age_minutes(updated_at: datetime, now: datetime) -> float:
    """updated_at → 当前(now)的分钟数;负值兜底为 0。"""
    delta = (now - _to_aware_utc(updated_at)).total_seconds() / 60.0
    return max(0.0, delta)


async def compute_summary(
    tenant_id: str,
    project_id: Optional[int] = None,
    window_days: int = 7,
) -> dict:
    """总览:按 stage / status 分桶 + 每 stage 的 p95 age。

    - by_stage:每个 current_stage 的 in_progress / today_completed / today_rejected 计数,
      以及该 stage 当前 in_progress 实例的 p95 age(分钟)。
    - by_status:WorkflowInstance.current_status 4 桶(pending/in_progress/approved/rejected)。
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)

    qs = WorkflowInstance.filter(tenant_id=tenant_id)
    if project_id is not None:
        qs = qs.filter(project_id=project_id)
    insts = await qs

    by_stage: dict[str, dict] = {}
    by_status: dict[str, int] = {
        "pending": 0, "in_progress": 0,
        "approved": 0, "rejected": 0, "arbitrate": 0,
    }

    # 累计 in_progress 的 age 用于 p95
    age_buckets: dict[str, list[float]] = {}

    for inst in insts:
        stage = inst.current_stage or "<unknown>"
        status = inst.current_status or "pending"
        by_status[status] = by_status.get(status, 0) + 1

        bucket = by_stage.setdefault(stage, {
            "stage": stage,
            "in_progress": 0,
            "today_completed": 0,
            "today_rejected": 0,
            "p95_age_minutes": None,
        })

        if status == "in_progress":
            bucket["in_progress"] += 1
            age_buckets.setdefault(stage, []).append(
                _age_minutes(inst.updated_at, now)
            )
        # 今日完成/拒绝:看 stage_history 最后一条 decision 的时间
        hist = inst.stage_history or []
        if hist:
            last = hist[-1]
            fdt = _parse_dt(last.get("finished_at"))
            if fdt and fdt >= since:
                decision = last.get("decision")
                if decision == "approved":
                    bucket["today_completed"] += 1
                elif decision == "rejected":
                    bucket["today_rejected"] += 1

    for stage_code, ages in age_buckets.items():
        p = _p95(ages)
        if p is not None:
            by_stage[stage_code]["p95_age_minutes"] = round(p, 1)

    return {
        "window_days": window_days,
        "by_stage": list(by_stage.values()),
        "by_status": by_status,
    }


async def compute_stuck(
    tenant_id: str,
    project_id: Optional[int] = None,
    threshold_minutes: int = 240,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """卡住的 instance 列表:current_status='in_progress' 且 age >= threshold_minutes。

    返回字段:instance_id, unit_id, project_id, current_stage, age_minutes, assignee_id。
    assignee 通过 Unit 反查(instance 没有冗余此字段)。
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=threshold_minutes)
    # Tortoise 用 naive UTC 存储,filter 比较时统一用 naive UTC 避免驱动层 tz 报错
    cutoff_naive = cutoff.replace(tzinfo=None)

    qs = WorkflowInstance.filter(
        tenant_id=tenant_id,
        current_status="in_progress",
        updated_at__lte=cutoff_naive,
    )
    if project_id is not None:
        qs = qs.filter(project_id=project_id)
    total = await qs.count()
    rows = (
        await qs.offset((page - 1) * page_size).limit(page_size)
        .order_by("updated_at")  # 最老的(卡得最久)在前
    )

    if not rows:
        return {
            "total": 0, "page": page, "page_size": page_size,
            "threshold_minutes": threshold_minutes, "items": [],
        }

    unit_ids = [r.unit_id for r in rows]
    units = await Unit.filter(id__in=unit_ids)
    unit_map = {u.id: u for u in units}

    items = []
    for r in rows:
        u = unit_map.get(r.unit_id)
        items.append({
            "instance_id": r.id,
            "unit_id": r.unit_id,
            "project_id": r.project_id,
            "current_stage": r.current_stage,
            "age_minutes": round(_age_minutes(r.updated_at, now), 1),
            "assignee_id": u.assignee_id if u else None,
            "reviewer_id": u.reviewer_id if u else None,
            "seq": u.seq if u else None,
            "mission": u.mission if u else None,
        })

    return {
        "total": total, "page": page, "page_size": page_size,
        "threshold_minutes": threshold_minutes, "items": items,
    }


async def compute_throughput(
    tenant_id: str,
    project_id: Optional[int] = None,
    window_days: int = 7,
) -> dict:
    """每日完成量曲线:看 stage_history 最后一条 decision=approved 且 finished_at 落在窗口内。"""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)

    qs = WorkflowInstance.filter(tenant_id=tenant_id)
    if project_id is not None:
        qs = qs.filter(project_id=project_id)
    insts = await qs

    # 初始化窗口内每一天(含 today)
    buckets: dict[str, dict] = {}
    for i in range(window_days + 1):
        d = (since + timedelta(days=i)).date()
        buckets[d.isoformat()] = {"date": d.isoformat(), "completed": 0, "rejected": 0}

    for inst in insts:
        hist = inst.stage_history or []
        if not hist:
            continue
        last = hist[-1]
        fdt = _parse_dt(last.get("finished_at"))
        if not fdt or fdt < since:
            continue
        date_key = fdt.date().isoformat()
        if date_key not in buckets:
            continue  # 跨时区可能漂移到 window 外
        decision = last.get("decision")
        if decision == "approved":
            buckets[date_key]["completed"] += 1
        elif decision == "rejected":
            buckets[date_key]["rejected"] += 1

    return {
        "window_days": window_days,
        "series": list(buckets.values()),
    }
