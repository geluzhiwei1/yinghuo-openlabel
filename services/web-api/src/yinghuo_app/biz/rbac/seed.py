"""启动时 seed 权限字典与内置角色。幂等。

调用时机:Tortoise schema 生成之后、init_user_admin 之后(确保超级用户已存在)。
"""
from ..db.models import Permission, Role, User, UserRole
from .permissions import ALL_PERMISSIONS, BUILTIN_ROLES
from ...log import logger


async def seed_rbac() -> None:
    # 1) 权限点
    for key, desc in ALL_PERMISSIONS.items():
        parts = key.split(":")
        face, resource, action = parts[0], parts[1], parts[2]
        await Permission.update_or_create(
            key=key,
            defaults={
                "face": face,
                "resource": resource,
                "action": action,
                "description": desc,
            },
        )

    # 2) 内置角色
    for spec in BUILTIN_ROLES:
        role, _ = await Role.update_or_create(
            scope=spec["scope"],
            tenant_id=None,
            name=spec["name"],
            defaults={
                "description": spec["description"],
                "is_system": True,
                "is_builtin": True,
            },
        )
        keys = spec["permissions"]
        perms = await Permission.filter(key__in=keys)
        await role.permissions.clear()
        if perms:
            await role.permissions.add(*perms)

    # 3) 把所有超级用户绑到 platform-admin
    pa_role = await Role.filter(scope="platform", name="platform-admin").first()
    if pa_role is not None:
        supers = await User.filter(is_superuser=True)
        for su in supers:
            await UserRole.get_or_create(
                user_id=su.id, role_id=pa_role.id, tenant_id=None,
            )

    logger.info(f"rbac seed done: {len(ALL_PERMISSIONS)} permissions, {len(BUILTIN_ROLES)} builtin roles")
