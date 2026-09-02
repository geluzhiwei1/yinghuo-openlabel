from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "actor_id" BIGINT,
    "tenant_id" VARCHAR(64),
    "action" VARCHAR(128) NOT NULL,
    "resource_type" VARCHAR(64),
    "resource_id" VARCHAR(128),
    "detail" JSONB NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(512)
);
CREATE INDEX IF NOT EXISTS "idx_audit_log_created_277f5d" ON "audit_log" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_log_updated_4bb07a" ON "audit_log" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_audit_log_actor_i_3f2ecd" ON "audit_log" ("actor_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_tenant__b864de" ON "audit_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_action_286eba" ON "audit_log" ("action");
COMMENT ON COLUMN "audit_log"."actor_id" IS '操作者 user_id,系统操作可为 null';
COMMENT ON COLUMN "audit_log"."tenant_id" IS '租户 id,阶段 4 启用';
COMMENT ON COLUMN "audit_log"."detail" IS 'before / after / extra';
COMMENT ON TABLE "audit_log" IS '统一审计日志。覆盖登录、权限变更、状态机转换、敏感操作。';
CREATE TABLE IF NOT EXISTS "batch" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "project_id" BIGINT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "mission" VARCHAR(64) NOT NULL,
    "seq_uuid" VARCHAR(64) NOT NULL,
    "assignee_strategy" VARCHAR(16) NOT NULL,
    "assignees" JSONB NOT NULL,
    "reviewers" JSONB NOT NULL,
    "qa_pool" JSONB NOT NULL,
    "frame_range" JSONB NOT NULL,
    "sampling_rate" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    CONSTRAINT "uid_batch_tenant__8115a3" UNIQUE ("tenant_id", "project_id", "slug")
);
CREATE INDEX IF NOT EXISTS "idx_batch_created_2d5bac" ON "batch" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_batch_updated_3eb2dd" ON "batch" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_batch_tenant__fe5dbe" ON "batch" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_batch_project_fcaa4b" ON "batch" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_batch_slug_93623e" ON "batch" ("slug");
CREATE INDEX IF NOT EXISTS "idx_batch_assigne_18e4da" ON "batch" ("assignee_strategy");
CREATE INDEX IF NOT EXISTS "idx_batch_status_13db49" ON "batch" ("status");
CREATE INDEX IF NOT EXISTS "idx_batch_tenant__b9a8d1" ON "batch" ("tenant_id", "project_id", "status");
COMMENT ON COLUMN "batch"."slug" IS '项目内唯一短标识';
COMMENT ON COLUMN "batch"."mission" IS '对齐 frontend Mission 枚举,如 objectBBox2d';
COMMENT ON COLUMN "batch"."seq_uuid" IS '数据序列 ObjectId 字符串,指向 data_seq_meta';
COMMENT ON COLUMN "batch"."assignees" IS '标注员 user_id 列表';
COMMENT ON COLUMN "batch"."reviewers" IS '审核员 user_id 列表(预留)';
COMMENT ON COLUMN "batch"."qa_pool" IS '终检员 user_id 列表(预留)';
COMMENT ON COLUMN "batch"."frame_range" IS '{\"start\",\"end\",\"step\"} 任一缺省视为不限';
COMMENT ON COLUMN "batch"."sampling_rate" IS '0-1,sha256 hash 折算';
COMMENT ON TABLE "batch" IS '批次:Project 下的批量任务容器,绑定数据序列与标注员池,定义分派策略。';
CREATE TABLE IF NOT EXISTS "org_membership" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "user_id" BIGINT NOT NULL,
    "org_unit_id" BIGINT NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    CONSTRAINT "uid_org_members_tenant__d18f0e" UNIQUE ("tenant_id", "user_id", "org_unit_id")
);
CREATE INDEX IF NOT EXISTS "idx_org_members_created_4ba84d" ON "org_membership" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_org_members_updated_6b546e" ON "org_membership" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_org_members_tenant__400719" ON "org_membership" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_org_members_user_id_c33862" ON "org_membership" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_org_members_org_uni_afcf4a" ON "org_membership" ("org_unit_id");
COMMENT ON TABLE "org_membership" IS '用户在组织单元中的成员关系。同一用户可在多个组织单元,角色粒度也按此挂。';
CREATE TABLE IF NOT EXISTS "org_unit" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "parent_id" BIGINT,
    "path" VARCHAR(512) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "is_active" BOOL NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_org_unit_created_6e2367" ON "org_unit" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_org_unit_updated_8ae2d9" ON "org_unit" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_org_unit_tenant__596129" ON "org_unit" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_org_unit_parent__53a68c" ON "org_unit" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_org_unit_path_8aebd4" ON "org_unit" ("path");
