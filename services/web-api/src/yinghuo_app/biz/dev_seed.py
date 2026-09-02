"""CE 版启动时 seed 开发数据:test 租户 + 把 admin 用户绑到 tenant-admin。

幂等。SAAS 版本(saas/platform/seed.py::seed_platform_data)做更多事——
建 platform 超级用户、3 个 feature flag、test-tenant-admin/annotator/reviewer
等测试账号、清理 legacy 'default' 租户——但 CE 不挂载 saas/ 包,因此本模块
只做最小 seed,保证 dev 环境开箱有一个可登录、可作业的 tenant-admin 账号。

调用时机:Tortoise schema 生成之后、seed_rbac 之后、init_user_admin 之后。
HAS_SAAS=True 时由 app.py 跳过本函数,改走 seed_platform_data。
"""
from yinghuo_conf.config import gConf

from ..dto.users import UserCreate
from ..log import logger
from .services.user import user_service
from .db.models import PlatformFeatureFlag, PlatformTenant, Role, UserRole

TEST_TENANT_SLUG = "test"

TEST_TENANT = {
    "name": "测试租户",
    "status": "active",
    "plan": "free",
    "quota": {"max_users": 50, "max_projects": 10, "max_storage_gb": 100},
    "settings": {},
}

DEFAULT_FLAGS = [
    {
        "key": "use_new_dashboard",
        "description": "新版仪表盘(2026 Q3 灰度)",
        "enabled": False,
        "rollout_pct": 0,
    },
    {
        "key": "cross_tenant_audit",
        "description": "跨租户审计导出",
        "enabled": True,
        "rollout_pct": 100,
    },
    {
        "key": "wasm_pcd_loader",
        "description": "WASM PCD 解码器(实验)",
        "enabled": False,
        "rollout_pct": 10,
    },
]

# 为每个 business-scope 内置角色建测试账号(密码统一用 admin.password)。
# tenant-admin 由 prod@geluzhiwei.com 占位,这里额外建同名角色账号便于不切主账号验证。
ROLE_TEST_ACCOUNTS = ("tenant-admin", "annotator", "reviewer")


async def _clone_builtin_roles(tenant_slug: str) -> list[str]:
    """把 business-scope 内置角色(tenant_id=None, is_builtin=True)克隆到本租户。

    副本 is_builtin=False, is_system=False,租户管理员可任意编辑/删除。
    幂等:已存在同名副本则同步权限,不重建。
    """
    templates = await Role.filter(
        scope="business", tenant_id=None, is_builtin=True,
    )
    cloned: list[str] = []
    for tmpl in templates:
        clone, _ = await Role.update_or_create(
            scope="business",
            tenant_id=tenant_slug,
            name=tmpl.name,
            defaults={
                "description": tmpl.description,
                "is_system": False,
                "is_builtin": False,
            },
        )
        tmpl_perms = await tmpl.permissions.all()
        await clone.permissions.clear()
        if tmpl_perms:
            await clone.permissions.add(*tmpl_perms)
        cloned.append(tmpl.name)
    return cloned


async def _bind_admin_to_tenant(tenant_slug: str) -> dict:
    """把 admin.user 配置的用户绑到本租户的 tenant-admin 角色。

    init_user_admin 已经创建了该用户(若不存在),这里只补 UserRole 绑定。
    若用户曾被设为 superuser,降级为普通租户管理员。
    """
    email = gConf["admin"]["user"]
    user = await user_service.get_by_email(email)
    if user is None:
        logger.warning(
            f"admin user {email} not found, skip tenant-admin binding "
            f"(init_user_admin should have created it)"
        )
        return {"email": email, "bound": False}

    if user.is_superuser:
        user.is_superuser = False
        await user.save(update_fields=["is_superuser"])
        logger.info(f"demoted {email} → tenant-admin only")

    role = await Role.filter(
        scope="business", tenant_id=tenant_slug, name="tenant-admin",
    ).first()
    if role is None:
        role = await Role.filter(
            scope="business", tenant_id=None, name="tenant-admin",
        ).first()
    if role is None:
        logger.warning(
            f"tenant-admin role not found, {email} left unbound; "
            f"check seed_rbac ordering"
        )
        return {"email": email, "bound": False}

    await UserRole.get_or_create(
        user_id=user.id, role_id=role.id, tenant_id=tenant_slug,
        defaults={"granted_by": None},
    )
    return {"email": email, "bound": True}


