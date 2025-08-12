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
anno job biz service
"""

__author__ = "Zhang Lizhi"
__date__ = "2024-09-30"

from bson import ObjectId
from datetime import datetime, timezone

from yinghuo_app.biz.db.collection import JobStatus

from .user import user_service
from ...log import logger
from yinghuo_conf import Conf
from ...apps.ctx import CTX_USER_ID


class AnnoJobService(object):
    def __init__(self):
        self.data = {}

    async def add_collaborator(self, uuid:ObjectId, email:str, is_owner=False):
        user = await user_service.get_by_email(email)
        if user:
            collec_job = Conf.MG_ANNO_JOB_PERFORM
            query = {
                "_id": uuid, 
                "authority.owners": CTX_USER_ID.get("user_id")
            }
            updates = {"$set": {"updated_time": datetime.now(timezone.utc)}}
            if is_owner:
                updates.update({"$push": {"authority.owners": user.id}})
            else:
                updates.update({"$push": {"authority.collaborators": user.id}})
            
            await collec_job.update_one(query, updates)
        else:
            logger.info(f"用户{email}未注册")
    
    async def remove_collaborator(self, uuid:ObjectId, email:str):
        logger.info(f"remove_collaborator {uuid}, {email}")
        collec_job = Conf.MG_ANNO_JOB_PERFORM
        query = {
            "_id": uuid, 
            "authority.owners": CTX_USER_ID.get("user_id")
        }
        updates = {"$set": {"updated_time": datetime.now(timezone.utc)}}
        updates.update({"$pop": {"authority.owners": user.id}})
        updates.update({"$pop": {"authority.collaborators": user.id}})
        
        await collec_job.update_one(query, updates)
    

    async def process_after_create(self, uuid:ObjectId):
        logger.info(f"process_after_create {uuid}")
        
        collec_coll = Conf.MG_ANNO_JOB_PERFORM_COLLABORATOR
        collec_job = Conf.MG_ANNO_JOB_PERFORM
        
        # 查出所有数据
        query1 = {"uuid": uuid}
        async for doc in collec_coll.find(query1):
            email = doc["email"]
            user = await user_service.get_by_email(email)
            if user:
                # 若存在
                query2 = {"_id": uuid}
                update = {"$push": {"authority.collaborators": user.id}}
                rest = await collec_job.update_one(query2, update)
                
                query3 = {"uuid": uuid, "email": email}
                rest = await collec_coll.delete_one(query3)
                
    async def ensure_labeling(self, user_id, uuid:str):
        query1 = {"_id": ObjectId(uuid)}
        collec_job = Conf.MG_ANNO_JOB_PERFORM
        doc = await collec_job.find_one(query1)
        if not doc:
            return False
        else:
            current_status = JobStatus(status=JobStatus.Status.LABELING, update_time=datetime.now(timezone.utc), user_id=user_id)
            up = {"$push": {"status_history": current_status.model_dump()},
                  "$set": {"current_status": current_status.model_dump()}}
            await collec_job.update_one(query1, up)


    async def update_status(self, user_id, uuid:str, new_status:str, desc=None):
        query1 = {"_id": ObjectId(uuid)}
        collec_job = Conf.MG_ANNO_JOB_PERFORM
        doc = await collec_job.find_one(query1)
        if not doc:
            return False
        else:
            current_status = JobStatus(status=new_status, update_time=datetime.now(timezone.utc), user_id=user_id, desc=desc)
            up = {"$push": {"status_history": current_status.model_dump()},
                  "$set": {"current_status": current_status.model_dump()}}
            return await collec_job.update_one(query1, up)
            

annoJobService = AnnoJobService()