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
from ..db.collection import UserRoles
from ...dto.users import RoleEnum
from ...log import logger

class RoleService(object):
    def __init__(self):
        pass

    async def init_system_role(self, user_id: int):
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
            await collection.insert_one(dto)

    async def get_role_name(self, role_ids: List[str]) -> List[str]:
        if len(role_ids) == 0:
            return []
        obj_ids = [ObjectId(oid) for oid in role_ids]
        rows = await Conf.MG_USER_ROLES.find({"_id": {"$in": obj_ids}}).to_list(length=None)
        logger.info(f"{rows}")
        labels = [r['label'] for r in rows]
        return labels


role_service = RoleService()
