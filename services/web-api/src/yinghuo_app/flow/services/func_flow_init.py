"""
Sync funcs/flows to mongodb 
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-13"

import json
import os
import logging
import click
import dotenv
from collections import namedtuple
from pymongo import MongoClient
import logging
from ...config import Conf, gConf

from qm_funcs_factory.funcs_builder import FuncRegistry

class MainJob(object):
    """
    main job
    """
    def __init__(self):
        pass

    def sync_funcs(self):
        logging.info("sync funcs to mongodb")
        # # 读取json文件，写入mongodb
        # # TODO 若存在，则更新
        # with open(os.path.join(os.path.dirname(__file__), "funcs.json"), "r") as f:
        #     funcs = json.load(f)['funcs']
        #     for func in funcs:
        #         self.db[Config.FUNCS_COLLECTION].insert_one(func)
        #     logging.info("sync funcs to mongodb success")
        for func in FuncRegistry.list_funcs():
            doc = func['meta']['func']
            _id = doc.pop('_id')
            Conf.MG_COLLECTION['funcs'].find_one_and_replace({'_id': _id}, doc, upsert=True)
            logging.info("sync funcs to mongodb success")

    def sync_flows(self):
        logging.info("sync flows to mongodb")
        # 读取json文件，写入mongodb。
        # TODO 若存在，则更新
        with open(os.path.join(os.path.dirname(__file__), "flows.json"), "r") as f:
            flows = json.load(f)['flows']
            for flow in flows:
                Conf.MG_COLLECTION['flows'].insert_one(flow)
            logging.info("sync flows to mongodb success")

    def run(self):
        self.sync_funcs()
        self.sync_flows()


if __name__ == "__main__":
    MainJob().run()
