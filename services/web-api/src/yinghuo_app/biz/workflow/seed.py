"""内置工作流模板 seed。启动时调用,幂等。

3 个模板覆盖设计文档 §6.2 的典型流程:
- default-3stage:label → review_1(full) → accept
- default-with-qa:label → review_1(full) → review_2(random 0.2) → qa(random 0.05) → accept
- default-double-review:label → review_double(full, quorum=2, majority) → accept;冲突 → arbitrate
"""
from ..db.models import Workflow
from .spec import PassCondition, SamplePolicy, Stage, WorkflowSpec
from ...log import logger


def _builtin_specs() -> list[tuple[str, str, str, list[Stage]]]:
    return [
        (
            "default-3stage",
            "三阶段(标注→审核→通过)",
            "label → review_1(full) → accept",
            [
                Stage(
                    code="label", kind="annotate",
                    assignee_source="role:annotator",
                    next_stage_on_approve="review_1",
                ),
                Stage(
                    code="review_1", kind="review",
                    assignee_source="role:reviewer",
                    sample_policy=SamplePolicy(strategy="full", rate=1.0),
                    pass_condition=PassCondition(mode="any"),
                    reject_action="to_stage:label",
                    next_stage_on_approve="accept",
                ),
                Stage(code="accept", kind="accept", assignee_source="role:reviewer"),
            ],
        ),
        (
            "default-with-qa",
            "带 QA 抽检",
            "label → review_1(full) → review_2(random 0.2) → qa(random 0.05) → accept",
            [
                Stage(
                    code="label", kind="annotate",
                    assignee_source="role:annotator",
                    next_stage_on_approve="review_1",
                ),
                Stage(
                    code="review_1", kind="review",
                    assignee_source="role:reviewer",
                    sample_policy=SamplePolicy(strategy="full", rate=1.0),
                    reject_action="to_stage:label",
                    next_stage_on_approve="review_2",
                ),
                Stage(
                    code="review_2", kind="sample_review",
                    assignee_source="role:reviewer",
                    sample_policy=SamplePolicy(strategy="random", rate=0.2, seed=42),
                    reject_action="to_stage:label",
                    next_stage_on_approve="qa",
                ),
                Stage(
                    code="qa", kind="sample_review",
                    assignee_source="role:reviewer",
                    sample_policy=SamplePolicy(strategy="random", rate=0.05, seed=42),
                    reject_action="to_stage:label",
                    next_stage_on_approve="accept",
                ),
                Stage(code="accept", kind="accept", assignee_source="role:reviewer"),
            ],
        ),
        (
            "default-double-review",
            "双审 + 仲裁",
            "label → review_double(quorum=2,majority) → accept;冲突进 arbitrate",
            [
                Stage(
                    code="label", kind="annotate",
                    assignee_source="role:annotator",
                    next_stage_on_approve="review_double",
                ),
                Stage(
                    code="review_double", kind="review",
                    assignee_source="role:reviewer",
                    sample_policy=SamplePolicy(strategy="full", rate=1.0),
                    pass_condition=PassCondition(mode="majority", quorum=2),
                    reject_action="to_stage:label",
                    next_stage_on_approve="accept",
                ),
                Stage(
                    code="arbitrate", kind="arbitrate",
                    assignee_source="role:arbitrator",
                    reject_action="to_stage:label",
                    next_stage_on_approve="accept",
                ),
                Stage(code="accept", kind="accept", assignee_source="role:reviewer"),
            ],
        ),
    ]


async def seed_builtin_workflows() -> None:
    for slug, name, desc, stages in _builtin_specs():
        # 通过 WorkflowSpec 做最终校验,seed 错误直接抛
        WorkflowSpec(stages=stages)
        await Workflow.update_or_create(
            tenant_id=None, slug=slug,
            defaults={
                "name": name,
                "description": desc,
                "stages": [s.model_dump(mode="json") for s in stages],
                "is_builtin": True,
                "is_default": slug == "default-3stage",
            },
        )
    logger.info(f"workflow seed done: {len(_builtin_specs())} builtin templates")
