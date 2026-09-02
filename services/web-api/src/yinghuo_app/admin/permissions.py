"""权限字典查询(管理面 admin app)。

挂载:admin app,前缀 /api/v1/a/permissions。
权限:admin:role:read(只有管理面 RolesView 需要拉全量权限做选择树)

数据源:biz/rbac/permissions.py 的 ALL_PERMISSIONS 字典,静态构造 tree。
不查 DB —— Permission 表也是 seed 自此字典,查 DB 反而可能漏手工未 seed 的 key。
"""
from collections import OrderedDict

from fastapi import APIRouter

from ..apps.dependency import permission_required
from ..biz.rbac.permissions import ALL_PERMISSIONS
from ..dto.response import SuccessJson

router = APIRouter()


def _build_tree() -> list[dict]:
    """构造 face → resource → [permissions] 的两层分组。"""
    faces: dict[str, dict[str, list[dict]]] = OrderedDict()
    for key, desc in ALL_PERMISSIONS.items():
        parts = key.split(":")
        if len(parts) != 3:
            continue
        face, resource, action = parts
        faces.setdefault(face, OrderedDict())
        faces[face].setdefault(resource, [])
        faces[face][resource].append({"key": key, "action": action, "description": desc})

    out = []
    for face, resources in faces.items():
        res_list = []
        for resource, perms in resources.items():
            res_list.append({
                "resource": resource,
                "permissions": perms,
            })
        out.append({"face": face, "resources": res_list})
    return out


@router.get(
    "/tree",
    summary="权限字典 tree(分组:face → resource → permission)",
    dependencies=[permission_required("admin:role:read")],
)
async def permission_tree():
    return SuccessJson(data=_build_tree())
