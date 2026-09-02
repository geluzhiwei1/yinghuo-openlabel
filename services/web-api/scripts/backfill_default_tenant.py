"""一次性回填脚本:为 default 租户补 provisioning。

背景:start.md 的种子只把 superuser 绑到 default 租户的 tenant-admin,
但没有为本租户克隆角色副本,也没有建测试账号。本脚本调 provision_tenant()
把缺失的角色副本 + 测试账号补齐。

用法:
  cd services/web-api
  YH_CONFIG_FILE=../../yinghuo-dev.yaml PYTHONPATH=src \\
      /path/to/python -m scripts.backfill_default_tenant

幂等:重复跑不会重复建角色/账号。
"""
import asyncio
import sys
from pathlib import Path

# 让 `python -m scripts.backfill_default_tenant` 在没有装包的情况下也能找到 src
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from tortoise import Tortoise  # noqa: E402

from yinghuo_app.biz.db.models import PlatformTenant, Role  # noqa: E402
from yinghuo_app.config import settings  # noqa: E402
from yinghuo_app.log import logger  # noqa: E402
from yinghuo_app.platform.provisioning import provision_tenant  # noqa: E402

DEFAULT_TENANT_SLUG = "default"
DEFAULT_ADMIN_EMAIL = "prod@geluzhiwei.com"


async def main() -> int:
    await Tortoise.init(config=settings.TORTOISE_ORM, _enable_global_fallback=True)
    await Tortoise.generate_schemas()
    try:
        tenant = await PlatformTenant.filter(slug=DEFAULT_TENANT_SLUG).first()
        if tenant is None:
            logger.error(
                f"default 租户不存在,先让主 app 启动一次让 seed_platform_data 写入,"
                f"再跑本脚本"
            )
            return 1

        existing = await Role.filter(
            tenant_id=DEFAULT_TENANT_SLUG, is_builtin=False,
        ).count()
        if existing > 0:
            print(
                f"default 租户已 provision 过({existing} 个角色副本),"
                f"如需强制重跑请先清空 role WHERE tenant_id='{DEFAULT_TENANT_SLUG}'"
            )
            return 0

        creds = await provision_tenant(tenant, admin_email=DEFAULT_ADMIN_EMAIL)
        print("=" * 60)
        print("default 租户 provisioning 完成")
        print("=" * 60)
        admin = creds["admin"]
        test = creds["test"]
        print(f"  admin: {admin['email']} / role={admin['role']}")
        if admin["password"]:
            print(f"         password(新创建,仅本次显示): {admin['password']}")
        else:
            print("         (用户已存在,密码不变,使用原密码登录)")
        print(f"  test:  {test['email']} / role={test['role']}")
        if test["password"]:
            print(f"         password(新创建,仅本次显示): {test['password']}")
        print(f"  roles_cloned: {creds['roles_cloned']}")
        return 0
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
