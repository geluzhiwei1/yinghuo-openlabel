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
__date__ = "2024-10-10"

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
from ..biz.db.collection import Pager, CollectionBase, UserRoles
from openlabel import OpenLabel
from ..biz.services.role import role_service

app = APIRouter()

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
    result = await collection.insert_one(dto)
    if result.acknowledged:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="create failed")


@app.delete("/delete", summary="删除", tags=["user_roles"])
async def delete_list(request: Request):
    req_json = await request.json()
    collection = Conf.MG_USER_ROLES
    
    if "_id" in req_json:
        result = await collection.delete_one(
            {
                "_id": ObjectId(req_json["_id"]),
                "authority.owners": CTX_USER_ID.get("user_id"),
            }
        )
        return wrap_json([])
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

        result = await collection.update_one(query, update)
        if result.modified_count == 1:
            rows = await collection.find(query).to_list(length=None)
            return wrap_json(mongo_json_encoder(rows))

    return wrap_json([], status=1, statusText="update failed")


@app.get("/query", summary="查询列表", tags=["user_roles"])
async def query(request: Request, _id: str = Query(None)):
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    else:
        query = {"authority.owners": CTX_USER_ID.get("user_id")}
        
    collection = Conf.MG_USER_ROLES
    rows = await collection.find(query).sort("updated_time", pymongo.DESCENDING).to_list(length=None)
    return wrap_json(mongo_json_encoder(rows))

@app.get("/query_list", summary="查询列表", tags=["user_roles"])
async def query_list():
    query = {"authority.owners": CTX_USER_ID.get("user_id")}
    collection = Conf.MG_USER_ROLES
    rows = await collection.find(query).sort("updated_time", pymongo.DESCENDING).to_list(length=None)
    
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
    total_count = await collection.count_documents(query)
    if total_count == 0:
        # new user, no roles
        await role_service.init_system_role(user_id)
        total_count = await collection.count_documents(query)

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
            rows = await collection_rows.to_list(length=None)
    else:
        # 查询所有
        collection_rows = (
            collection.find(query).sort("updated_time", pymongo.DESCENDING)
        )
        rows = await collection_rows.to_list(length=None)
    return SuccessPage(
        data=mongo_json_encoder(rows),
        total=total_count,
        page_size=search.pager.page_size,
        page=search.pager.page,
    )
