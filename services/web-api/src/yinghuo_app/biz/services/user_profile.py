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
from ..db.collection import UserProfile


class UserProfileService(object):
    def __init__(self):
        self._sys_resource_cache = None
        
        self._cache = {
            7: UserProfile(max_job_count=50),
        }

    async def get_by_user_id(self, user_id: int):
        profile = self._cache.get(user_id, None)
        return profile

user_profile_service = UserProfileService()
