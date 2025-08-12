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
Config 
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-25"

from datetime import datetime
import os
from typing import Any
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient
import os
import typing
import logging

from pydantic_settings import BaseSettings


logging.getLogger('pymongo').setLevel(logging.WARNING)


class Config:
    
    WATCHING_SERVICES = ["det.lidar.3d"]
    FILE_PATH = "/api/v1/b/file/"

    def __init__(self):
        self.PACKAGE_ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

        from yinghuo_conf.loader import app_settings
        mongodb_client = AsyncIOMotorClient(app_settings.global_config.mongodb.uri, authMechanism='SCRAM-SHA-256')
        db = mongodb_client[app_settings.global_config.mongodb.db]
        # self.MG_label_semantic2d = db['label_semantic2d']
        # self.MG_label_aabb2d = db['label_aabb2d']
        self.MG_ANNO_JOB_PERFORM = db['anno_job']
        self.MG_COUNTER = db['counter']
        self.MG_COLLECTION = {
            'semantic2d': db['label_semantic2d'],
            'objectBBox2d': db['label_object_bbox2d'],
            'objectRBBox2d': db['label_object_rbbox2d'],
            'trafficSignal2d': db['label_traffic_signal2d'],
            'trafficSign2d': db['label_traffic_sign2d'],
            'parkingSlot2d': db['label_parking_slot2d'],
            'trafficLine2d': db['label_traffic_line2d'],
            'objectDet3dLidar': db['label_object3d_lidar'],
            # 3d
            'objectBBox3d': db['label_object3d_bbox'],
            'pcSemantic3d': db['label_setamic3d_pc'],
            'pcPolyline3d': db['label_polyline3d_pc'],
            
            # 图像自身的标注信息
            'imageLabel': db['label_image'],
            # 序列的标注信息
            'seqLabel': db['label_seq'],
            
            # funcs 相关
            'funcs': db['funcs'],
            'flows': db['flows'],
            
            # 视频事件的标注信息
            'videoEvents': db['label_video_event'],
        }
        
        # 存储数据元信息
        self.MG_DATA_SEQ_META = db['data_seq_meta']
        self.MG_DATA_STREAM_META = db['data_stream_meta']
        self.MG_DATA_ANNO_SPEC = db['user_anno_spec']
        
        self.MG_USER_DEPTS = db['user_depts']
        self.MG_USER_ROLES = db['user_roles']
        self.MG_USER_TEAM = db['user_team']
        self.MG_USER_RES = db['user_resources']
        
        # 保存成文件的anno
        self.TO_FILE_ANNO = set(
            [
                'semantic2d',
                'pcSemantic3d',
                'pcPolyline3d',
            ]
        )