CREATE INDEX IF NOT EXISTS "idx_org_unit_is_acti_3de029" ON "org_unit" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_org_unit_tenant__d60c76" ON "org_unit" ("tenant_id", "parent_id");
CREATE INDEX IF NOT EXISTS "idx_org_unit_tenant__9e566b" ON "org_unit" ("tenant_id", "path");
COMMENT ON COLUMN "org_unit"."tenant_id" IS '所属租户 slug,与 PlatformTenant.slug 对齐';
COMMENT ON COLUMN "org_unit"."path" IS '物化路径,根节点为 ''/{tenant_slug}/{id}''';
COMMENT ON TABLE "org_unit" IS '组织单元,租户内的层级树。';
CREATE TABLE IF NOT EXISTS "rbac_permission" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "key" VARCHAR(128) NOT NULL UNIQUE,
    "face" VARCHAR(16) NOT NULL,
    "resource" VARCHAR(64) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "description" VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS "idx_rbac_permis_created_bbc04e" ON "rbac_permission" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_rbac_permis_updated_0f0324" ON "rbac_permission" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_rbac_permis_key_252fc8" ON "rbac_permission" ("key");
CREATE INDEX IF NOT EXISTS "idx_rbac_permis_face_2ff7e6" ON "rbac_permission" ("face");
CREATE INDEX IF NOT EXISTS "idx_rbac_permis_resourc_5c9969" ON "rbac_permission" ("resource");
COMMENT ON COLUMN "rbac_permission"."key" IS '<face>:<resource>:<action>';
COMMENT ON COLUMN "rbac_permission"."face" IS 'platform | admin | business';
COMMENT ON TABLE "rbac_permission" IS '权限点。key 命名:<face>:<resource>:<action>,如 platform:user:read。';
CREATE TABLE IF NOT EXISTS "platform_audit_log" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "actor_id" BIGINT,
    "action" VARCHAR(128) NOT NULL,
    "tenant_id" VARCHAR(64),
    "resource_type" VARCHAR(64),
    "resource_id" VARCHAR(128),
    "detail" JSONB NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(512)
);
CREATE INDEX IF NOT EXISTS "idx_platform_au_created_a6e472" ON "platform_audit_log" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_platform_au_updated_1a9d07" ON "platform_audit_log" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_platform_au_actor_i_457b45" ON "platform_audit_log" ("actor_id");
CREATE INDEX IF NOT EXISTS "idx_platform_au_action_cf572d" ON "platform_audit_log" ("action");
CREATE INDEX IF NOT EXISTS "idx_platform_au_tenant__5ad903" ON "platform_audit_log" ("tenant_id");
COMMENT ON COLUMN "platform_audit_log"."tenant_id" IS '操作涉及的租户 slug;跨租户操作为 null';
COMMENT ON TABLE "platform_audit_log" IS '跨租户/平台级审计,独立于业务 AuditLog,只给平台管理员看。';
CREATE TABLE IF NOT EXISTS "platform_feature_flag" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "key" VARCHAR(128) NOT NULL UNIQUE,
    "description" VARCHAR(255),
    "enabled" BOOL NOT NULL,
    "rollout_pct" INT NOT NULL,
    "included_tenants" JSONB NOT NULL,
    "excluded_tenants" JSONB NOT NULL,
    "updated_by" BIGINT
);
CREATE INDEX IF NOT EXISTS "idx_platform_fe_created_9d15ce" ON "platform_feature_flag" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_platform_fe_updated_b7fb0c" ON "platform_feature_flag" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_platform_fe_key_1ae73e" ON "platform_feature_flag" ("key");
CREATE INDEX IF NOT EXISTS "idx_platform_fe_enabled_3d2dd3" ON "platform_feature_flag" ("enabled");
COMMENT ON COLUMN "platform_feature_flag"."rollout_pct" IS '0-100,全局灰度比例';
COMMENT ON COLUMN "platform_feature_flag"."included_tenants" IS '白名单 tenant slug,命中即开';
COMMENT ON COLUMN "platform_feature_flag"."excluded_tenants" IS '黑名单 tenant slug,命中即关';
COMMENT ON TABLE "platform_feature_flag" IS '平台级特性开关。rollout_pct 控制按租户灰度比例(0-100)。';
CREATE TABLE IF NOT EXISTS "platform_tenant" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(64) NOT NULL UNIQUE,
    "status" VARCHAR(32) NOT NULL,
    "plan" VARCHAR(32) NOT NULL,
    "quota" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "suspended_reason" VARCHAR(255),
    "suspended_until" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_platform_te_created_bd43a0" ON "platform_tenant" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_platform_te_updated_16be3c" ON "platform_tenant" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_platform_te_name_51bce2" ON "platform_tenant" ("name");
