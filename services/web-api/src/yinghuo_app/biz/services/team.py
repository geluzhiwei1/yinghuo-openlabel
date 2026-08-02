from typing import List
from bson import ObjectId
import pymongo
from datetime import datetime, timezone

from ...config import Conf
from .user import user_service

class TeamService(object):
    def __init__(self):
        pass
    
    def find_my_team(self, user_id:int):
        collection = Conf.MG_USER_TEAM
        query = {"user_id": user_id}
        return collection.find(query)
        
    def find_my_dept_ids(self, user_id:int):
        _rows = self.find_my_team(user_id)
        rows = list(_rows)
        return [row["dept"] for row in rows if row["dept"] is not None]
    
    async def find_my_team_info(self, user_id:int):
        _rows = self.find_my_team(user_id)
        rows = list(_rows)
        
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
