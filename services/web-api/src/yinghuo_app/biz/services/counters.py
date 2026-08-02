"""
biz service
"""

__author__ = "Zhang Lizhi"
__date__ = "2024-09-30"

from pymongo import MongoClient, ReturnDocument

from ...config import Conf


class CounterService(object):
    def __init__(self):
        pass

    def next_seq(self, key: str) -> int:
        """获取下一个序列号

        Args:
            key (str): _description_

        Returns:
            int: _description_
        """
        collection = Conf.MG_COUNTER
        result = collection.find_one_and_update(
            {
                "_id": key,
            },
            {"$inc": {"value": 1}},
            upsert=True,
            returnDocument=ReturnDocument.AFTER,
        )
        return result.get("value", 1)


counterService = CounterService()