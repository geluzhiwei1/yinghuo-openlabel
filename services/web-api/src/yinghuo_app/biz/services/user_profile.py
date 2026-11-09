import asyncio

from ...config import Conf
from ..db.collection import UserProfile


class UserProfileService(object):

    async def get_by_user_id(self, user_id: int) -> UserProfile:
        doc = await asyncio.to_thread(
            Conf.MG_USER_PROFILE.find_one, {"user_id": user_id}
        )
        if doc is None:
            return UserProfile()
        fields = {k: doc[k] for k in UserProfile.model_fields if k in doc}
        return UserProfile(**fields)

user_profile_service = UserProfileService()
