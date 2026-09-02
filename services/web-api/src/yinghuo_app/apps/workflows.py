"""审批工作流路由 /workflows。

挂载:main app,前缀 /api/v1/b/workflows。
权限:business:workflow:read|write。submit 走 business:label:write / business:review:approve|reject,
由 engine 根据 stage.kind 在运行时二次校验。

路由组织(注意 FastAPI 顺序敏感):
- /workflows/units, /workflows/instances 先注册(更具体)
- /workflows, /workflows/{id}, /workflows/{id}/instantiate 后注册
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from redis import asyncio as aioredis
from tortoise.expressions import Q

from ..apps.ctx import CTX_USER_ID, get_current_tenant_id
from ..apps.dependency import permission_required
from ..biz.db.models import Unit, User, Workflow, WorkflowInstance, WorkflowVersion
from ..biz.workflow.engine import AuthCtx, WorkflowEngine, WorkflowError
from ..biz.workflow.lock import WorkflowBusy
from ..biz.workflow.spec import (
    Decision, RejectReason, Stage, WorkflowSpec,
)
from ..biz.workflow.stats import (
    compute_summary, compute_stuck, compute_throughput,
)
from ..redis_conf import init_redis_pool

router = APIRouter()
engine = WorkflowEngine()


# ===== Schemas =====

class StageIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9_]*$")
    kind: str
    assignee_source: str = "role:annotator"
    sample_policy: Optional[dict] = None
    pass_condition: dict = Field(default_factory=lambda: {"mode": "any"})
    reject_action: str = "to_stage:label"
    next_stage_on_approve: Optional[str] = None


class WorkflowCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*$")
    description: Optional[str] = Field(None, max_length=512)
    stages: list[StageIn]
    is_default: bool = False


class WorkflowUpdateIn(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = Field(None, max_length=512)
    stages: Optional[list[StageIn]] = None
    is_default: Optional[bool] = None
    # Stage 10.3:stages 改动必填 changelog,作为 fork 新版本的说明
    changelog: Optional[str] = Field(None, max_length=512)


class UnitCreateIn(BaseModel):
    project_id: int
    seq: str = Field(..., max_length=128)
    stream: str = Field(..., max_length=128)
    frame: int = Field(..., ge=0)
    mission: str = Field(..., max_length=64)
    assignee_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    batch_id: Optional[int] = None


class InstantiateIn(BaseModel):
    unit_id: int


class SubmitIn(BaseModel):
    decision: Decision
    reason: Optional[RejectReason] = None


# ===== Unit(测试用,Stage 5 自洽需要) =====

@router.get(
    "/units",
    summary="Unit 列表",
    dependencies=[permission_required("business:workflow:read")],
)
async def list_units(
    project_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    qs = Unit.filter(tenant_id=tenant_id)
    if project_id is not None:
        qs = qs.filter(project_id=project_id)
    total = await qs.count()
    rows = (await qs.offset((page - 1) * page_size).limit(page_size)
            .order_by("-created_at"))
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [await r.to_dict() for r in rows],
    }


@router.post(
    "/units",
    summary="创建测试 Unit",
    dependencies=[permission_required("business:workflow:write")],
)
async def create_unit(payload: UnitCreateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    dup = await Unit.filter(
        tenant_id=tenant_id, project_id=payload.project_id,
        seq=payload.seq, stream=payload.stream,
        frame=payload.frame, mission=payload.mission,
    ).exists()
    if dup:
        raise HTTPException(status_code=409, detail="同 project+seq+stream+frame+mission 已存在")
    unit = await Unit.create(
        tenant_id=tenant_id,
        project_id=payload.project_id,
        batch_id=payload.batch_id,
        seq=payload.seq, stream=payload.stream,
        frame=payload.frame, mission=payload.mission,
        assignee_id=payload.assignee_id,
        reviewer_id=payload.reviewer_id,
    )
    return await unit.to_dict()


# ===== Instance =====

@router.get(
    "/instances",
    summary="实例列表",
    dependencies=[permission_required("business:workflow:read")],
)
async def list_instances(
    project_id: Optional[int] = None,
    unit_id: Optional[int] = None,
    current_stage: Optional[str] = None,
    current_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    qs = WorkflowInstance.filter(tenant_id=tenant_id)
    if project_id is not None:
        qs = qs.filter(project_id=project_id)
    if unit_id is not None:
        qs = qs.filter(unit_id=unit_id)
    if current_stage:
        qs = qs.filter(current_stage=current_stage)
    if current_status:
        qs = qs.filter(current_status=current_status)
    total = await qs.count()
    rows = (await qs.offset((page - 1) * page_size).limit(page_size)
            .order_by("-created_at"))
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [await r.to_dict() for r in rows],
    }


@router.get(
    "/instances/{instance_id}",
    summary="实例详情(含 stage_history)",
    dependencies=[permission_required("business:workflow:read")],
)
async def get_instance(instance_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    inst = await WorkflowInstance.filter(
        tenant_id=tenant_id, id=instance_id,
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="实例不存在")
    return await inst.to_dict()


@router.post(
    "/instances/{instance_id}/submit",
    summary="推进工作流",
    dependencies=[permission_required("business:workflow:read")],
)
async def submit_instance(
    instance_id: int,
    payload: SubmitIn,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    user_id = CTX_USER_ID.get()
    user = await User.filter(id=user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    actor = AuthCtx(
        user_id=user.id, tenant_id=tenant_id, is_superuser=user.is_superuser,
    )
    try:
        inst = await engine.submit(
            instance_id=instance_id,
            decision=payload.decision, reason=payload.reason,
            actor=actor, redis=redis,
        )
    except WorkflowBusy:
        raise HTTPException(status_code=409, detail="资源正被另一会话操作,请重试")
    except WorkflowError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await inst.to_dict()


@router.get(
    "/instances/{instance_id}/diff",
    summary="实例版本 diff(骨架)",
    dependencies=[permission_required("business:workflow:read")],
)
async def diff_instance(
    instance_id: int,
    frm: int = Query(..., alias="from", ge=0),
    to: int = Query(..., ge=0),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    inst = await WorkflowInstance.filter(
        tenant_id=tenant_id, id=instance_id,
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="实例不存在")
    return await engine.get_diff(
        instance_id=instance_id, from_version=frm, to_version=to,
    )


# ===== Template =====

@router.get(
    "",
    summary="工作流模板列表(含内置)",
    dependencies=[permission_required("business:workflow:read")],
)
async def list_workflows(is_builtin: Optional[bool] = None):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    qs = Workflow.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id=None, is_builtin=True)
    )
    if is_builtin is not None:
        qs = qs.filter(is_builtin=is_builtin)
    rows = await qs.order_by("-is_builtin", "-created_at")
    return {"items": [await r.to_dict() for r in rows]}


@router.post(
    "/validate",
    summary="校验 stages 拓扑(无环 / 单入口 / accept 可达)",
    dependencies=[permission_required("business:workflow:read")],
)
async def validate_workflow(payload: list[StageIn]):
    try:
        spec = WorkflowSpec(stages=[Stage(**s.model_dump()) for s in payload])
    except ValueError as e:
        return {"ok": False, "errors": [str(e)]}
    errors = spec.topology_errors()
    return {"ok": not errors, "errors": errors}


# ===== Monitor(Stage 10.2) =====
# 注意:必须在 /{template_id} 之前注册,否则 'monitor' 会被当成 path param。

@router.get(
    "/monitor/summary",
    summary="运行态总览:按 stage / status 分桶 + p95 age",
    dependencies=[permission_required("business:workflow:read")],
)
async def monitor_summary(
    project_id: Optional[int] = None,
    window_days: int = Query(7, ge=1, le=90),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    return await compute_summary(
        tenant_id=tenant_id, project_id=project_id,
        window_days=window_days,
    )


@router.get(
    "/monitor/stuck",
    summary="卡住的 instance 列表",
    dependencies=[permission_required("business:workflow:read")],
)
async def monitor_stuck(
    project_id: Optional[int] = None,
    threshold_minutes: int = Query(240, ge=1, le=43200,
                                   description="卡住阈值(分钟),默认 4 小时"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    return await compute_stuck(
        tenant_id=tenant_id, project_id=project_id,
        threshold_minutes=threshold_minutes,
        page=page, page_size=page_size,
    )


@router.get(
    "/monitor/throughput",
    summary="每日完成量曲线",
    dependencies=[permission_required("business:workflow:read")],
)
async def monitor_throughput(
    project_id: Optional[int] = None,
    window_days: int = Query(7, ge=1, le=90),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    return await compute_throughput(
        tenant_id=tenant_id, project_id=project_id,
        window_days=window_days,
    )


@router.post(
    "",
    summary="创建工作流模板",
    dependencies=[permission_required("business:workflow:write")],
)
async def create_workflow(payload: WorkflowCreateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    try:
        spec = WorkflowSpec(stages=[Stage(**s.model_dump()) for s in payload.stages])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    topo = spec.topology_errors()
    if topo:
        raise HTTPException(status_code=400, detail=f"拓扑校验失败:{topo}")

    if await Workflow.filter(tenant_id=tenant_id, slug=payload.slug).exists():
        raise HTTPException(status_code=409, detail=f"slug 已存在:{payload.slug}")

    actor_id = CTX_USER_ID.get()
    stages_dump = [s.model_dump(mode="json") for s in spec.stages]
    wf = await Workflow.create(
        tenant_id=tenant_id,
        name=payload.name, slug=payload.slug,
        description=payload.description,
        stages=stages_dump,
        is_default=payload.is_default,
        is_builtin=False,
    )
    # Stage 10.3:同时创建 v1 active version
    v1 = await WorkflowVersion.create(
        tenant_id=tenant_id,
        workflow_id=wf.id,
        version_no=1,
        stages=stages_dump,
        changelog="初始版本",
        created_by=actor_id,
        is_active=True,
    )
    await Workflow.filter(id=wf.id).update(current_version_id=v1.id)
    wf.current_version_id = v1.id
    return await wf.to_dict()


@router.get(
    "/{template_id}",
    summary="模板详情",
    dependencies=[permission_required("business:workflow:read")],
)
async def get_workflow(template_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    wf = await Workflow.filter(
        Q(id=template_id)
        & (Q(tenant_id=tenant_id) | Q(tenant_id=None, is_builtin=True))
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="模板不存在")
    return await wf.to_dict()


@router.patch(
    "/{template_id}",
    summary="更新模板(内置不可改;stages 改动自动 fork 新版本)",
    dependencies=[permission_required("business:workflow:write")],
)
async def update_workflow(template_id: int, payload: WorkflowUpdateIn):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    wf = await Workflow.filter(tenant_id=tenant_id, id=template_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="模板不存在")
    if wf.is_builtin:
        raise HTTPException(status_code=409, detail="内置模板不可修改")

    update_fields = payload.model_dump(exclude_unset=True, exclude_none=True)
    new_stages_dump = None
    if update_fields.get("stages") is not None:
        try:
            spec = WorkflowSpec(stages=[Stage(**s) for s in update_fields["stages"]])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        topo = spec.topology_errors()
        if topo:
            raise HTTPException(status_code=400, detail=f"拓扑校验失败:{topo}")
        new_stages_dump = [s.model_dump(mode="json") for s in spec.stages]

    # Stage 10.3:stages 改动 → fork 新版本(changelog 必填)
    if new_stages_dump is not None:
        if not payload.changelog or not payload.changelog.strip():
            raise HTTPException(
                status_code=400,
                detail="stages 改动必须提供 changelog(作为新版本说明)",
            )
        actor_id = CTX_USER_ID.get()
        # 计算新 version_no:当前 workflow 下 max(version_no) + 1
        last_ver = await WorkflowVersion.filter(
            workflow_id=wf.id,
        ).order_by("-version_no").first()
        next_no = (last_ver.version_no + 1) if last_ver else 1
        # 老 active 版本统一去 active
        await WorkflowVersion.filter(
            workflow_id=wf.id, is_active=True,
        ).update(is_active=False)
        new_ver = await WorkflowVersion.create(
            tenant_id=tenant_id,
            workflow_id=wf.id,
            version_no=next_no,
            stages=new_stages_dump,
            changelog=payload.changelog.strip(),
            created_by=actor_id,
            is_active=True,
        )
        # workflow.stages 仍同步成最新,便于 GET 模板时一眼看到当前 stages;
        # current_version_id 指向新版本
        await Workflow.filter(id=wf.id).update(
            stages=new_stages_dump,
            current_version_id=new_ver.id,
        )
        wf.stages = new_stages_dump
        wf.current_version_id = new_ver.id

    # 非 stages 字段(name/description/is_default)直接覆盖
    other_fields = {
        k: v for k, v in update_fields.items()
        if k in {"name", "description", "is_default"}
    }
    if other_fields:
        for k, v in other_fields.items():
            setattr(wf, k, v)
        await wf.save(update_fields=list(other_fields.keys()))

    return await wf.to_dict()


@router.delete(
    "/{template_id}",
    summary="删除模板(内置/被引用不可删)",
    dependencies=[permission_required("business:workflow:write")],
)
async def delete_workflow(template_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    wf = await Workflow.filter(tenant_id=tenant_id, id=template_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="模板不存在")
    if wf.is_builtin:
        raise HTTPException(status_code=409, detail="内置模板不可删除")
    refs = await WorkflowInstance.filter(workflow_id=wf.id).count()
    if refs > 0:
        raise HTTPException(status_code=409, detail=f"模板被 {refs} 个实例引用,不可删除")
    await wf.delete()
    return {"statusText": "已删除"}


# ===== Stage 10.3: 版本管理 =====


@router.get(
    "/{template_id}/versions",
    summary="列出版本(按 version_no 倒序)",
    dependencies=[permission_required("business:workflow:read")],
)
async def list_workflow_versions(template_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    wf = await Workflow.filter(
        Q(id=template_id)
        & (Q(tenant_id=tenant_id) | Q(tenant_id=None, is_builtin=True)),
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="模板不存在")
    versions = await WorkflowVersion.filter(
        workflow_id=template_id,
    ).order_by("-version_no")
    # 标记当前 active id(便于前端高亮)
    active_id = wf.current_version_id
    # 统计每版本绑定的实例数(进度评估)
    items = []
    for v in versions:
        bound = await WorkflowInstance.filter(
            workflow_version_id=v.id,
        ).count()
        items.append({
            "id": v.id,
            "version_no": v.version_no,
            "changelog": v.changelog,
            "is_active": v.id == active_id,
            "stages_count": len(v.stages or []),
            "bound_instances": bound,
            "created_by": v.created_by,
            "created_at": v.created_at,
        })
    return {"workflow_id": template_id, "active_version_id": active_id, "items": items}


@router.get(
    "/{template_id}/versions/{version_id}",
    summary="版本详情(含完整 stages)",
    dependencies=[permission_required("business:workflow:read")],
)
async def get_workflow_version(template_id: int, version_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    v = await WorkflowVersion.filter(
        id=version_id, workflow_id=template_id,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="版本不存在")
    return {
        "id": v.id,
        "workflow_id": v.workflow_id,
        "version_no": v.version_no,
        "changelog": v.changelog,
        "stages": v.stages or [],
        "is_active": v.is_active,
        "created_by": v.created_by,
        "created_at": v.created_at,
    }


@router.post(
    "/{template_id}/versions/{version_id}/activate",
    summary="切换当前生效版本(只影响新 instance;存量 instance 走 migrate)",
    dependencies=[permission_required("business:workflow:write")],
)
async def activate_workflow_version(template_id: int, version_id: int):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    wf = await Workflow.filter(tenant_id=tenant_id, id=template_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="模板不存在")
    if wf.is_builtin:
        raise HTTPException(status_code=409, detail="内置模板不可切换版本")
    v = await WorkflowVersion.filter(
        id=version_id, workflow_id=template_id,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="版本不存在")
    # atomic:旧 active 置 false,新 active 置 true,workflow.current_version_id 同步
    from tortoise.transactions import in_transaction
    async with in_transaction():
        await WorkflowVersion.filter(
            workflow_id=template_id, is_active=True,
        ).update(is_active=False)
        await WorkflowVersion.filter(id=version_id).update(is_active=True)
        await Workflow.filter(id=template_id).update(
            current_version_id=version_id,
            stages=v.stages or [],
        )
    return {"statusText": "已激活", "active_version_id": version_id}


class MigrateInstancesIn(BaseModel):
    # only_running=True 时只迁移 active instance;False 时连历史 instance 一起迁移
    only_running: bool = True


@router.post(
    "/{template_id}/versions/{version_id}/migrate-instances",
    summary="把存量 instance 绑到新版本(兼容性校验:current_stage 必须在新版本 stages 中)",
    dependencies=[permission_required("business:workflow:write")],
)
async def migrate_workflow_instances(
    template_id: int, version_id: int, payload: MigrateInstancesIn,
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    wf = await Workflow.filter(tenant_id=tenant_id, id=template_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="模板不存在")
    target = await WorkflowVersion.filter(
        id=version_id, workflow_id=template_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="目标版本不存在")

    target_stage_codes = {s["code"] for s in (target.stages or [])}

    qs = WorkflowInstance.filter(
        tenant_id=tenant_id, workflow_id=template_id,
    )
    if payload.only_running:
        qs = qs.filter(current_status__in=["pending", "in_progress", "arbitrate"])
    insts = await qs
    if not insts:
        return {"migrated": 0, "blocked": 0, "blocking_instances": []}

    actor_id = CTX_USER_ID.get()
    from datetime import datetime, timezone
    migrated = 0
    blocking = []
    from tortoise.transactions import in_transaction
    async with in_transaction():
        for inst in insts:
            # current_stage 必须在新版本 stages 中(避免悬空)
            if inst.current_stage not in target_stage_codes:
                blocking.append({
                    "instance_id": inst.id,
                    "current_stage": inst.current_stage,
                    "reason": f"current_stage '{inst.current_stage}' 不在新版本 stages 中",
                })
                continue
            from_version = inst.workflow_version_id
            entry = {
                "from_version": from_version,
                "to_version": version_id,
                "migrated_at": datetime.now(timezone.utc).isoformat(),
                "by_user": actor_id,
            }
            log = list(inst.migration_log or [])
            log.append(entry)
            # 用 filter().update() 避开 auto_now 副作用,且批量写入 migration_log
            await WorkflowInstance.filter(id=inst.id).update(
                workflow_version_id=version_id,
                migration_log=log,
            )
            migrated += 1

    if blocking:
        # 任意阻塞 → 409,前端展示明细,让用户决定:重命名 stage / 等老 instance 完成
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "部分 instance 的 current_stage 在新版本中不存在",
                "migrated": migrated,
                "blocked": len(blocking),
                "blocking_instances": blocking,
            },
        )

    return {
        "migrated": migrated,
        "blocked": 0,
        "blocking_instances": [],
        "target_version_id": version_id,
    }


@router.post(
    "/{template_id}/instantiate",
    summary="基于模板创建实例",
    dependencies=[permission_required("business:workflow:read")],
)
async def instantiate_workflow(
    template_id: int,
    payload: InstantiateIn,
    redis: aioredis.Redis = Depends(init_redis_pool),
):
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="当前会话未绑定租户")
    actor_id = CTX_USER_ID.get()
    try:
        inst = await engine.instantiate(
            workflow_id=template_id, unit_id=payload.unit_id,
            actor_id=actor_id, redis=redis,
        )
    except WorkflowBusy:
        raise HTTPException(status_code=409, detail="资源正被另一会话操作,请重试")
    except WorkflowError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await inst.to_dict()