CREATE INDEX IF NOT EXISTS "idx_platform_te_slug_07fa2d" ON "platform_tenant" ("slug");
CREATE INDEX IF NOT EXISTS "idx_platform_te_status_07810d" ON "platform_tenant" ("status");
COMMENT ON COLUMN "platform_tenant"."slug" IS 'URL/数据隔离用,创建后不可改';
COMMENT ON COLUMN "platform_tenant"."plan" IS '套餐 key,关联计费策略';
COMMENT ON COLUMN "platform_tenant"."quota" IS '配额,如 {seats: 50, storage_gb: 100}';
COMMENT ON COLUMN "platform_tenant"."settings" IS '租户级配置覆盖';
COMMENT ON TABLE "platform_tenant" IS '租户(平台账号开通的组织实体)。slug 用于 URL/数据隔离键;status 决定可见性。';
CREATE TABLE IF NOT EXISTS "project" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "org_unit_id" BIGINT,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "taxonomy_version_id" BIGINT,
    "workflow_id" BIGINT,
    "settings" JSONB NOT NULL,
    CONSTRAINT "uid_project_tenant__dc34c4" UNIQUE ("tenant_id", "slug")
);
CREATE INDEX IF NOT EXISTS "idx_project_created_efca31" ON "project" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_project_updated_d3b2ab" ON "project" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_project_tenant__2c5586" ON "project" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_project_org_uni_1a6add" ON "project" ("org_unit_id");
CREATE INDEX IF NOT EXISTS "idx_project_name_4d952a" ON "project" ("name");
CREATE INDEX IF NOT EXISTS "idx_project_slug_2d2cec" ON "project" ("slug");
CREATE INDEX IF NOT EXISTS "idx_project_status_d181f7" ON "project" ("status");
CREATE INDEX IF NOT EXISTS "idx_project_taxonom_fd374b" ON "project" ("taxonomy_version_id");
CREATE INDEX IF NOT EXISTS "idx_project_tenant__ccbf9d" ON "project" ("tenant_id", "org_unit_id");
CREATE INDEX IF NOT EXISTS "idx_project_tenant__038894" ON "project" ("tenant_id", "status");
COMMENT ON COLUMN "project"."org_unit_id" IS '所属组织单元;null 表示租户级项目';
COMMENT ON COLUMN "project"."slug" IS '项目短标识,租户内唯一';
COMMENT ON COLUMN "project"."workflow_id" IS '关联 Workflow,Stage 5 启用';
COMMENT ON COLUMN "project"."settings" IS '项目级配置:采样策略、分配策略、截止时间等';
COMMENT ON TABLE "project" IS '标注项目。替代旧 AnnoJob 的语义层(AnnoJob 暂保留以兼容,新代码用 Project)。';
CREATE TABLE IF NOT EXISTS "project_template" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64),
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "description" VARCHAR(512),
    "mission" VARCHAR(64) NOT NULL,
    "taxonomy_version_id" BIGINT,
    "workflow_id" BIGINT,
    "review_policy" JSONB NOT NULL,
    "tags" JSONB NOT NULL,
    "is_builtin" BOOL NOT NULL,
    CONSTRAINT "uid_project_tem_tenant__f51cfb" UNIQUE ("tenant_id", "slug")
);
CREATE INDEX IF NOT EXISTS "idx_project_tem_created_5c4397" ON "project_template" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_project_tem_updated_83a0fa" ON "project_template" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_project_tem_tenant__a8830e" ON "project_template" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_project_tem_slug_3807c5" ON "project_template" ("slug");
CREATE INDEX IF NOT EXISTS "idx_project_tem_is_buil_dd3c6e" ON "project_template" ("is_builtin");
COMMENT ON COLUMN "project_template"."tenant_id" IS 'null=全平台共享的内置模板';
COMMENT ON COLUMN "project_template"."slug" IS '模板短标识,租户内唯一';
COMMENT ON COLUMN "project_template"."mission" IS '对齐 frontend Mission 枚举,如 objectBBox2d';
COMMENT ON COLUMN "project_template"."taxonomy_version_id" IS '建议的标签集版本';
COMMENT ON COLUMN "project_template"."workflow_id" IS '建议的工作流模板';
COMMENT ON COLUMN "project_template"."review_policy" IS '审核策略默认值,如 default_severity、double_review';
COMMENT ON COLUMN "project_template"."tags" IS '标签列表,便于检索';
COMMENT ON TABLE "project_template" IS '项目模板。新建项目时选模板,展开后所有字段可在新项目上单独修改。';
CREATE TABLE IF NOT EXISTS "rbac_role" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "tenant_id" VARCHAR(64),
    "description" VARCHAR(255),
    "is_system" BOOL NOT NULL,
    "is_builtin" BOOL NOT NULL,
    CONSTRAINT "uid_rbac_role_scope_c75ba3" UNIQUE ("scope", "tenant_id", "name")
);
CREATE INDEX IF NOT EXISTS "idx_rbac_role_created_e57987" ON "rbac_role" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_rbac_role_updated_afed44" ON "rbac_role" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_rbac_role_name_37cf6f" ON "rbac_role" ("name");
CREATE INDEX IF NOT EXISTS "idx_rbac_role_scope_f280fd" ON "rbac_role" ("scope");
CREATE INDEX IF NOT EXISTS "idx_rbac_role_tenant__e70173" ON "rbac_role" ("tenant_id");
COMMENT ON COLUMN "rbac_role"."scope" IS 'platform | admin | business';
COMMENT ON COLUMN "rbac_role"."is_system" IS '系统内置角色,禁止删除';
COMMENT ON COLUMN "rbac_role"."is_builtin" IS '内置且冻结,禁止改名/删除/改 scope';
COMMENT ON TABLE "rbac_role" IS '角色。scope 与 Permission.face 对齐。';
CREATE TABLE IF NOT EXISTS "workflow_stage_vote" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "workflow_id" BIGINT NOT NULL,
    "instance_id" BIGINT NOT NULL,
    "stage_code" VARCHAR(64) NOT NULL,
    "actor_id" BIGINT NOT NULL,
    "decision" VARCHAR(16) NOT NULL,
    "reject_category" VARCHAR(32),
    "reject_severity" VARCHAR(16),
    "sample_skipped" BOOL NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_workflow_st_created_0328a8" ON "workflow_stage_vote" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_updated_a3c66c" ON "workflow_stage_vote" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_tenant__b1c4d8" ON "workflow_stage_vote" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_workflo_fb78a9" ON "workflow_stage_vote" ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_instanc_9da2f6" ON "workflow_stage_vote" ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_stage_c_847641" ON "workflow_stage_vote" ("stage_code");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_actor_i_5c9804" ON "workflow_stage_vote" ("actor_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_decisio_3c999d" ON "workflow_stage_vote" ("decision");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_reject__8f6d8e" ON "workflow_stage_vote" ("reject_category");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_tenant__a710c5" ON "workflow_stage_vote" ("tenant_id", "workflow_id", "stage_code", "actor_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_st_tenant__907d0a" ON "workflow_stage_vote" ("tenant_id", "instance_id", "stage_code");
