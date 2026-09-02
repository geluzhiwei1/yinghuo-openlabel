"""
rest api
"""

__author__ = "Zhang Lizhi"
__date__ = "2024-10-10"

from fastapi import FastAPI, Query, Request, APIRouter, Body
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any, Annotated
from bson import ObjectId
import pymongo
from datetime import datetime, timezone
import json
import emails
from emails.template import JinjaTemplate as T

from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from ..config import Conf, gConf
from ..dto.data_seq import SimpleDataSeq
from .ctx import CTX_USER_ID
from ..dto.response import SuccessJson, SuccessPage, FailJson
from ..biz.db.collection import Pager, CollectionBase, UserTeam, DataAuthority, UserTeam, UserTeamInvitation
from openlabel import OpenLabel
from ..biz.services.role import role_service
from ..biz.services.user import user_service
from ..utils.email_config import get_smtp_config, get_mail_from
from ..log import logger
from .dependency import permission_required

app = APIRouter()


async def agree(_id:ObjectId, email: str)->Optional[object]:
    """如果账号已经注册，则直接邀请成功

    Args:
        _id (ObjectId): _description_
        email (str): _description_

    Raises:
        Exception: _description_

    Returns:
        Optional[object]: _description_
    """
    collection = Conf.MG_USER_TEAM
    user = await user_service.get_by_email(email)
    if user:
        query = {
            "_id": _id,
        }
        update = {"$set": {}}
        update["$set"]["is_registered"] = True
        update["$set"]['agreement'] = {
            "sign_time": datetime.now(timezone.utc),
            "is_signed": True
        }
        update["$set"]["user_id"] = user.id
        
        result = collection.update_one(query, update)
        if result.modified_count != 1:
            raise Exception("更新数据失败")
    return user

@app.post("/create", summary="创建", tags=["user_team"],
          dependencies=[permission_required("business:team:write")])
async def create(dto: UserTeam, request: Request):
    user_id = CTX_USER_ID.get("user_id")
    collection = Conf.MG_USER_TEAM
    # check email if exists
    query = {"email": dto.email, "authority.owners": user_id}
    cnt = collection.count_documents(query)
    if cnt > 0:
        return wrap_json([], status=1, statusText="该邮箱已被添加过")
    
    # 重置核心字段
    dto._id = ObjectId()
    dto.creater = user_id
    dto.created_time = datetime.now(timezone.utc)
    dto.updated_time = datetime.now(timezone.utc)
    dto.authority = DataAuthority(owners=[user_id])
    dto.invitation = UserTeamInvitation(invite_time=datetime.now(timezone.utc))
    dto = dto.model_dump()
    result = collection.insert_one(dto)
    if not result.acknowledged:
        return wrap_json([], status=1, statusText="操作失败，请检查邮箱")
    
    await agree(dto['_id'], dto["email"])
        
    return wrap_json([])


MAIL_CONTENT = """
<html>
<body>
该邮件为自动发送，请勿回复。
<br/>
我是{{ from_email }}，邀请你协作完成数据任务。
<br/>
请点击<a href="{{ access_uri }}">{{ access_uri }}</a>登录系统。
</body>
</html>
"""
def send_email(to_email: str, tpl_dict: dict):
    m = emails.Message(html=T(MAIL_CONTENT),
                    subject=T("邀请您加入数据协同平台"),
                    mail_from=get_mail_from())
    response = m.send(render=tpl_dict, to=to_email,
                    smtp=get_smtp_config())
    if response.status_code not in [250, ]:
        return False
    else:
        return True

class DataID(BaseModel):
    id: str

@app.post("/email_notify", summary="发送邮件通知", tags=["user_team"],
          dependencies=[permission_required("business:team:write")])
async def email_notification(dto: DataID):
    user_id = CTX_USER_ID.get("user_id")
    _id = ObjectId(dto.id)
    collection = Conf.MG_USER_TEAM
    # 
    query = {"authority.owners": user_id, "_id": _id}
    _rows = collection.find(query)
    rows = list(_rows)
    if len(rows) == 0:
        return wrap_json([], status=1, statusText="没有找到相关记录")
    
    row = rows[0]
    await agree(_id, row["email"])
    
    tpl_dict = {
        "access_uri": "http://www.geluzhiwei.com/",
        "from_email": "to2084@qq.com",
    }
    ret = send_email(row["email"], tpl_dict)
    if ret:
        return wrap_json([])
    else:
        return wrap_json([], status=1, statusText="发送邮件失败")

