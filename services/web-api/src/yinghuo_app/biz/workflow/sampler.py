"""抽样策略。

should_sample 决定一个进入 review/sample_review stage 的 unit 是否真要被审核,
还是被抽样跳过(跳过则直接进入下一 stage,但 sample_skipped=True 留痕)。

- full:必抽
- random:基于 (unit_id, stage_code, seed) 的稳定哈希,可复现
- stratified:每个标注员保证最少 min_per_labeler 个样本;超出后走 random
- adaptive:基于标注员近期驳回率动态放大抽样率

stratified/adaptive 依赖 StageVote 表(扁平化的 stage_history 一票一行,便于过滤)。
"""
from __future__ import annotations

import hashlib
from typing import Optional

from ..db.models import StageVote
from .spec import SamplePolicy


def _stable_hash_ratio(unit_id: int, stage_code: str, seed: Optional[int]) -> float:
    """返回 [0, 1) 区间的稳定哈希值。同 (unit_id, stage_code, seed) 永远返回同一结果。"""
    raw = f"{unit_id}|{stage_code}|{seed if seed is not None else 0}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


async def should_sample(
    *,
    tenant_id: str,
    workflow_id: int,
    unit_id: int,
    assignee_id: Optional[int],
    stage_code: str,
    policy: SamplePolicy,
) -> bool:
    """是否要抽样审核这个 unit。True 表示需要审核,False 表示跳过(直通下一 stage)。"""
    if policy.strategy == "full":
        return True

    if policy.strategy == "random":
        ratio = _stable_hash_ratio(unit_id, stage_code, policy.seed)
        return ratio < policy.rate

    if policy.strategy == "stratified":
        # 先保底:该标注员在该 stage 的累计样本不足 min_per_labeler → 强制抽
        if assignee_id is not None and policy.min_per_labeler > 0:
            counted = await StageVote.filter(
                tenant_id=tenant_id, workflow_id=workflow_id,
                stage_code=stage_code, actor_id=assignee_id,
            ).exclude(decision="escalated").count()
            if counted < policy.min_per_labeler:
                return True
        ratio = _stable_hash_ratio(unit_id, stage_code, policy.seed)
        return ratio < policy.rate

    if policy.strategy == "adaptive":
        # 基于近 window 个样本的 reject 率动态调率:rate = min(1, base_rate * (1 + alpha * reject_rate))
        base = policy.base_rate if policy.base_rate is not None else policy.rate
        alpha = policy.alpha if policy.alpha is not None else 1.0
        window = policy.window or 20
        if assignee_id is not None:
            recent = await StageVote.filter(
                tenant_id=tenant_id, workflow_id=workflow_id,
                stage_code=stage_code, actor_id=assignee_id,
            ).exclude(decision="escalated").order_by("-created_at").limit(window)
            if recent:
                rejects = sum(1 for v in recent if v.decision == "rejected")
                reject_rate = rejects / len(recent)
                adjusted = min(1.0, base * (1.0 + alpha * reject_rate))
            else:
                adjusted = base
        else:
            adjusted = base
        ratio = _stable_hash_ratio(unit_id, stage_code, policy.seed)
        return ratio < adjusted

    return True
