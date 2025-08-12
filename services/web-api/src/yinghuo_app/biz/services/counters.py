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
biz service
"""

__author__ = "Zhang Lizhi"
__date__ = "2024-09-30"

from pymongo import MongoClient, ReturnDocument

from yinghuo_conf import Conf


class CounterService(object):
    def __init__(self):
        pass

    async def next_seq(self, key: str) -> int:
        """获取下一个序列号

        Args:
            key (str): _description_

        Returns:
            int: _description_
        """
        collection = Conf.MG_COUNTER
        result = await collection.find_one_and_update(
            {
                "_id": key,
            },
            {"$inc": {"value": 1}},
            upsert=True,
            returnDocument=ReturnDocument.AFTER,
        )
        return result.get("value", 1)


counterService = CounterService()