class DataID(BaseModel):
    id: str
    is_signed: bool
    
@app.post("/sign", summary="加入或者退出", tags=["user_team"],
          dependencies=[permission_required("business:team:write")])
async def team_sign(dto: DataID):
    user_id = CTX_USER_ID.get("user_id")
    _id = ObjectId(dto.id)
    collection = Conf.MG_USER_TEAM
    # 
    query = {"authority.owners": user_id, "_id": _id}
    _rows = collection.find(query)
    rows = list(_rows)
    if len(rows) == 0:
        return wrap_json([], status=1, statusText="没有找到相关记录")
    
    row = rows[0]
    await agree(_id, row["email"])

    return wrap_json([])
    

@app.delete("/delete", summary="删除", tags=["user_team"],
             dependencies=[permission_required("business:team:write")])
async def delete_list(request: Request):
    req_json = await request.json()
    collection = Conf.MG_USER_TEAM
    
    if "_id" in req_json:
        result = collection.delete_one(
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
        result = collection.delete_many(
            {
                "_id": {"$in": ids_to_delete},
                "authority.owners": CTX_USER_ID.get("user_id"),
            }
        )
        if result.deleted_count >= 1:
            return wrap_json([])
        else:
            return wrap_json([], status=1, statusText="delete failed")
    else:
        return wrap_json([], status=1, statusText="_id or _ids is invalid")


@app.put("/update", summary="更新", tags=["user_team"],
         dependencies=[permission_required("business:team:write")])
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

    collection = Conf.MG_USER_TEAM

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


@app.get("/query", summary="查询列表", tags=["user_team"],
         dependencies=[permission_required("business:team:read")])
async def query(request: Request, _id: str = Query(None)):
    if ObjectId.is_valid(_id):
        query = {"_id": ObjectId(_id), "authority.owners": CTX_USER_ID.get("user_id")}
    else:
        query = {"authority.owners": CTX_USER_ID.get("user_id")}
        
    collection = Conf.MG_USER_TEAM
    rows = collection.find(query).sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)
    for row in rows:
        if row['user_id'] > 0 and row['is_registered']:
            user = await user_service.get_user_by_id(row['user_id'])
            row['user_info'] = {
                "name": user.name,
                "mobile_number": user.mobile_number
            }
    return wrap_json(mongo_json_encoder(rows))


@app.get("/query_members", summary="查询选择框数据", tags=["user_team"],
         dependencies=[permission_required("business:team:read")])
async def query(request: Request):
    query = {"authority.owners": CTX_USER_ID.get("user_id"), "is_registered": True}
    collection = Conf.MG_USER_TEAM
    rows = collection.find(query).sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)
    for row in rows:
        user = await user_service.get_by_email(row['email'])
        if not user:
            logger.warning(f"user {row['email']} not found")
            continue
        row['user_info'] = {
            "name": "", #user.name,
            "mobile_number": "" #user.mobile_number
        }
    return wrap_json(mongo_json_encoder(rows))


@app.get("/query_others", summary="查询参与列表", tags=["user_team"],
         dependencies=[permission_required("business:team:read")])
async def query_others():
    query = {"user_id": CTX_USER_ID.get("user_id")}
    collection = Conf.MG_USER_TEAM
    rows = collection.find(query).sort("updated_time", pymongo.DESCENDING)
    rows = list(rows)
    
    for row in rows:
        user = await user_service.get(row["authority"]["owners"][0])
        row['main_email'] = user.email
        row['main_id'] = user.id
    return wrap_json(mongo_json_encoder(rows))


class SearchFields(BaseModel):
    email: str | None = None
    is_registered: bool | None = None
    is_signed: bool | None = None

class Search(BaseModel):
    pager: Pager
    query: SearchFields

@app.post("/search", summary="分页搜索", tags=["user_team"],
          dependencies=[permission_required("business:team:read")])
async def paged_search(search: Search):
    user_id = CTX_USER_ID.get("user_id")
    query = {"authority.owners": user_id}
    if search.query.email and search.query.email != "":
        query["email"] = search.query.email
    if search.query.is_registered is not None:
        query["is_registered"] = search.query.is_registered
    if search.query.is_signed is not None:
        query["agreement.is_signed"] = search.query.is_signed

    collection = Conf.MG_USER_TEAM
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