async def _ensure_role_test_account(role_name: str, cfg: dict) -> dict | None:
    """为某个 business-scope 角色建测试账号并绑到 test 租户的对应角色副本。"""
    email = f"{TEST_TENANT_SLUG}-{role_name}@{cfg['test_email_domain']}"
    user = await user_service.get_by_email(email)
    created = False
    if user is None:
        user = await user_service.create_user(UserCreate(
            email=email,
            password=cfg["test_password"],
            is_active=True,
            is_superuser=False,
        ))
        try:
            await user_service.process_after_create(user)
        except Exception as e:
            logger.warning(f"process_after_create failed for {email}: {e}")
        created = True

    role = await Role.filter(
        scope="business", tenant_id=TEST_TENANT_SLUG, name=role_name,
    ).first()
    if role is None:
        role = await Role.filter(
            scope="business", tenant_id=None, name=role_name,
        ).first()
    if role is None:
        logger.warning(f"role {role_name} not seeded, skip binding for {email}")
        return None

    await UserRole.get_or_create(
        user_id=user.id, role_id=role.id, tenant_id=TEST_TENANT_SLUG,
        defaults={"granted_by": None},
    )
    return {"role": role_name, "email": email, "created": created}


def _test_tenant_cfg() -> dict:
    """test 租户测试账号配置。缺省回落 admin.password 与 geluzhiwei.com。"""
    try:
        cfg = gConf["test_tenant"]
    except (KeyError, TypeError):
        cfg = {}
    return {
        "test_password": cfg.get("test_password") or gConf["admin"]["password"],
        "test_email_domain": cfg.get("test_email_domain") or "geluzhiwei.com",
    }


async def seed_dev_data() -> None:
    """CE 启动 seed:test 租户 + 3 feature flag + 角色克隆 + admin 绑定。

    幂等:重复启动只会补缺,不会重复建。
    """
    # 1) test 租户
    await PlatformTenant.update_or_create(
        slug=TEST_TENANT_SLUG,
        defaults=dict(TEST_TENANT),
    )

    # 2) feature flags(仅 dev 参考用,CE 不加载 saas/ 运营面 UI)
    for spec in DEFAULT_FLAGS:
        await PlatformFeatureFlag.update_or_create(
            key=spec["key"],
            defaults={
                "description": spec["description"],
                "enabled": spec["enabled"],
                "rollout_pct": spec["rollout_pct"],
                "included_tenants": [],
                "excluded_tenants": [],
            },
        )

    # 3) 克隆 business-scope 内置角色到 test 租户
    roles_cloned = await _clone_builtin_roles(TEST_TENANT_SLUG)

    # 4) 把 admin.user(prod@geluzhiwei.com)绑到 test 租户 tenant-admin
    admin_info = await _bind_admin_to_tenant(TEST_TENANT_SLUG)

    # 5) 为每个 business-scope 角色建测试账号
    cfg = _test_tenant_cfg()
    test_users: dict[str, dict] = {}
    for role_name in ROLE_TEST_ACCOUNTS:
        info = await _ensure_role_test_account(role_name, cfg)
        if info:
            test_users[role_name] = info

    logger.info(
        f"dev seed done: tenant={TEST_TENANT_SLUG}; "
        f"admin={admin_info['email']} (bound={admin_info['bound']}); "
        f"3 feature flags; roles_cloned={roles_cloned}; "
        f"test_users={ {k: v['email'] for k, v in test_users.items()} }"
    )
