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
anno job perform rest api
"""

__author__ = "Zhang Lizhi"
__date__ = "2024-03-22"

from fastapi import FastAPI, Query, Request, APIRouter, BackgroundTasks
from pydantic import BaseModel
from pydantic import EmailStr, Field
from typing import Optional, Dict, List, Any
from bson import ObjectId
from datetime import datetime, timezone
from fastapi import Depends
import pymongo
import os

from yinghuo_conf import Conf, settings
from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from yinghuo_conf import Conf
from ..dto.data_seq import SimpleDataSeq
from .ctx import CTX_USER_ID, CTX_USER_FRESHNESS
from ..dto.response import SuccessJson, SuccessPage, FailJson
from ..biz.db.collection import JobStatus, Pager, CollectionBase, UserProfile
from ..log import logger
from ..biz.db.collection import AnnoJob, LabelSpec
from ..biz.services.team import team_service
from ..biz.services.job import job_service
from ..biz.services.anno_job import annoJobService
from ..biz.services.user_profile import user_profile_service

app = APIRouter()
PATH = "/perform"

@app.post("/perform", summary="创建", tags=["annoJobPerform"])
async def create(anno_job_perform: AnnoJob):
    
    user_id = CTX_USER_ID.get("user_id")
    query1 = {"authority.owners": user_id}
    collection = Conf.MG_ANNO_JOB_PERFORM
    total_count = await collection.count_documents(query1)
    
    max_job_count = 15
    profile:UserProfile = await user_profile_service.get_by_user_id(user_id)
    if profile is not None:
        max_job_count = profile.max_job_count
    if total_count > max_job_count:
        return wrap_json([], status=1, statusText="超出最大限制。")
    
    logger.info(f"create new job")
    user_id = CTX_USER_ID.get("user_id")
    await job_service.create_job(user_id, anno_job_perform)
    return wrap_json([])


@app.delete("/perform", summary="删除", tags=["annoJobPerform"])
async def delete_list(request: Request):
    req_json = await request.json()
    if ObjectId.is_valid(req_json["uuid"]):
        result = await Conf.MG_ANNO_JOB_PERFORM.delete_one(
            {
                "_id": ObjectId(req_json["uuid"]),
                "authority.owners": CTX_USER_ID.get("user_id"),
            }
        )
        if result.deleted_count == 1:
            # 删除附属数据
            await Conf.MG_DATA_SEQ_META.delete_one({"job.uuid": req_json["uuid"], "authority.owners": CTX_USER_ID.get("user_id")})
            await Conf.MG_DATA_STREAM_META.delete_many({"job.uuid": req_json["uuid"], "authority.owners": CTX_USER_ID.get("user_id")})
            return wrap_json([])
        else:
            return wrap_json([], status=1, statusText="delete failed")
    else:
        return wrap_json([], status=1, statusText="uuid is invalid")


@app.put("/perform", summary="更新", tags=["annoJobPerform"])
async def update(anno_job_perform: dict):
    query = {}
    if ObjectId.is_valid(anno_job_perform['_id']):
        query = {
            "_id": ObjectId(anno_job_perform['_id']),
            "authority.owners": CTX_USER_ID.get("user_id"),
        }

    # 过滤掉不允许更新的字段
    fields = set(anno_job_perform.keys())
    for f in CollectionBase.model_fields.keys():
        if f in fields:
            fields.remove(f)
    fields.remove('_id')

    update = {"$set": {}}
    if len(fields) > 0:
        for field in fields:
            update["$set"][field] = anno_job_perform[field]

        update["$set"]["updated_time"] = datetime.now(timezone.utc)
        result = await Conf.MG_ANNO_JOB_PERFORM.update_one(query, update)
        if result.modified_count == 1:
            rows = await Conf.MG_ANNO_JOB_PERFORM.find(query).to_list(length=None)
            return wrap_json(mongo_json_encoder(list(rows)))

    return wrap_json([], status=1, statusText="update failed")


@app.put("/update_status", summary="更新状态", tags=["annoJobPerform"])
async def update_status(anno_job_perform: dict):
    uuid = anno_job_perform.get("_id")
    if not ObjectId.is_valid(uuid):
        return wrap_json([], status=1, statusText="参数错误")
    
    try:
        new_status = JobStatus.Status(anno_job_perform.get("status", ''))
    except ValueError as e:
        return wrap_json([], status=1, statusText="参数错误")

    user_id = CTX_USER_ID.get("user_id")
    doc = await job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        return wrap_json([], status=1, statusText="没有权限")

    result = await annoJobService.update_status(user_id, uuid, new_status.value, anno_job_perform.get("desc", ''))
    if result.modified_count == 1:
        return wrap_json()
    return wrap_json([], status=1, statusText="update failed")


@app.get("/perform", summary="查询列表", tags=["annoJobPerform"])
async def query(request: Request, uuid: str = Query(None)):
    if not ObjectId.is_valid(uuid):
        return wrap_json([], status=1, statusText="uuid is invalid")
        
    query = {"_id": ObjectId(uuid), "authority.owners": CTX_USER_ID.get("user_id")}
    rows = Conf.MG_ANNO_JOB_PERFORM.find(query).sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)

    return wrap_json(mongo_json_encoder(rows))

@app.get("/info", summary="查询job信息", tags=["annoJobPerform"])
async def query_info(uuid: str = Query(None)):
    if not ObjectId.is_valid(uuid):
        return wrap_json([], status=1, statusText="uuid is invalid")
    user_id = CTX_USER_ID.get("user_id")
    doc = await job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        return wrap_json([], status=1, statusText="没有权限")
    docs = [doc]
    return wrap_json(mongo_json_encoder(docs))


class SearchFields(BaseModel):
    data_seq: str | None = None
    mission: str | None = None
    job_status: str | None = None

class Search(BaseModel):
    pager: Pager
    query: SearchFields


@app.post("/search", summary="查询列表：有管理权限的", tags=["annoJobPerform"])
async def paged_search(search: Search, request: Request):
    logger.info(f"search jobs")
    
    user_id = CTX_USER_ID.get("user_id")
    query1 = {"authority.owners": user_id}
    query2 = {"authority.collaborators": user_id}
    
    my_depts = await team_service.find_my_dept_ids(user_id)
    query3 = {"authority.dept": {"$in": my_depts}} # 并且角色是管理员
    query = {"$or": [query1, query2, query3]}
    if search.query.data_seq and search.query.data_seq != "":
        query["label_spec.data.seq"] = search.query.data_seq
    if search.query.mission and search.query.data_seq != "":
        query["label_spec.mission.key"] = search.query.mission
    if search.query.job_status and search.query.job_status != "":
        query["current_status.status"] = search.query.job_status

    collection = Conf.MG_ANNO_JOB_PERFORM
    total_count = await collection.count_documents(query)

    rows = []
    if total_count > 0:
        skip = (search.pager.page - 1) * search.pager.page_size
        collection_rows = (
            collection.find(query)
            .sort("updated_time", pymongo.DESCENDING)
            .skip(skip)
            .limit(search.pager.page_size)
        )
        rows = await collection_rows.to_list(length=search.pager.page_size)
    return SuccessPage(
        data=mongo_json_encoder(rows),
        total=total_count,
        page_size=search.pager.page_size,
        page=search.pager.page,
    )


@app.post("/search_job", summary="查询列表：能标注的", tags=["annoJobPerform"])
async def paged_search2(search: Search, request: Request):
    logger.info(f"search jobs")
    
    user_id = CTX_USER_ID.get("user_id")
    query1 = {"authority.owners": user_id}
    query2 = {"authority.collaborators": user_id}
    
    my_depts = await team_service.find_my_dept_ids(user_id)
    query3 = {"authority.dept": {"$in": my_depts}}
    query = {"$or": [query1, query2, query3]}
    if search.query.data_seq and search.query.data_seq != "":
        query["label_spec.data.seq"] = search.query.data_seq
    if search.query.mission and search.query.data_seq != "":
        query["label_spec.mission.key"] = search.query.mission
    if search.query.job_status and search.query.job_status != "":
        query["current_status.status"] = search.query.job_status
        
    collection = Conf.MG_ANNO_JOB_PERFORM
    total_count = await collection.count_documents(query)

    rows = []
    if total_count > 0:
        skip = (search.pager.page - 1) * search.pager.page_size
        collection_rows = (
            collection.find(query)
            .sort("updated_time", pymongo.DESCENDING)
            .skip(skip)
            .limit(search.pager.page_size)
        )
        rows = await collection_rows.to_list(length=search.pager.page_size)
    return SuccessPage(
        data=mongo_json_encoder(rows),
        total=total_count,
        page_size=search.pager.page_size,
        page=search.pager.page,
    )
    