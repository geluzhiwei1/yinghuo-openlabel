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
__date__ = "2024-11-18"

from fastapi import FastAPI, Query, Request, APIRouter
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any, Annotated
from bson import ObjectId
import pymongo
from datetime import datetime, timezone
import json
from enum import Enum
import pydash

from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from yinghuo_conf import Conf
from ..dto.data_seq import SimpleDataSeq
from .ctx import CTX_USER_ID
from ..dto.response import SuccessJson, SuccessPage, FailJson
from ..biz.db.collection import Pager, CollectionBase, UserResource
from ..exceptions import BizException
from openlabel import OpenLabel

app = APIRouter()


@app.post("/create", summary="创建", tags=["user_res"])
async def create(dto: UserResource, request: Request):
    
    # 重置核心字段
    dto._id = ObjectId()
    dto.creater = CTX_USER_ID.get("user_id")
    dto.created_time = datetime.now(timezone.utc)
    dto.updated_time = datetime.now(timezone.utc)
    dto.authority = None

    dto = dto.model_dump()
    dto["authority"] = {
        "owners": [CTX_USER_ID.get("user_id")],
    }
    collection = Conf.MG_user_res
    result = await collection.insert_one(dto)
    if result.acknowledged:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="create failed")


@app.delete("/delete", summary="删除", tags=["user_res"])
async def delete_list(request: Request):
    req_json = await request.json()
    _id = pydash.get(req_json, "id", None)
    if not ObjectId.is_valid(_id):
        return wrap_json([], status=1, statusText="id is invalid")
    
    collection = Conf.MG_user_res
    query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    rows = await collection.find(query)
    rows = list(rows)
    if len(rows) == 0:
        return wrap_json([], status=1, statusText="没有权限")
    
    # children 节点有子元素，不允许删除
    query = {"parent_id": _id, "authority.owners": CTX_USER_ID.get("user_id")}
    rows = await collection.find(query)
    rows = list(rows)
    if len(rows) != 0:
        return wrap_json([], status=1, statusText="该节点有子节点，不可以删除")
    
    result = await collection.delete_one({
            "_id": ObjectId(_id),
            "authority.owners": CTX_USER_ID.get("user_id"),
    })
    if result.deleted_count == 1:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="删除数据失败")


@app.put("/update", summary="更新", tags=["user_res"])
async def update(dto_dict: dict):
    query = {}
    _id = dto_dict["id"]
    if ObjectId.is_valid(_id):
        query = {
            "_id": ObjectId(_id),
            "authority.owners": CTX_USER_ID.get("user_id"),
        }
    else:
        return wrap_json([], status=1, statusText="_id is invalid")

    # 过滤掉不允许更新的字段
    fields = set(dto_dict.keys())
    fields.remove("parent_id")
    for f in CollectionBase.model_fields.keys():
        if f in fields:
            fields.remove(f)

    collection = Conf.MG_user_res
    update = {"$set": {}}
    if len(fields) > 0:
        dto_dict["updated_time"] = datetime.now(timezone.utc)
        fields.add("updated_time")
        for field in fields:
            update["$set"][field] = dto_dict[field]

        result = await collection.update_one(query, update)
        if result.modified_count == 1:
            rows = await collection.find(query)
            return wrap_json(mongo_json_encoder(list(rows)))

    return wrap_json([], status=1, statusText="update failed")


@app.get("/query", summary="查询列表", tags=["user_res"])
async def query(_id: str = Query(None)):
    """查询一条或者所有"""
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    else:
        query = {"authority.owners": CTX_USER_ID.get("user_id")}
    collection = Conf.MG_user_res
    rows = await collection.find(query)#.sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)
    return wrap_json(mongo_json_encoder(rows))


def to_node(row):
    return {
        'id': str(row['id']),
        'value': str(row['id']),
        'title': row['title'],
        
        'index': str(row['index']),
        'parent_id': row['parent_id'],
        
        'icon': row['icon'],
        'order': row['order'],
        'type': row['type'],
        'desc': row['desc'],
        
        'children': [],
    }
    
def build_tree(top_node, sub_rows):
    for row in sub_rows:
        if row['parent_id'] == top_node['id']:
            cur_node = to_node(row)
            top_node['children'].append(cur_node)
            build_tree(cur_node, sub_rows)

@app.get("/query_tree", summary="查询数结构", tags=["user_res"])
async def query_tree():
    query = {"authority.owners": CTX_USER_ID.get("user_id")}
    collection = Conf.MG_USER_RES
    rows = await collection.find(query).sort("order", pymongo.ASCENDING)
    rows = list(rows)
    
    # 构建树形结构
    sub_rows = []
    top_nodes = []
    for row in rows:
        if row['parent_id'] == "":
            top_nodes.append(to_node(row))
        else:
            sub_rows.append(row)
    for node in top_nodes:
        build_tree(node, sub_rows)
    
    return wrap_json(mongo_json_encoder(top_nodes))

