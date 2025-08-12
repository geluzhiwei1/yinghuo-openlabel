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
__date__ = "2024-09-29 甲辰年 八月廿七"

from fastapi import FastAPI, Query, Request, APIRouter
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List, Any, Annotated
from bson import ObjectId
import pymongo
from datetime import datetime, timezone
import json

from yinghuo_app.dto.users import UpdateAccount
from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from yinghuo_conf import Conf
from ..dto.data_seq import SimpleDataSeq
from .ctx import CTX_USER_ID
from ..dto.response import SuccessJson, SuccessPage, FailJson
from ..biz.db.collection import Pager, CollectionBase
from ..biz.services.user import user_service

app = APIRouter()


@app.post("/config", summary="登录用户的全局配置", tags=["system"])
async def system_config():
    conf = {}
    return SuccessJson(data=conf)

@app.post("/user_info", summary="登录用户的信息")
async def get_user():
    user_id = CTX_USER_ID.get("user_id")
    user_obj = await user_service.get(id=user_id)
    user_dict = await user_obj.to_dict(exclude_fields=["password"])
    
    # TODO 获取用户的角色、权限等信息
    query = {"authority.owners": user_id}
    collection = Conf.MG_USER_ROLES
    rows = await collection.find(query).sort("updated_time", pymongo.DESCENDING).to_list(length=None)
    labels = [r['label'] for r in rows]
    
    data = {
        "user": user_dict,
        "roles": labels,
        "permissions": []
    }
    
    return SuccessJson(data=data)

class UpdatePassword(BaseModel):
    old_password: str
    new_password: Annotated[str, Field(max_length=50, min_length=6)]
    new_password2: Annotated[str, Field(max_length=50, min_length=6)]

@app.post("/update_password", summary="修改密码", tags=["system"])
async def update_password(dto: UpdatePassword):
    await user_service.update_password(CTX_USER_ID.get(
        "user_id"), dto.old_password, dto.new_password)
    return SuccessJson(statusText="更新成功")

@app.post("/update_account", summary="修改账号信息", tags=["system"])
async def update_account(dto: UpdateAccount):
    await user_service.update_account(CTX_USER_ID.get(
        "user_id"), dto)
    return SuccessJson(statusText="更新成功")