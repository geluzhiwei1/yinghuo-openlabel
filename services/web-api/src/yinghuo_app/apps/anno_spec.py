"""
rest api
"""

__author__ = "Zhang Lizhi"
__date__ = "2024-09-24"

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
from ..biz.db.collection import Pager, CollectionBase
from openlabel import OpenLabel
from .dependency import permission_required

app = APIRouter(dependencies=[permission_required("admin:project:write")])


class AnnoSpec(CollectionBase):
    name: Optional[Annotated[str, Field(max_length=100, min_length=1)]] = None
    version: Optional[Annotated[str, Field(max_length=100)]] = None
    lang: Optional[Annotated[str, Field(max_length=100)]] = None
    desc: Optional[Annotated[str, Field(max_length=1000)]] = None
    enabled: Annotated[bool, Field(enumerates=[True, False])] = True
    spec: Annotated[str, Field(max_length=102400)] = ""


@app.post("/create", summary="创建", tags=["anno_spec"])
async def create(anno_spec: AnnoSpec, request: Request):

    # 重置核心字段
    anno_spec._id = ObjectId()
    anno_spec.creater = CTX_USER_ID.get("user_id")
    anno_spec.created_time = datetime.now(timezone.utc)
    anno_spec.updated_time = datetime.now(timezone.utc)
    anno_spec.authority = None
    anno_spec.spec = ""

    dto = anno_spec.model_dump()
    dto["authority"] = {
        "owners": [CTX_USER_ID.get("user_id")],
    }
    result = Conf.MG_DATA_ANNO_SPEC.insert_one(dto)
    if result.acknowledged:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="create failed")


@app.delete("/delete", summary="删除", tags=["anno_spec"])
async def delete_list(request: Request):
    req_json = await request.json()
    collection = Conf.MG_DATA_ANNO_SPEC
    
    if "_id" in req_json:
        result = collection.delete_one(
            {
                "_id": ObjectId(req_json["_id"]),
                "authority.owners": CTX_USER_ID.get("user_id"),
            }
        )
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


@app.put("/update", summary="更新", tags=["anno_spec"])
async def update(anno_spec: dict, request: Request):
    query = {}
    if ObjectId.is_valid(anno_spec["_id"]):
        query = {
            "_id": ObjectId(anno_spec["_id"]),
            "authority.owners": CTX_USER_ID.get("user_id"),
        }
    else:
        return wrap_json([], status=1, statusText="_id is invalid")

    # 过滤掉不允许更新的字段
    fields = set(anno_spec.keys())
    fields.remove("_id")
    for f in CollectionBase.model_fields.keys():
        if f in fields:
            fields.remove(f)

    update = {"$set": {}}
    if len(fields) > 0:
        anno_spec["updated_time"] = datetime.now(timezone.utc)
        fields.add("updated_time")
        for field in fields:
            update["$set"][field] = anno_spec[field]

        result = Conf.MG_DATA_ANNO_SPEC.update_one(query, update)
        if result.modified_count == 1:
            rows = Conf.MG_DATA_ANNO_SPEC.find(query)
            return wrap_json(mongo_json_encoder(list(rows)))

    return wrap_json([], status=1, statusText="update failed")


@app.get("/query", summary="查询列表", tags=["anno_spec"])
async def query(request: Request, _id: str = Query(None)):
    """查询一条或者所有"""
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    else:
        query = {"authority.owners": CTX_USER_ID.get("user_id")}
    rows = Conf.MG_DATA_ANNO_SPEC.find(query).sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)
    for row in rows:
        if row.get("spec"):
            row["spec"] = OpenLabel.from_json(json.loads(row["spec"])).openlabel()
    return wrap_json(mongo_json_encoder(rows))

@app.get("/classes", summary="获取 classes", tags=["anno_spec"])
async def classes(_id: str = Query(None)):
    rows = []
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
        mongo_rows = Conf.MG_DATA_ANNO_SPEC.find(query)
        rows = list(mongo_rows)
    if len(rows) == 0:
        return wrap_json([])
    json_dict = json.loads(rows[0]["spec"])
    rtn = OpenLabel.from_json(json_dict).get_class_names(leaf_node_only=True)
    return wrap_json(rtn)


class SearchFields(BaseModel):
    name: str | None = None
    version: str | None = None
    enabled: bool | None = None

class Search(BaseModel):
    pager: Pager
    query: SearchFields


@app.post("/search", summary="分页搜索", tags=["anno_spec"])
async def paged_search(search: Search):
    """分页搜索
    Args:
        search (Search): 查询条件
    Returns:
        _type_: 列表
    """
    query = {"authority.owners": CTX_USER_ID.get("user_id")}
    if search.query.name and search.query.name != "":
        query["name"] = search.query.name
    if search.query.version:
        query["version"] = search.query.version
    if search.query.enabled is not None:
        query["enabled"] = search.query.enabled

    collection = Conf.MG_DATA_ANNO_SPEC
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