COMMENT ON COLUMN "workflow_stage_vote"."decision" IS 'approved / rejected / escalated';
COMMENT ON TABLE "workflow_stage_vote" IS 'stage_history 的扁平投影,便于按 actor / stage 过滤统计。';
CREATE TABLE IF NOT EXISTS "taxonomy_version" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "taxonomy_key" VARCHAR(64) NOT NULL,
    "version_label" VARCHAR(32) NOT NULL,
    "content" JSONB NOT NULL,
    "is_current" BOOL NOT NULL,
    "description" VARCHAR(512),
    CONSTRAINT "uid_taxonomy_ve_tenant__e48d10" UNIQUE ("tenant_id", "taxonomy_key", "version_label")
);
CREATE INDEX IF NOT EXISTS "idx_taxonomy_ve_created_349447" ON "taxonomy_version" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_taxonomy_ve_updated_ab57f1" ON "taxonomy_version" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_taxonomy_ve_tenant__603230" ON "taxonomy_version" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_taxonomy_ve_taxonom_57cc57" ON "taxonomy_version" ("taxonomy_key");
CREATE INDEX IF NOT EXISTS "idx_taxonomy_ve_is_curr_e8f186" ON "taxonomy_version" ("is_current");
COMMENT ON COLUMN "taxonomy_version"."taxonomy_key" IS '标签集标识,如 ''traffic_signal_v1''';
COMMENT ON COLUMN "taxonomy_version"."version_label" IS '版本号,如 ''1.0.0'' / ''2026-06-r1''';
COMMENT ON COLUMN "taxonomy_version"."content" IS 'ontology JSON';
COMMENT ON TABLE "taxonomy_version" IS '标签集版本。content 存完整 ontology JSON(类别 / 属性 / 关系)。';
CREATE TABLE IF NOT EXISTS "workflow_unit" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "project_id" BIGINT NOT NULL,
    "batch_id" BIGINT,
    "seq" VARCHAR(128) NOT NULL,
    "stream" VARCHAR(128) NOT NULL,
    "frame" INT NOT NULL,
    "mission" VARCHAR(64) NOT NULL,
    "assignee_id" BIGINT,
    "reviewer_id" BIGINT,
    "current_stage" VARCHAR(64),
    "stage_status" VARCHAR(16) NOT NULL,
    "data_version" INT NOT NULL,
    CONSTRAINT "uid_workflow_un_tenant__976d70" UNIQUE ("tenant_id", "project_id", "seq", "stream", "frame", "mission")
);
CREATE INDEX IF NOT EXISTS "idx_workflow_un_created_e4d903" ON "workflow_unit" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_updated_e89823" ON "workflow_unit" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_tenant__e1e389" ON "workflow_unit" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_project_645080" ON "workflow_unit" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_batch_i_4e6729" ON "workflow_unit" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_seq_2674bd" ON "workflow_unit" ("seq");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_mission_182b0d" ON "workflow_unit" ("mission");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_assigne_9bec4b" ON "workflow_unit" ("assignee_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_reviewe_6b9fff" ON "workflow_unit" ("reviewer_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_current_93029a" ON "workflow_unit" ("current_stage");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_stage_s_adc553" ON "workflow_unit" ("stage_status");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_tenant__318745" ON "workflow_unit" ("tenant_id", "project_id", "assignee_id", "stage_status");
CREATE INDEX IF NOT EXISTS "idx_workflow_un_tenant__25c0b4" ON "workflow_unit" ("tenant_id", "reviewer_id", "current_stage");
COMMENT ON COLUMN "workflow_unit"."data_version" IS '乐观锁/版本号,每次 label 写入自增';
COMMENT ON TABLE "workflow_unit" IS '最小工作单元:一个 frame 的一个 mission。一个 unit 对应一个 WorkflowInstance。';
CREATE TABLE IF NOT EXISTS "user" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "email" VARCHAR(255) UNIQUE,
    "mobile_phone_no" VARCHAR(128) UNIQUE,
    "password" VARCHAR(128),
    "is_active" BOOL NOT NULL,
    "is_superuser" BOOL NOT NULL,
    "is_verified" BOOL NOT NULL,
    "last_login" TIMESTAMPTZ,
    "failed_login_count" INT NOT NULL,
    "locked_until" TIMESTAMPTZ,
    "password_changed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_user_created_b19d59" ON "user" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_user_updated_dfdb43" ON "user" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_user_email_1b4f1c" ON "user" ("email");
