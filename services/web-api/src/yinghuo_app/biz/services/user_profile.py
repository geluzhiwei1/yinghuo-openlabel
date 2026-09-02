import json
import os
from typing import List
from bson import ObjectId
import pymongo
from datetime import datetime, timezone

from ...config import Conf
from .user import user_service
from ..db.collection import UserProfile


class UserProfileService(object):
    def __init__(self):
        self._cache = {
            7: UserProfile(max_job_count=50),
        }

    async def get_by_user_id(self, user_id: int):
        profile = self._cache.get(user_id, None)
        return profile

user_profile_service = UserProfileService()
