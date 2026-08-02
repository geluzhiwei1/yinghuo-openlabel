"""
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-08-07 甲辰年 七月初四 立秋"

from tortoise import fields

from .base import BaseModel, TimestampMixin


class User(BaseModel, TimestampMixin):
    email = fields.CharField(max_length=255, null=True, description="邮箱", index=True, unique=True)
    mobile_phone_no = fields.CharField(max_length=128, null=True, description="手机号:+86xxx", index=True, unique=True)
    password = fields.CharField(max_length=128, null=True, description="密码")
    is_active = fields.BooleanField(default=True, description="是否激活", index=True)
    is_superuser = fields.BooleanField(default=False, description="是否为超级管理员", index=True)
    is_verified = fields.BooleanField(default=False, description="邮箱激活", index=True)
    last_login = fields.DatetimeField(null=True, description="最后登录时间", index=False)
    # 安全相关字段
    failed_login_count = fields.IntField(default=0, description="窗口内连续登录失败次数")
    locked_until = fields.DatetimeField(null=True, description="锁定截止时间")
    password_changed_at = fields.DatetimeField(null=True, description="密码最后修改时间,用于 token ver")
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")
    # SSO 字段(EE 增量)。本地账号两个字段都为 null。
    # external_provider: 'oidc' / 'ldap' / null
    # external_id: OIDC sub / SAML nameid / LDAP DN
    external_provider = fields.CharField(max_length=32, null=True, index=True,
                                         description="外部身份提供者:oidc/ldap,null=本地账号")
    external_id = fields.CharField(max_length=255, null=True, index=True,
                                   description="外部 IdP 主体标识:OIDC sub / LDAP DN")

    class Meta:
        table = "user"
        indexes = (("external_provider", "external_id"),)

    class PydanticMeta:
        # todo
        # computed = ["full_name"]
        ...


class AuditLog(BaseModel, TimestampMixin):
    """统一审计日志。覆盖登录、权限变更、状态机转换、敏感操作。

    action 命名约定:<domain>.<event>,如 user.login_success / user.login_failed /
    user.logout / user.password_change / user.locked / role.grant / role.revoke
    """
    actor_id = fields.BigIntField(null=True, index=True, description="操作者 user_id,系统操作可为 null")
    tenant_id = fields.CharField(max_length=64, null=True, index=True, description="租户 id,阶段 4 启用")
    action = fields.CharField(max_length=128, index=True)
    resource_type = fields.CharField(max_length=64, null=True)
    resource_id = fields.CharField(max_length=128, null=True)
    detail = fields.JSONField(default=dict, description="before / after / extra")
    ip = fields.CharField(max_length=64, null=True)
    user_agent = fields.CharField(max_length=512, null=True)

    class Meta:
        table = "audit_log"


class Permission(BaseModel, TimestampMixin):
    """权限点。key 命名:<face>:<resource>:<action>,如 platform:user:read。
    通配符语义在 resolver 里展开,key 自身不含通配符。
    """
    key = fields.CharField(max_length=128, unique=True, index=True,
                           description="<face>:<resource>:<action>")
    face = fields.CharField(max_length=16, index=True,
                            description="platform | admin | business")
    resource = fields.CharField(max_length=64, index=True)
    action = fields.CharField(max_length=32)
    description = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "rbac_permission"


class Role(BaseModel, TimestampMixin):
    """角色。scope 与 Permission.face 对齐。
    platform/admin scope 的 role.tenant_id 恒为 null(全平台共享);
    business scope 的 role 必须带 tenant_id。
    is_system=True 的角色禁止删除(可改权限);is_builtin=True 同时禁止改名/删表。
    """
    name = fields.CharField(max_length=64, index=True)
    scope = fields.CharField(max_length=16, index=True,
                             description="platform | admin | business")
    tenant_id = fields.CharField(max_length=64, null=True, index=True)
    description = fields.CharField(max_length=255, null=True)
    is_system = fields.BooleanField(default=False, description="系统内置角色,禁止删除")
    is_builtin = fields.BooleanField(default=False,
                                     description="内置且冻结,禁止改名/删除/改 scope")
    permissions: fields.ManyToManyRelation["Permission"] = fields.ManyToManyField(
        "models.Permission", related_name="roles",
        through="rbac_role_permission", forward_key="permission_id", backward_key="role_id",
    )

    class Meta:
        table = "rbac_role"
        unique_together = (("scope", "tenant_id", "name"),)


class UserRole(BaseModel, TimestampMixin):
    """用户-角色绑定。同一 (user, role, tenant) 三元组唯一。
    tenant_id 与 Role.tenant_id 应一致;冗余存储方便按 tenant 过滤。
    """
    user_id = fields.BigIntField(index=True)
    role_id = fields.BigIntField(index=True)
    tenant_id = fields.CharField(max_length=64, null=True, index=True)
    granted_by = fields.BigIntField(null=True, description="授权者 user_id,系统授权为 null")

    class Meta:
        table = "rbac_user_role"
        unique_together = (("user_id", "role_id", "tenant_id"),)


class PlatformTenant(BaseModel, TimestampMixin):
    """租户(平台账号开通的组织实体)。slug 用于 URL/数据隔离键;status 决定可见性。
    status:active | suspended | archived | pending_deletion
    """
    name = fields.CharField(max_length=128, index=True)
    slug = fields.CharField(max_length=64, unique=True, index=True,
                            description="URL/数据隔离用,创建后不可改")
    status = fields.CharField(max_length=32, default="active", index=True)
    plan = fields.CharField(max_length=32, default="free",
                            description="套餐 key,关联计费策略")
    quota = fields.JSONField(default=dict, description="配额,如 {seats: 50, storage_gb: 100}")
    settings = fields.JSONField(default=dict, description="租户级配置覆盖")
    suspended_reason = fields.CharField(max_length=255, null=True)
    suspended_until = fields.DatetimeField(null=True)

    class Meta:
        table = "platform_tenant"


class PlatformFeatureFlag(BaseModel, TimestampMixin):
    """平台级特性开关。rollout_pct 控制按租户灰度比例(0-100)。
    excluded_tenants / included_tenants 维度分别给出黑/白名单 slug 列表。
    """
    key = fields.CharField(max_length=128, unique=True, index=True)
    description = fields.CharField(max_length=255, null=True)
    enabled = fields.BooleanField(default=False, index=True)
    rollout_pct = fields.IntField(default=0, description="0-100,全局灰度比例")
    included_tenants = fields.JSONField(default=list, description="白名单 tenant slug,命中即开")
    excluded_tenants = fields.JSONField(default=list, description="黑名单 tenant slug,命中即关")
    updated_by = fields.BigIntField(null=True)

    class Meta:
        table = "platform_feature_flag"


class PlatformAuditLog(BaseModel, TimestampMixin):
    """跨租户/平台级审计,独立于业务 AuditLog,只给平台管理员看。
    action 命名约定同 AuditLog,但前缀为 platform.*。
    """
    actor_id = fields.BigIntField(null=True, index=True)
    action = fields.CharField(max_length=128, index=True)
    tenant_id = fields.CharField(max_length=64, null=True, index=True,
                                 description="操作涉及的租户 slug;跨租户操作为 null")
    resource_type = fields.CharField(max_length=64, null=True)
    resource_id = fields.CharField(max_length=128, null=True)
    detail = fields.JSONField(default=dict)
    ip = fields.CharField(max_length=64, null=True)
    user_agent = fields.CharField(max_length=512, null=True)

    class Meta:
        table = "platform_audit_log"


class OrgUnit(BaseModel, TimestampMixin):
    """组织单元,租户内的层级树。
    物化路径 path 形如 `/t1/3/7/12`,末尾是该节点 id;祖先查询用 `path__startswith`,
    后代查询用 `id` 反查 children.path__startswith。kind: company | division | team | group。
    """
    tenant_id = fields.CharField(max_length=64, index=True,
                                 description="所属租户 slug,与 PlatformTenant.slug 对齐")
    parent_id = fields.BigIntField(null=True, index=True)
    path = fields.CharField(max_length=512, index=True,
                            description="物化路径,根节点为 '/{tenant_slug}/{id}'")
    kind = fields.CharField(max_length=16, default="team")
    name = fields.CharField(max_length=128)
    description = fields.CharField(max_length=512, null=True)
    is_active = fields.BooleanField(default=True, index=True)

    class Meta:
        table = "org_unit"
        indexes = (("tenant_id", "parent_id"), ("tenant_id", "path"))


class OrgMembership(BaseModel, TimestampMixin):
    """用户在组织单元中的成员关系。同一用户可在多个组织单元,角色粒度也按此挂。
    role: admin | member | leader(组内领导)
    """
    tenant_id = fields.CharField(max_length=64, index=True)
    user_id = fields.BigIntField(index=True)
    org_unit_id = fields.BigIntField(index=True)
    role = fields.CharField(max_length=16, default="member")

    class Meta:
        table = "org_membership"
        unique_together = (("tenant_id", "user_id", "org_unit_id"),)


class TaxonomyVersion(BaseModel, TimestampMixin):
    """标签集版本。content 存完整 ontology JSON(类别 / 属性 / 关系)。
    is_current 控制当前生效版本;同租户同 taxonomy_key 同时只能有一个 is_current=True。
    """
    tenant_id = fields.CharField(max_length=64, index=True)
    taxonomy_key = fields.CharField(max_length=64, index=True,
                                    description="标签集标识,如 'traffic_signal_v1'")
    version_label = fields.CharField(max_length=32,
                                     description="版本号,如 '1.0.0' / '2026-06-r1'")
    content = fields.JSONField(default=dict, description="ontology JSON")
    is_current = fields.BooleanField(default=False, index=True)
    description = fields.CharField(max_length=512, null=True)

    class Meta:
        table = "taxonomy_version"
        unique_together = (("tenant_id", "taxonomy_key", "version_label"),)


class Project(BaseModel, TimestampMixin):
    """标注项目。替代旧 AnnoJob 的语义层(AnnoJob 暂保留以兼容,新代码用 Project)。
    status: draft | active | paused | archived
    """
    tenant_id = fields.CharField(max_length=64, index=True)
    org_unit_id = fields.BigIntField(null=True, index=True,
                                     description="所属组织单元;null 表示租户级项目")
    name = fields.CharField(max_length=128, index=True)
    slug = fields.CharField(max_length=64, index=True,
                            description="项目短标识,租户内唯一")
    status = fields.CharField(max_length=16, default="draft", index=True)
    taxonomy_version_id = fields.BigIntField(null=True, index=True)
    workflow_id = fields.BigIntField(null=True,
                                     description="关联 Workflow,Stage 5 启用")
    settings = fields.JSONField(default=dict,
                                description="项目级配置:采样策略、分配策略、截止时间等")

    class Meta:
        table = "project"
        unique_together = (("tenant_id", "slug"),)
        indexes = (("tenant_id", "org_unit_id"), ("tenant_id", "status"))


class ProjectTemplate(BaseModel, TimestampMixin):
    """项目模板。新建项目时选模板,展开后所有字段可在新项目上单独修改。
    模板只是起始默认值的快照,与后续项目无强引用关系。
    """
    tenant_id = fields.CharField(max_length=64, null=True, index=True,
                                 description="null=全平台共享的内置模板")
    name = fields.CharField(max_length=128)
    slug = fields.CharField(max_length=64, index=True,
                            description="模板短标识,租户内唯一")
    description = fields.CharField(max_length=512, null=True)
    mission = fields.CharField(max_length=64,
                               description="对齐 frontend Mission 枚举,如 objectBBox2d")
    taxonomy_version_id = fields.BigIntField(null=True,
                                              description="建议的标签集版本")
    workflow_id = fields.BigIntField(null=True, description="建议的工作流模板")
    review_policy = fields.JSONField(default=dict,
                                     description="审核策略默认值,如 default_severity、double_review")
    tags = fields.JSONField(default=list, description="标签列表,便于检索")
    is_builtin = fields.BooleanField(default=False, index=True)

    class Meta:
        table = "project_template"
        unique_together = (("tenant_id", "slug"),)


class Workflow(BaseModel, TimestampMixin):
    """工作流模板。stages 存 list[Stage] 序列化后的 JSON(由 spec.WorkflowSpec 校验)。
    is_builtin=True 的模板由 seed 写入(tenant_id=None,全平台共享),不可删/改;
    is_default=True 表示租户默认模板。租户自建模板 tenant_id 必填。
    current_version_id 指向当前生效的 WorkflowVersion;NULL 表示 v0(Stage 10.3 前的存量 workflow)。
    """
    tenant_id = fields.CharField(max_length=64, null=True, index=True,
                                 description="null=全平台共享的内置模板")
    name = fields.CharField(max_length=128)
    slug = fields.CharField(max_length=64, index=True,
                            description="模板短标识,租户内唯一")
    description = fields.CharField(max_length=512, null=True)
    stages = fields.JSONField(default=list, description="list[Stage] spec")
    is_default = fields.BooleanField(default=False, index=True)
    is_builtin = fields.BooleanField(default=False, index=True)
    current_version_id = fields.BigIntField(null=True, index=True,
                                             description="Stage 10.3:当前生效的 WorkflowVersion.id")

    class Meta:
        table = "workflow"
        unique_together = (("tenant_id", "slug"),)


class WorkflowVersion(BaseModel, TimestampMixin):
    """Stage 10.3:Workflow 的不可变快照。每次 stages 改动 fork 新版本。

    instance.workflow_version_id 引用本表 id;activate 切换 active 标记,
    不改 instance 已绑定的版本(已运行的 instance 仍走它当时的版本)。
    """
    tenant_id = fields.CharField(max_length=64, index=True)
    workflow_id = fields.BigIntField(index=True, description="所属 Workflow.id")
    version_no = fields.IntField(description="租户内自增,从 1 起")
    stages = fields.JSONField(default=list, description="list[Stage] spec 快照")
    changelog = fields.CharField(max_length=512, default="")
    created_by = fields.BigIntField(null=True)
    is_active = fields.BooleanField(default=False, index=True)

    class Meta:
        table = "workflow_version"
        unique_together = (("workflow_id", "version_no"),)
        indexes = (("tenant_id", "workflow_id", "is_active"),)


class Unit(BaseModel, TimestampMixin):
    """最小工作单元:一个 frame 的一个 mission。一个 unit 对应一个 WorkflowInstance。
    stage_status: pending / in_progress / done
    """
    tenant_id = fields.CharField(max_length=64, index=True)
    project_id = fields.BigIntField(index=True)
    batch_id = fields.BigIntField(null=True, index=True)
    seq = fields.CharField(max_length=128, index=True)
    stream = fields.CharField(max_length=128)
    frame = fields.IntField()
    mission = fields.CharField(max_length=64, index=True)
    assignee_id = fields.BigIntField(null=True, index=True)
    reviewer_id = fields.BigIntField(null=True, index=True)
    current_stage = fields.CharField(max_length=64, null=True, index=True)
    stage_status = fields.CharField(max_length=16, default="pending", index=True)
    data_version = fields.IntField(default=0, description="乐观锁/版本号,每次 label 写入自增")

    class Meta:
        table = "workflow_unit"
        unique_together = (("tenant_id", "project_id", "seq", "stream", "frame", "mission"),)
        indexes = (("tenant_id", "project_id", "assignee_id", "stage_status"),
                   ("tenant_id", "reviewer_id", "current_stage"))


class Batch(BaseModel, TimestampMixin):
    """批次:Project 下的批量任务容器,绑定数据序列与标注员池,定义分派策略。
    status: pending / active / done / cancelled
    assignee_strategy: manual(认领)/ round_robin(轮转)/ load_aware(Redis ZSET 取最闲)
    reviewers / qa_pool 暂存,Stage 5 工作流引擎尚未按 pool 自动分派 reviewer。
    """
    tenant_id = fields.CharField(max_length=64, index=True)
    project_id = fields.BigIntField(index=True)
    name = fields.CharField(max_length=128)
    slug = fields.CharField(max_length=64, index=True,
                            description="项目内唯一短标识")
    mission = fields.CharField(max_length=64,
                               description="对齐 frontend Mission 枚举,如 objectBBox2d")
    seq_uuid = fields.CharField(max_length=64,
                                description="数据序列 ObjectId 字符串,指向 data_seq_meta")
    assignee_strategy = fields.CharField(max_length=16, default="manual", index=True)
    assignees = fields.JSONField(default=list, description="标注员 user_id 列表")
    reviewers = fields.JSONField(default=list, description="审核员 user_id 列表(预留)")
    qa_pool = fields.JSONField(default=list, description="终检员 user_id 列表(预留)")
    frame_range = fields.JSONField(default=dict,
                                   description='{"start","end","step"} 任一缺省视为不限')
    sampling_rate = fields.FloatField(default=1.0, description="0-1,sha256 hash 折算")
    status = fields.CharField(max_length=16, default="pending", index=True)

    class Meta:
        table = "batch"
        unique_together = (("tenant_id", "project_id", "slug"),)
        indexes = (("tenant_id", "project_id", "status"),)


class WorkflowInstance(BaseModel, TimestampMixin):
    """工作流运行时实例。一个 unit 走一个 instance。
    current_status: pending / in_progress / approved / rejected / arbitrate
    stage_history 是 list[StageRun] JSON,StageVote 是它的扁平投影便于过滤统计。
    workflow_version_id:Stage 10.3 引入,绑定实例化时的 WorkflowVersion;NULL 表示 v0(存量)。
    migration_log:每次版本迁移追加一条 {from_version, to_version, migrated_at, by_user}。
    """
    tenant_id = fields.CharField(max_length=64, index=True)
    project_id = fields.BigIntField(index=True)
    unit_id = fields.BigIntField(index=True)
    workflow_id = fields.BigIntField(index=True, description="模板 id")
    workflow_version_id = fields.BigIntField(null=True, index=True,
                                              description="Stage 10.3:实例化时的版本")
    current_stage = fields.CharField(max_length=64, index=True)
    current_status = fields.CharField(max_length=16, default="pending", index=True)
    stage_history = fields.JSONField(default=list, description="list[StageRun]")
    sample_skipped = fields.BooleanField(default=False, index=True)
    data_version = fields.IntField(default=0, description="对应 unit.data_version,审核视角")
    migration_log = fields.JSONField(default=list,
                                      description="list[{from_version,to_version,migrated_at,by_user}]")

    class Meta:
        table = "workflow_instance"
        indexes = (("tenant_id", "project_id", "current_stage", "current_status"),
                   ("tenant_id", "unit_id",))


class StageVote(BaseModel, TimestampMixin):
    """stage_history 的扁平投影,便于按 actor / stage 过滤统计。
    stratified / adaptive 抽样查询、KPI 计算等都走这张表。
    """
    tenant_id = fields.CharField(max_length=64, index=True)
    workflow_id = fields.BigIntField(index=True)
    instance_id = fields.BigIntField(index=True)
    stage_code = fields.CharField(max_length=64, index=True)
    actor_id = fields.BigIntField(index=True)
    decision = fields.CharField(max_length=16, index=True,
                                description="approved / rejected / escalated")
    reject_category = fields.CharField(max_length=32, null=True, index=True)
    reject_severity = fields.CharField(max_length=16, null=True)
    sample_skipped = fields.BooleanField(default=False)

    class Meta:
        table = "workflow_stage_vote"
        indexes = (("tenant_id", "workflow_id", "stage_code", "actor_id"),
                   ("tenant_id", "instance_id", "stage_code"))