CREATE INDEX IF NOT EXISTS "idx_user_mobile__b5ec00" ON "user" ("mobile_phone_no");
CREATE INDEX IF NOT EXISTS "idx_user_is_acti_83722a" ON "user" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_user_is_supe_b8a218" ON "user" ("is_superuser");
CREATE INDEX IF NOT EXISTS "idx_user_is_veri_1271f7" ON "user" ("is_verified");
COMMENT ON COLUMN "user"."email" IS '邮箱';
COMMENT ON COLUMN "user"."mobile_phone_no" IS '手机号:+86xxx';
COMMENT ON COLUMN "user"."password" IS '密码';
COMMENT ON COLUMN "user"."is_active" IS '是否激活';
COMMENT ON COLUMN "user"."is_superuser" IS '是否为超级管理员';
COMMENT ON COLUMN "user"."is_verified" IS '邮箱激活';
COMMENT ON COLUMN "user"."last_login" IS '最后登录时间';
COMMENT ON COLUMN "user"."failed_login_count" IS '窗口内连续登录失败次数';
COMMENT ON COLUMN "user"."locked_until" IS '锁定截止时间';
COMMENT ON COLUMN "user"."password_changed_at" IS '密码最后修改时间,用于 token ver';
COMMENT ON COLUMN "user"."deleted_at" IS '软删除时间';
CREATE TABLE IF NOT EXISTS "rbac_user_role" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "tenant_id" VARCHAR(64),
    "granted_by" BIGINT,
    CONSTRAINT "uid_rbac_user_r_user_id_726c7e" UNIQUE ("user_id", "role_id", "tenant_id")
);
CREATE INDEX IF NOT EXISTS "idx_rbac_user_r_created_88f8ff" ON "rbac_user_role" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_rbac_user_r_updated_feaa71" ON "rbac_user_role" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_rbac_user_r_user_id_931625" ON "rbac_user_role" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_rbac_user_r_role_id_7ab225" ON "rbac_user_role" ("role_id");
CREATE INDEX IF NOT EXISTS "idx_rbac_user_r_tenant__d3247e" ON "rbac_user_role" ("tenant_id");
COMMENT ON COLUMN "rbac_user_role"."granted_by" IS '授权者 user_id,系统授权为 null';
COMMENT ON TABLE "rbac_user_role" IS '用户-角色绑定。同一 (user, role, tenant) 三元组唯一。';
CREATE TABLE IF NOT EXISTS "workflow" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64),
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "description" VARCHAR(512),
    "stages" JSONB NOT NULL,
    "is_default" BOOL NOT NULL,
    "is_builtin" BOOL NOT NULL,
    "current_version_id" BIGINT,
    CONSTRAINT "uid_workflow_tenant__3f71fc" UNIQUE ("tenant_id", "slug")
);
CREATE INDEX IF NOT EXISTS "idx_workflow_created_c2a8eb" ON "workflow" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_updated_d2b37a" ON "workflow" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_tenant__57c058" ON "workflow" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_slug_50dcbe" ON "workflow" ("slug");
CREATE INDEX IF NOT EXISTS "idx_workflow_is_defa_7af010" ON "workflow" ("is_default");
CREATE INDEX IF NOT EXISTS "idx_workflow_is_buil_32edb7" ON "workflow" ("is_builtin");
CREATE INDEX IF NOT EXISTS "idx_workflow_current_816c0c" ON "workflow" ("current_version_id");
COMMENT ON COLUMN "workflow"."tenant_id" IS 'null=全平台共享的内置模板';
COMMENT ON COLUMN "workflow"."slug" IS '模板短标识,租户内唯一';
COMMENT ON COLUMN "workflow"."stages" IS 'list[Stage] spec';
COMMENT ON COLUMN "workflow"."current_version_id" IS 'Stage 10.3:当前生效的 WorkflowVersion.id';
COMMENT ON TABLE "workflow" IS '工作流模板。stages 存 list[Stage] 序列化后的 JSON(由 spec.WorkflowSpec 校验)。';
CREATE TABLE IF NOT EXISTS "workflow_instance" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "project_id" BIGINT NOT NULL,
    "unit_id" BIGINT NOT NULL,
    "workflow_id" BIGINT NOT NULL,
    "workflow_version_id" BIGINT,
    "current_stage" VARCHAR(64) NOT NULL,
    "current_status" VARCHAR(16) NOT NULL,
    "stage_history" JSONB NOT NULL,
    "sample_skipped" BOOL NOT NULL,
    "data_version" INT NOT NULL,
    "migration_log" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_workflow_in_created_0bb29c" ON "workflow_instance" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_updated_5c087d" ON "workflow_instance" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_tenant__6ebc41" ON "workflow_instance" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_project_eb09a6" ON "workflow_instance" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_unit_id_442cb0" ON "workflow_instance" ("unit_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_workflo_bbcb61" ON "workflow_instance" ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_workflo_1a86d8" ON "workflow_instance" ("workflow_version_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_current_82947d" ON "workflow_instance" ("current_stage");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_current_803bc1" ON "workflow_instance" ("current_status");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_sample__25a379" ON "workflow_instance" ("sample_skipped");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_tenant__a8f00f" ON "workflow_instance" ("tenant_id", "project_id", "current_stage", "current_status");
CREATE INDEX IF NOT EXISTS "idx_workflow_in_tenant__6beda5" ON "workflow_instance" ("tenant_id", "unit_id");
COMMENT ON COLUMN "workflow_instance"."workflow_id" IS '模板 id';
COMMENT ON COLUMN "workflow_instance"."workflow_version_id" IS 'Stage 10.3:实例化时的版本';
COMMENT ON COLUMN "workflow_instance"."stage_history" IS 'list[StageRun]';
COMMENT ON COLUMN "workflow_instance"."data_version" IS '对应 unit.data_version,审核视角';
COMMENT ON COLUMN "workflow_instance"."migration_log" IS 'list[{from_version,to_version,migrated_at,by_user}]';
COMMENT ON TABLE "workflow_instance" IS '工作流运行时实例。一个 unit 走一个 instance。';
CREATE TABLE IF NOT EXISTS "workflow_version" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "workflow_id" BIGINT NOT NULL,
    "version_no" INT NOT NULL,
    "stages" JSONB NOT NULL,
    "changelog" VARCHAR(512) NOT NULL,
    "created_by" BIGINT,
    "is_active" BOOL NOT NULL,
    CONSTRAINT "uid_workflow_ve_workflo_923591" UNIQUE ("workflow_id", "version_no")
);
CREATE INDEX IF NOT EXISTS "idx_workflow_ve_created_8163f9" ON "workflow_version" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_ve_updated_c11081" ON "workflow_version" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_ve_tenant__aba338" ON "workflow_version" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_ve_workflo_4d4444" ON "workflow_version" ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_ve_is_acti_cdfb08" ON "workflow_version" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_workflow_ve_tenant__8c63b9" ON "workflow_version" ("tenant_id", "workflow_id", "is_active");
COMMENT ON COLUMN "workflow_version"."workflow_id" IS '所属 Workflow.id';
COMMENT ON COLUMN "workflow_version"."version_no" IS '租户内自增,从 1 起';
COMMENT ON COLUMN "workflow_version"."stages" IS 'list[Stage] spec 快照';
COMMENT ON TABLE "workflow_version" IS 'Stage 10.3:Workflow 的不可变快照。每次 stages 改动 fork 新版本。';
CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS "rbac_role_permission" (
    "role_id" BIGINT NOT NULL REFERENCES "rbac_role" ("id") ON DELETE CASCADE,
    "permission_id" BIGINT NOT NULL REFERENCES "rbac_permission" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_rbac_role_p_role_id_0728c2" ON "rbac_role_permission" ("role_id", "permission_id");"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
    "7xXw=="
)
