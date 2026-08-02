"""
rest api
"""

__author__ = "Zhang Lizhi"
__date__ = "2024-10-10"

from fastapi import FastAPI, Query, Request, APIRouter
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any, Annotated
from bson import ObjectId
import pymongo
from datetime import datetime, timezone
import json

from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from ..config import Conf, gConf
from ..dto.data_seq import SimpleDataSeq
from .ctx import CTX_USER_ID
from ..dto.response import SuccessJson, SuccessPage, FailJson
from ..biz.db.collection import Pager, CollectionBase, UserRoles
from openlabel import OpenLabel
from ..biz.services.role import role_service
from .dependency import permission_required

app = APIRouter(dependencies=[permission_required("admin:role:write")])

@app.post("/create", summary="创建", tags=["user_roles"])
async def create(dto: UserRoles, request: Request):

    # 重置核心字段
    dto._id = ObjectId()
    dto.creater = CTX_USER_ID.get("user_id")
    dto.created_time = datetime.now(timezone.utc)
    dto.updated_time = datetime.now(timezone.utc)
    dto.authority = None
    # dto.users = []

    dto = dto.model_dump()
    dto["authority"] = {
        "owners": [CTX_USER_ID.get("user_id")],
    }
    collection = Conf.MG_USER_ROLES
    result = collection.insert_one(dto)
    if result.acknowledged:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="create failed")


@app.delete("/delete", summary="删除", tags=["user_roles"])
async def delete_list(request: Request):
    req_json = await request.json()
    collection = Conf.MG_USER_ROLES
    
    if "_id" in req_json:
        result = collection.delete_one(
            {
                "_id": ObjectId(req_json["_id"]),
                "authority.owners": CTX_USER_ID.get("user_id"),
            }
        )
        return wrap_json([])
    elif "_ids" in req_json and len(req_json["_ids"]) > 0:
        ids_to_delete = [ObjectId(id) for id in req_json["_ids"]]
        result = collection.delete_many(
            {
                "_id": {"$in": ids_to_delete},
                "authority.owners": CTX_USER_ID.get("user_id"),
            }
        )
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="_id or _ids is invalid")


@app.put("/update", summary="更新", tags=["user_roles"])
async def update(dto: dict, request: Request):
    query = {}
    if ObjectId.is_valid(dto["_id"]):
        query = {
            "_id": ObjectId(dto["_id"]),
            "authority.owners": CTX_USER_ID.get("user_id"),
        }
    else:
        return wrap_json([], status=1, statusText="_id is invalid")

    # 过滤掉不允许更新的字段
    fields = set(dto.keys())
    fields.remove("_id")
    for f in CollectionBase.model_fields.keys():
        if f in fields:
            fields.remove(f)

    collection = Conf.MG_USER_ROLES

    update = {"$set": {}}
    if len(fields) > 0:
        dto["updated_time"] = datetime.now(timezone.utc)
        fields.add("updated_time")
        for field in fields:
            update["$set"][field] = dto[field]

        result = collection.update_one(query, update)
        if result.modified_count == 1:
            rows = collection.find(query)
            return wrap_json(mongo_json_encoder(list(rows)))

    return wrap_json([], status=1, statusText="update failed")


@app.get("/query", summary="查询列表", tags=["user_roles"])
async def query(request: Request, _id: str = Query(None)):
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    else:
        query = {"authority.owners": CTX_USER_ID.get("user_id")}
        
    collection = Conf.MG_USER_ROLES
    rows = collection.find(query).sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)
    return wrap_json(mongo_json_encoder(rows))

@app.get("/query_list", summary="查询列表", tags=["user_roles"])
async def query_list():
    query = {"authority.owners": CTX_USER_ID.get("user_id")}
    collection = Conf.MG_USER_ROLES
    rows = collection.find(query).sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)
    
    rtn_rows = []
    for row in rows:
        rtn_row = {
            "value": str(row["_id"]),
            "label": row["label"],
        }
        rtn_rows.append(rtn_row)
    return wrap_json(rtn_rows)


class SearchFields(BaseModel):
    label: str | None = None
    is_system: bool | None = None

class Search(BaseModel):
    pager: Pager
    query: SearchFields

@app.post("/search", summary="分页搜索", tags=["user_roles"])
async def paged_search(search: Search):
    user_id = CTX_USER_ID.get("user_id")
    query = {"authority.owners": user_id}
    if search.query.label and search.query.label != "":
        query["label"] = search.query.label
    if search.query.is_system is not None:
        query["is_system"] = search.query.is_system

    collection = Conf.MG_USER_ROLES
    total_count = collection.count_documents(query)
    if total_count == 0:
        # new user, no roles
        role_service.init_system_role(user_id)
        total_count = collection.count_documents(query)

    rows = []
    if search.pager.page_size > 0:
        # 分页查询
        if total_count > 0:
            skip = (search.pager.page - 1) * search.pager.page_size
            collection_rows = (
                collection.find(query)
                .sort("updated_time", pymongo.DESCENDING)
                .skip(skip)
                .limit(search.pager.page_size)
            )
            rows = list(collection_rows)
    else:
        # 查询所有
        collection_rows = (
            collection.find(query).sort("updated_time", pymongo.DESCENDING)
        )
        rows = list(collection_rows)
    return SuccessPage(
        data=mongo_json_encoder(rows),
        total=total_count,
        page_size=search.pager.page_size,
        page=search.pager.page,
    )
