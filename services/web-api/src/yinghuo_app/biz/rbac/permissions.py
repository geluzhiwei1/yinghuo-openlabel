"""权限字典。所有 permission key 在此声明,供路由静态引用与测试枚举。

key 命名约定:`<face>:<resource>:<action>`
- face ∈ {platform, admin, business}
- action 命名:read / write / create / delete / approve / export / manage
  - read: 查看/列表/导出元信息
  - write: 修改(包含 create/update/delete,粒度不够时再细分)
  - manage: 全权管理,包含授权等敏感动作

通配符(* 匹配任意层级)仅在 resolver 内部使用,不写入此字典。
"""
from typing import Final

# —— platform 面:跨租户的全平台管理 ——
PLATFORM_PERMISSIONS: Final[dict[str, str]] = {
    "platform:tenant:read":   "查看租户列表与详情",
    "platform:tenant:write":  "创建/修改/停用租户",
    "platform:user:read":     "跨租户查看所有用户",
    "platform:user:write":    "创建/修改/停用任意租户用户",
    "platform:role:read":     "查看平台面角色与权限",
    "platform:role:write":    "创建/修改平台面角色,授予角色",
    "platform:permission:read": "查看权限点字典",
    "platform:audit:read":    "读取全平台审计日志",
    "platform:feature:read":  "查看平台级特性开关",
    "platform:feature:write": "启用/禁用平台级特性开关",
    "platform:flow:read":     "查看平台共享的推理流水线",
    "platform:flow:write":    "创建/修改平台共享的推理流水线",
    "platform:func:read":     "查看平台共享的 DNN 函数",
    "platform:func:write":    "创建/修改平台共享的 DNN 函数",
    "platform:model:read":    "查看平台共享的模型清单",
    "platform:model:write":   "注册/下线平台共享的模型",
    "platform:ops:read":      "查看 SaaS 运维看板(聚合统计)",
    "platform:backup:read":   "查看备份 job 状态与列表",
    "platform:backup:write":  "触发新备份 job(pg_dump/mongodump)",
    "platform:billing:read":  "查看租户 Stripe 订阅状态",
    "platform:billing:write": "创建 Stripe Customer Portal session",
}

# —— admin 面:单租户内部的组织/资源管理 ——
ADMIN_PERMISSIONS: Final[dict[str, str]] = {
    "admin:user:read":      "查看本租户用户",
    "admin:user:write":     "创建/修改/停用本租户用户,重置密码",
    "admin:role:read":      "查看本租户角色",
    "admin:role:write":     "创建/修改本租户角色并授予权限",
    "admin:team:read":      "查看团队/部门树",
    "admin:team:write":     "创建/修改团队与部门",
    "admin:project:read":   "查看本租户所有标注项目",
    "admin:project:write":  "创建/修改/归档标注项目",
    "admin:dataset:read":   "查看本租户数据集",
    "admin:dataset:write":  "上传/修改/删除数据集",
    "admin:flow:read":      "查看推理流水线",
    "admin:flow:write":     "创建/修改流水线",
    "admin:audit:read":     "查看本租户审计日志",
}

# —— business 面:标注作业域(数据操作、任务执行) ——
BUSINESS_PERMISSIONS: Final[dict[str, str]] = {
    "business:anno-job:read":    "查看标注任务",
    "business:anno-job:write":   "创建/分配/修改标注任务",
    "business:project:read":     "查看标注项目",
    "business:project:write":    "创建/修改/归档标注项目",
    "business:label:read":       "查看标注数据",
    "business:label:write":      "提交/修改标注数据",
    "business:dataset:read":     "查看数据序列/文件",
    "business:dataset:write":    "上传/修改/删除数据序列",
    "business:review:read":      "查看待审核任务",
    "business:review:approve":   "通过/驳回审核",
    "business:review:reject":    "驳回审核(单独拆出便于精细授权)",
    "business:export:read":      "导出已审核数据集",
    "business:export:write":     "触发导出任务",
    "business:stats:read":       "查看作业统计",
    "business:workflow:read":    "查看工作流模板与实例",
    "business:workflow:write":   "创建/修改工作流模板",
    "business:self:read":        "查看自己的 profile / 偏好 / 通知",
    "business:self:write":       "修改自己的 profile / 改密码 / 标记通知已读",
    "business:team:read":        "查看本租户团队/协作者列表",
    "business:team:write":       "邀请/修改/移除本租户团队协作者,维护部门树",
    "business:algo:write":       "触发算法流水线执行",
    "business:dnn:write":        "调用 DNN 模型推理服务",
}

ALL_PERMISSIONS: Final[dict[str, str]] = {
    **PLATFORM_PERMISSIONS,
    **ADMIN_PERMISSIONS,
    **BUSINESS_PERMISSIONS,
}

# 内置角色 → 权限集合。在 app 启动时 seed,所有 is_builtin=True 的角色一律不可删。
BUILTIN_ROLES: Final[list[dict]] = [
    {
        "name": "platform-admin",
        "scope": "platform",
        "description": "全平台管理员,等价于超级用户(is_superuser)。",
        "permissions": list(PLATFORM_PERMISSIONS.keys()),
    },
    {
        "name": "admin",
        "scope": "admin",
        "description": "租户管理员:管理本租户用户/角色/项目/数据集/流水线。",
        "permissions": list(ADMIN_PERMISSIONS.keys()),
    },
    {
        "name": "tenant-admin",
        "scope": "business",
        "description": "业务管理员:本租户内分配任务、审核、导出。",
        "permissions": [
            "business:anno-job:read", "business:anno-job:write",
            "business:project:read", "business:project:write",
            "business:label:read", "business:label:write",
            "business:dataset:read", "business:dataset:write",
            "business:review:read", "business:review:approve",
            "business:review:reject",
            "business:export:read", "business:export:write",
            "business:stats:read",
            "business:workflow:read", "business:workflow:write",
            "business:self:read", "business:self:write",
            "business:team:read", "business:team:write",
            "business:algo:write",
            "business:dnn:write",
        ],
    },
    {
        "name": "annotator",
        "scope": "business",
        "description": "标注员:领取任务、提交标注。",
        "permissions": [
            "business:anno-job:read",
            "business:project:read",
            "business:label:read", "business:label:write",
            "business:dataset:read",
            "business:stats:read",
            "business:workflow:read",
            "business:self:read", "business:self:write",
            "business:export:read",
            "business:team:read",
            "business:algo:write",
            "business:dnn:write",
        ],
    },
    {
        "name": "reviewer",
        "scope": "business",
        "description": "审核员:查看待审核、通过/驳回。",
        "permissions": [
            "business:anno-job:read",
            "business:project:read",
            "business:dataset:read",
            "business:review:read", "business:review:approve", "business:review:reject",
            "business:stats:read",
            "business:workflow:read",
            "business:self:read", "business:self:write",
            "business:export:read",
            "business:team:read",
            "business:algo:write",
            "business:dnn:write",
        ],
    },
]
