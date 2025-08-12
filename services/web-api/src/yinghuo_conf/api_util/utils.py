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
util
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-04-05 甲辰年二月廿七"

from typing import Callable
import logging
try:
    import torch
except:
    pass
import numpy as np
from PIL import Image
import cv2
from datetime import datetime

import json
from typing import Union
from bson.objectid import ObjectId

class RoundingFloat(float):
    __repr__ = staticmethod(lambda x: format(x, '.4f'))
json.encoder.c_make_encoder = None
json.encoder.float = RoundingFloat


def wrap_json(data: any = None, status: int = 0, statusText: str = None):
    return {
        "status": status,
        "statusText": statusText,
        "data": data
    }

def json_encoder(record: [dict, list, tuple]):
    """
    """
    def convert_type(data):
        if isinstance(data, (datetime)):
            return str(data)
        elif isinstance(data, (np.int_, np.intc, np.intp, np.int8,
                               np.int16, np.int32, np.int64, np.uint8,
                               np.uint16, np.uint32, np.uint64)):
            return int(data)
        elif isinstance(data, (np.float16, np.float32, np.float64)):
            return float(data)
        elif isinstance(data, (np.ndarray,)):
            return data.tolist()
        elif isinstance(data, list):
            return list(map(convert_type, data))
        # elif isinstance(data, dict):
        #     return json_encoder(data)
        else:
            return data

    if isinstance(record, dict):
        for key, value in record.items():
            record[key] = json_encoder(value)
        return record
    elif isinstance(record, list):
        return list(map(json_encoder, record))
    elif isinstance(record, tuple):
        return list(map(json_encoder, record))
    else:
        return convert_type(record)
    
    
def convert_cv2_to_pil(img: np.ndarray) -> Image:
    """ Convert Image.
    Args:
        img (np.ndarray): cv2 mat, BGR

    Returns:
        Image: PIL Image
    """
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))


def convert_pil_to_cv2(img: Image) -> np.ndarray:
    """ Convert Image.

    Args:
        img (Image): PIL Image

    Returns:
        np.ndarray: cv2 mat, BGR
    """
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def read_env(file_path: str = None, lines: str = None) -> dict:
    """read env file

    Args:
        file_path (str): full file path
        lines (str): file content

    Returns:
        dict: dict of env
    """
    if file_path:
        with open(file_path) as f:
            lines = f.readlines()

    env_dict = {}
    for line in lines:
        if len(line) < 2 or line.startswith("#"):
            continue
        k, v = line.strip().split('=')
        env_dict[k] = v
    return env_dict


def get_available_gpus():
    """
    Get available GPUs.
    """
    if torch.cuda.is_available():
        gpus = [
            torch.device(f'cuda:{i}') for i in range(torch.cuda.device_count())
        ]
        logging.info(f'Available GPUs: {len(gpus)}')
    else:
        gpus = None
        logging.info('No available GPU.')
    return gpus


def get_free_device(gpus: list) -> int:
    """return gpu id which has the most free memory

    Args:
        gpus (list): gpu ids which are available

    Returns:
        int: gpu id
    """
    import torch
    if gpus is None:
        return torch.device('cpu')
    if hasattr(torch.cuda, 'mem_get_info'):
        free = [torch.cuda.mem_get_info(gpu)[0] for gpu in gpus]
        select_ind = max(zip(free, range(len(free))))[1]
    else:
        import random
        select_ind = random.randint(0, len(gpus) - 1)
    return gpus[select_ind]


class InferencerCache:
    max_size = 2
    _cache = []
    _mata_cache = {}
    try:
        import torch
        gpus = get_available_gpus()
    except:
        pass

    @classmethod
    def get_instance(cls, instance_name, callback: Callable, api_conf:dict=None):
        if len(cls._cache) > 0:
            for i, cache in enumerate(cls._cache):
                if cache[0] == instance_name:
                    # Re-insert to the head of list.
                    cls._cache.insert(0, cls._cache.pop(i))
                    logging.info(f'Use cached {instance_name}.')
                    return cache[1]

        if len(cls._cache) == cls.max_size:
            cls._cache.pop(cls.max_size - 1)
            torch.cuda.empty_cache()
        gpus = api_conf['model_args']['gpus']
        device = get_free_device(gpus)
        instance = callback(device=device)
        logging.info(f'New instance {instance_name} on {device}.')
        cls._cache.insert(0, (instance_name, instance))

        if hasattr(instance, "classes"):
            cls._mata_cache[instance_name] = {
                "classes": instance.classes
            }
        if hasattr(instance, "palette"):
            cls._mata_cache[instance_name] = {
                "palette": instance.classes
            }
        return instance

    @classmethod
    def get_meta(cls, instance_name):
        if instance_name not in cls._mata_cache:
            return {'err_code': 'not available'}
        else:
            return cls._mata_cache[instance_name]


# def mongo_json_encoder(record: [dict, list]):
#     """ """

#     def convert_type(data):
#         if isinstance(data, (datetime)):
#             # ISO format: data.isoformat()
#             return str(data)
#         elif isinstance(data, (ObjectId)):
#             return str(data)
#         elif isinstance(data, list):
#             return list(map(convert_type, data))
#         elif isinstance(data, dict):
#             return mongo_json_encoder(data)
#         try:
#             json.dumps(data)
#             return data
#         except TypeError:
#             raise TypeError(
#                 {
#                     "error_msg": "暂不支持此类型序列化",
#                     "key": key,
#                     "value": value,
#                     "type": type(value),
#                 }
#             )

#     if isinstance(record, dict):
#         for key, value in record.items(): 
#             record[key] = convert_type(value)
#         return record
#     else:
#         return list(map(mongo_json_encoder, record))
    
    
def mongo_json_encoder(record: Union[dict, list]):
    """将MongoDB文档转换为可JSON序列化的格式"""

    def convert_type(data):
        if isinstance(data, datetime):
            # 使用ISO格式字符串，这是JSON标准格式
            return data.isoformat()
        elif isinstance(data, ObjectId):
            # ObjectId转换为字符串
            return str(data)
        elif isinstance(data, list):
            # 列表元素递归处理
            return [convert_type(item) for item in data]
        elif isinstance(data, dict):
            # 字典键值对递归处理
            return {k: convert_type(v) for k, v in data.items()}
        # 对于其他类型，如字符串、数字等，直接返回
        # 如果遇到无法序列化的类型，将在json.dumps时抛出异常
        return data

    # 根据输入类型选择处理方式
    if isinstance(record, dict):
        return {k: convert_type(v) for k, v in record.items()}
    elif isinstance(record, list):
        return [convert_type(item) for item in record]
    else:
        raise TypeError("输入类型必须是字典或列表")