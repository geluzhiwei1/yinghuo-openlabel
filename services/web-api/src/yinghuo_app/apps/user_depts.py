"""
rest api
"""

__author__ = "Zhang Lizhi"
__date__ = "2024-10-09"

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
from ..exceptions import BizException
from openlabel import OpenLabel
import pydash
from .dependency import permission_required

app = APIRouter(dependencies=[permission_required("admin:team:write")])

class UserDepts(CollectionBase):
    label: Annotated[str, Field(max_length=100, min_length=1, description="部门名称", example="标注小组1")]
    desc: Optional[Annotated[str, Field(max_length=1000, description="备注", example="红绿灯标注")]] = None
    parent_id: Optional[str] = ''
    order: Optional[int] = 0
    # class Config:
    #     extra = "allow"


# class DtoCreate(BaseModel):
#     root_key = Field(max_length=100, min_length=1, description="部门编码", example="xxx")
#     parent_dept_key = Field(max_length=100, min_length=1, description="部门编码", example="xxx")
#     dto: Dept
    
# def find_dept_by_root(root_key:str):
#     query = {
#         "depts.key": root_key,
#         "authority.owners": CTX_USER_ID.get("user_id")
#     }
#     collection = Conf.MG_USER_DEPTS
#     rows = collection.find(query)
#     if len(rows) != 1:
#         raise BizException(status=503, statusText="没有找到对应的数据")
#     return rows[0]
    
@app.post("/create", summary="创建", tags=["user_depts"])
async def create(dto: UserDepts, request: Request):
    
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
    collection = Conf.MG_USER_DEPTS
    result = collection.insert_one(dto)
    if result.acknowledged:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="create failed")


@app.delete("/delete", summary="删除", tags=["user_depts"])
async def delete_list(request: Request):
    req_json = await request.json()
    _id = pydash.get(req_json, "id", None)
    if not ObjectId.is_valid(_id):
        return wrap_json([], status=1, statusText="id is invalid")
    
    collection = Conf.MG_USER_DEPTS
    query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    rows = collection.find(query)
    rows = list(rows)
    if len(rows) == 0:
        return wrap_json([], status=1, statusText="没有权限")
    
    # children 节点有子元素，不允许删除
    query = {"parent_id": _id, "authority.owners": CTX_USER_ID.get("user_id")}
    rows = collection.find(query)
    rows = list(rows)
    if len(rows) != 0:
        return wrap_json([], status=1, statusText="该节点有子部门，不可以删除")
    
    result = collection.delete_one({
            "_id": ObjectId(_id),
            "authority.owners": CTX_USER_ID.get("user_id"),
    })
    if result.deleted_count == 1:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="删除数据失败")


@app.put("/update", summary="更新", tags=["user_depts"])
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

    collection = Conf.MG_USER_DEPTS
    update = {"$set": {}}
    if len(fields) > 0:
        dto_dict["updated_time"] = datetime.now(timezone.utc)
        fields.add("updated_time")
        for field in fields:
            update["$set"][field] = dto_dict[field]

        result = collection.update_one(query, update)
        if result.modified_count == 1:
            rows = collection.find(query)
            return wrap_json(mongo_json_encoder(list(rows)))

    return wrap_json([], status=1, statusText="update failed")

# async def initDepts(user_id:int):
#     dept = Dept()
#     dept.key = f"{user_id}"
#     dept.label = "root"
#     dept.desc = "root dept"
#     dept.children = []
    
#     dto = UserDepts()
#     dto.depts = dept
#     dto._id = ObjectId()
#     dto.creater = CTX_USER_ID.get("user_id")
#     dto.created_time = datetime.now(timezone.utc)
#     dto.updated_time = datetime.now(timezone.utc)
#     dto.authority = None

#     dto = dto.model_dump()
#     dto["authority"] = {
#         "owners": [CTX_USER_ID.get("user_id")],
#     }
#     collection = Conf.MG_USER_DEPTS
#     result = collection.insert_one(dto)

@app.get("/query", summary="查询列表", tags=["user_depts"])
async def query(_id: str = Query(None)):
    """查询一条或者所有"""
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    else:
        query = {"authority.owners": CTX_USER_ID.get("user_id")}
    collection = Conf.MG_USER_DEPTS
    rows = collection.find(query)#.sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)
    return wrap_json(mongo_json_encoder(rows))


def to_node(row):
    return {
                'id': str(row['_id']),
                'value': str(row['_id']),
                'key': str(row['_id']),
                'parent_id': row['parent_id'],
                'label': row['label'],
                'desc': row['desc'],
                'order': row['order'],
                'children': [],
            }
def build_tree(top_node, sub_rows):
    for row in sub_rows:
        if row['parent_id'] == top_node['id']:
            cur_node = to_node(row)
            top_node['children'].append(cur_node)
            build_tree(cur_node, sub_rows)

@app.get("/query_tree", summary="查询数结构", tags=["user_depts"])
async def query_tree():
    query = {"authority.owners": CTX_USER_ID.get("user_id")}
    collection = Conf.MG_USER_DEPTS
    rows = collection.find(query).sort("order", pymongo.ASCENDING)
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


# class SearchFields(BaseModel):
#     name: str | None = None
#     version: str | None = None
#     enabled: bool | None = None

# class Search(BaseModel):
#     pager: Pager
#     query: SearchFields


# @app.post("/search", summary="分页搜索", tags=["user_depts"])
# async def paged_search(search: Search):
#     """分页搜索
#     Args:
#         search (Search): 查询条件
#     Returns:
#         _type_: 列表
#     """
#     query = {"authority.owners": CTX_USER_ID.get("user_id")}
#     if search.query.name and search.query.name != "":
#         query["name"] = search.query.name
#     if search.query.version:
#         query["version"] = search.query.version
#     if search.query.enabled is not None:
#         query["enabled"] = search.query.enabled

#     collection = collection
#     total_count = collection.count_documents(query)

#     rows = []
#     if search.pager.page_size > 0:
#         # 分页查询
#         if total_count > 0:
#             skip = (search.pager.page - 1) * search.pager.page_size
#             collection_rows = (
#                 collection.find(query)
#                 .sort("updated_time", pymongo.DESCENDING)
#                 .skip(skip)
#                 .limit(search.pager.page_size)
#             )
#             rows = list(collection_rows)
#     else:
#         # 查询所有
#         collection_rows = (
#             collection.find(query).sort("updated_time", pymongo.DESCENDING)
#         )
#         rows = list(collection_rows)
#     return SuccessPage(
#         data=mongo_json_encoder(rows),
#         total=total_count,
#         page_size=search.pager.page_size,
#         page=search.pager.page,
#     )
