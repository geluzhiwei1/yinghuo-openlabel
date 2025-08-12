# Copyright (C) 2025 geluzhiwei.com
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
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

from ..api_util import wrap_json, mongo_json_encoder
from yinghuo_conf import Conf
from ..dto.data_seq import SimpleDataSeq
from .ctx import CTX_USER_ID
from ..dto.response import SuccessJson, SuccessPage, FailJson
from ..biz.db.collection import Pager, CollectionBase
from openlabel import OpenLabel

app = APIRouter()


class AnnoSpec(CollectionBase):
    name: Optional[Annotated[str, Field(max_length=100, min_length=1)]]
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
    result = await Conf.MG_DATA_ANNO_SPEC.insert_one(dto)
    if result.acknowledged:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="create failed")


@app.delete("/delete", summary="删除", tags=["anno_spec"])
async def delete_list(request: Request):
    req_json = await request.json()
    collection = Conf.MG_DATA_ANNO_SPEC
    
    if "_id" in req_json:
        result = await collection.delete_one(
            {
                "_id": ObjectId(req_json["_id"]),
                "authority.owners": CTX_USER_ID.get("user_id"),
            }
        )
        if result.deleted_count == 1:
            return wrap_json([])
        else:
            return wrap_json([], status=1, statusText="delete failed")
    elif "_ids" in req_json and len(req_json["_ids"]) > 0:
        ids_to_delete = [ObjectId(id) for id in req_json["_ids"]]
        result = await collection.delete_many(
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

        result = await Conf.MG_DATA_ANNO_SPEC.update_one(query, update)
        if result.modified_count == 1:
            rows = await Conf.MG_DATA_ANNO_SPEC.find(query).to_list(None)
            return wrap_json(mongo_json_encoder(rows))

    return wrap_json([], status=1, statusText="update failed")


@app.get("/query", summary="查询列表", tags=["anno_spec"])
async def query(request: Request, _id: str = Query(None)):
    """查询一条或者所有"""
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    else:
        query = {"authority.owners": CTX_USER_ID.get("user_id")}
    rows = await Conf.MG_DATA_ANNO_SPEC.find(query).sort("updated_time", pymongo.DESCENDING).to_list(None)
    for row in rows:
        if row["spec"] and row["spec"] != "":
            row["spec"] = OpenLabel.from_json(json.loads(row["spec"])).openlabel()
    return wrap_json(mongo_json_encoder(rows))

@app.get("/classes", summary="获取 classes", tags=["anno_spec"])
async def classes(_id: str = Query(None)):
    rows = []
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
        rows = await Conf.MG_DATA_ANNO_SPEC.find(query).to_list(None)
        print(rows)
    if len(rows) == 0:
        return wrap_json([])

    spec_str = rows[0]["spec"]
    if not spec_str:
        return wrap_json([])

    json_dict = json.loads(spec_str)
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
    total_count = await collection.count_documents(query)

    rows = []
    if search.pager.page_size > 0:
        # 分页查询
        if total_count > 0:
            skip = (search.pager.page - 1) * search.pager.page_size
            rows = await (
                collection.find(query)
                .sort("updated_time", pymongo.DESCENDING)
                .skip(skip)
                .limit(search.pager.page_size)
            ).to_list(None)
    else:
        # 查询所有
        rows = await (
            collection.find(query).sort("updated_time", pymongo.DESCENDING)
        ).to_list(None)
    return SuccessPage(
        data=mongo_json_encoder(rows),
        total=total_count,
        page_size=search.pager.page_size,
        page=search.pager.page,
    )
