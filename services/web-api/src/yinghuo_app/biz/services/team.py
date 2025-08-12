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
from typing import List
from bson import ObjectId
import pymongo
from datetime import datetime, timezone

from yinghuo_conf import Conf
from .user import user_service

class TeamService(object):
    def __init__(self):
        pass
    
    def find_my_team(self, user_id:int):
        collection = Conf.MG_USER_TEAM
        query = {"user_id": user_id}
        return collection.find(query)
        
    async def find_my_dept_ids(self, user_id:int):
        _rows = self.find_my_team(user_id)
        rows = await _rows.to_list(length=None)
        return [row["dept"] for row in rows if row["dept"] is not None]
    
    async def find_my_team_info(self, user_id:int):
        _rows = self.find_my_team(user_id)
        rows = await _rows.to_list(length=None)
        
        infos = []
        for row in rows:
            owner_id = row['authority']['owners'][0]
            owner_user = await user_service.get(owner_id)
            info = {
                "id": owner_user.id,
                "email": owner_user.email,
                "name": "", #user.name,
                "mobile_number": "" #user.mobile_number
            }
            infos.append(info)
            
        return infos

team_service = TeamService()
