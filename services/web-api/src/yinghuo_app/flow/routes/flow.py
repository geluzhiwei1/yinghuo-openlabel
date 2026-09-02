"""
flow rest api 
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-18"


from fastapi import APIRouter, Body, Request, Response, HTTPException, status
from fastapi.encoders import jsonable_encoder

from ..models.funcFlow import FuncFlow
from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from ...config import Conf, gConf
from ...apps.dependency import permission_required

router = APIRouter(dependencies=[permission_required("admin:flow:read")])

@router.get("/", response_description="List all")
def list_all(request: Request):
    objs = list(Conf.MG_COLLECTION["flows"].find())
    return wrap_json(mongo_json_encoder(objs))

@router.get("/{id}", response_description="Get a single one by id")
def find_by_id(id: str, request: Request):
    if (obj := Conf.MG_COLLECTION["flows"].find_one({"_id": id})) is not None:
        return wrap_json(obj)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"id {id} not found")
    
@router.get("/find", response_description="Find by fields")
def find(id: str, name: str, request: Request):
    condition = {}
    if id is not None:
        condition["_id"] = id
    if name is not None:
        condition["name"] = name
    objs = list(Conf.MG_COLLECTION["flows"].find(condition))
    return wrap_json(objs)