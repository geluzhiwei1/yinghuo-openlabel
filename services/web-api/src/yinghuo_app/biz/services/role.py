from typing import List
from bson import ObjectId
import pymongo
from datetime import datetime, timezone

from ...config import Conf
from ..db.collection import UserRoles
from ...dto.users import RoleEnum
from ...log import logger

class RoleService(object):
    def __init__(self):
        pass

    def init_system_role(self, user_id: int):
        collection = Conf.MG_USER_ROLES

        system_roles = [r.value for r in RoleEnum]
        for role in system_roles:
            dto = UserRoles(label=role, is_system=True)
            dto._id = ObjectId()
            dto.creater = user_id
            dto.created_time = datetime.now(timezone.utc)
            dto.updated_time = datetime.now(timezone.utc)
            dto = dto.model_dump()
            dto["authority"] = {
                "owners": [user_id],
            }
            collection.insert_one(dto)

    def get_role_name(self, role_ids: List[str]) -> List[str]:
        if len(role_ids) == 0:
            return []
        obj_ids = [ObjectId(oid) for oid in role_ids]
        rows = Conf.MG_USER_ROLES.find({"_id": {"$in": obj_ids}})
        rows = list(rows)
        logger.info(f"{rows}")
        labels = [r['label'] for r in rows]
        return labels


role_service = RoleService()
