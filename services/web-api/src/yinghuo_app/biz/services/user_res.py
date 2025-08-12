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
import json
import os
from typing import List
from bson import ObjectId
import pymongo
from datetime import datetime, timezone

from yinghuo_conf import Conf
from .user import user_service
from ..db.collection import UserResource


class ResourceService(object):
    def __init__(self):
        self._sys_resource_cache = None
    
    async def create_or_update(self, user_id: int, resource_ids: List[str]):
        dto = UserResource(_id=ObjectId(), creater=user_id, is_deleted=False, resources=resource_ids)
        obj = dto.model_dump()
        obj["authority"] = {
            "owners": [user_id],
        }
    
        collection = Conf.MG_USER_RES
        query = {"authority.owners": user_id}
        
        resp = await collection.find_one_and_replace(filter=query, replacement=obj, upsert=True)
        return resp
    
    async def get_by_user_id(self, user_id: int):
        collection = Conf.MG_USER_RES
        query = {"authority.owners": user_id}
        res = await collection.find_one(query)
        return res
    
    async def list_all(self):
        # 加载sys_resource.json的数据
        if self._sys_resource_cache is None:
                json_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "sys_resource.json"))
                with open(json_file_path, encoding='utf8') as file:
                     self._sys_resource_cache = json.load(file)
        return  self._sys_resource_cache

resource_service = ResourceService()
resource_service.list_all()
