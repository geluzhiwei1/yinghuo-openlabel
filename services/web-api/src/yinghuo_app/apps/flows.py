"""业务面 DNN flow 只读访问 /flows。

挂载:main app,前缀 /api/v1/b/flows。
权限:business:anno-job:read(能查看标注任务的角色即可读取 flow 列表,
因为 flow 是创建标注批次时选用的元数据,不属敏感数据)。

数据源:MongoDB `flows` 集合,与平台面 /api/v1/p/flow 共享。
平台面负责 flow 的增删改(平台共享资源);业务面只暴露只读列表,
让 home/标注批次创建界面在 OSS edition(无 /api/v1/p)下也能工作。
"""
from fastapi import APIRouter, HTTPException, Request, status

from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from ..apps.dependency import permission_required
from ..config import Conf

router = APIRouter(
    tags=["业务面-DNN flow(只读)"],
    dependencies=[permission_required("business:anno-job:read")],
)


@router.get("/", response_description="List all flows")
def list_all(request: Request):
    objs = list(Conf.MG_COLLECTION["flows"].find())
    return wrap_json(mongo_json_encoder(objs))


@router.get("/{id}", response_description="Get a single flow by id")
def find_by_id(id: str, request: Request):
    if (obj := Conf.MG_COLLECTION["flows"].find_one({"_id": id})) is not None:
        return wrap_json(obj)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"id {id} not found")


@router.get("/find", response_description="Find flows by fields")
def find(id: str = None, name: str = None, request: Request = None):
    condition = {}
    if id is not None:
        condition["_id"] = id
    if name is not None:
        condition["name"] = name
    objs = list(Conf.MG_COLLECTION["flows"].find(condition))
    return wrap_json(mongo_json_encoder(objs))
