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
data sequence api
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-09-20"
__version__ = "0.0.1"

import os
import json
import logging
from typing import Annotated
from fastapi import Body, FastAPI
from fastapi.responses import ORJSONResponse
from fastapi import Request
from pydash import _
from glob import glob
from bson import ObjectId
import pathlib
from fastapi import APIRouter
from yinghuo_conf.api_util.utils import wrap_json, json_encoder, mongo_json_encoder
from yinghuo_conf import Conf, settings
from ..biz.db.collection import JobPerform
from ..biz.services import job_meta
from fastapi import Depends
from .ctx import CTX_USER_ID


# app = FastAPI()
app = APIRouter()


def get_dir_structure(prefix, base_dir, ignore_hidden=True):
    
    def _get_dir_structure_recursive(prefix, path, level=0):
        dirs = []
        
        for entry in os.scandir(path):
            base_name = os.path.basename(path)
            if entry.is_dir() and (not ignore_hidden or not entry.name.startswith((".", "_"))):
                subdir_name = entry.name
                label = prefix + "/" + subdir_name
                cur_node = {
                    "value": label,
                    "label": subdir_name,
                }
                
                subdir_path = os.path.join(path, subdir_name)
                # 是不是openpgl数据
                if os.path.exists(os.path.join(subdir_path, "meta.json")):
                    try:
                        seqData = SeqData.from_seq_data_dir(subdir_path)
                        cur_node = {
                            # "value": {
                            #     "seq_meta": seqData.seq_meta_obj.meta_dict,
                            #     "value": label,
                            # },
                            "value": label,
                            "label": subdir_name,
                            "seq_meta": seqData.seq_meta_obj.meta_dict,
                        }
                        dirs.append(cur_node)
                        # return dirs # 停止递归
                    except Exception as e:
                        pass
                elif os.listdir(subdir_path):  # Check if the directory is not empty
                    cur_node["children"] = _get_dir_structure_recursive(label, subdir_path, level + 1)
                    
                dirs.append(cur_node)
        return dirs
    return _get_dir_structure_recursive(prefix, base_dir)

@app.get("/dataSeq")
def list_dataSeq():
    """加载数据集目录结构，如果没有配置路径，加载实例数据
    Returns:
        _type_: _description_
    """
    user_id = CTX_USER_ID.get('user_id')
    data_root = os.path.join(settings.YH_USER_DATA_ROOT, str(user_id))
    dir_tree = get_dir_structure("", data_root)
    # dir_tree += get_dir_structure("", os.path.join(settings.YH_USER_DATA_ROOT, 'example-datas'))
    
    return wrap_json(json_encoder(dir_tree))


def get_non_empty_subdirs(base_dir):
    """
    """
    non_empty_subdirs = []
    for subdir_name in os.listdir(base_dir):
        subdir_path = os.path.join(base_dir, subdir_name)
        if os.path.isdir(subdir_path) and os.listdir(subdir_path):  # 检查是否为目录且非空
            non_empty_subdirs.append(subdir_name)
    return non_empty_subdirs

@app.get("/dataSeqStreams")
def list_dataSeq_stream(seq: str):
    if '../' in seq:
        # 禁止访问父目录
        seq = "."
    if seq.startswith("/"):
        seq = seq[1:]
    user_id = CTX_USER_ID.get('user_id')
    data_root = os.path.join(settings.YH_USER_DATA_ROOT, str(user_id), seq)
    # check seq format
    if os.path.exists(os.path.join(data_root, "meta.json")):
        seqData = SeqData.from_seq_data_dir(data_root)
        # streams = [{k:v.meta_dict} for k, v in seqData.stream_metas_obj.streams.items()],
        streams = [k for k, v in seqData.stream_metas_obj.streams.items()]
    else:
        # 2. simple-directory
        streams = get_non_empty_subdirs(data_root)
    return wrap_json(streams)


@app.post("/stream/meta")
async def stream_meta2(job_perform: JobPerform, request: Request):
    user_id = CTX_USER_ID.get("user_id")
    if job_perform.data_format == "openlabel" or \
            job_perform.data_format == "simple-directory":
        d = await job_meta.find_stream_meta(job_perform.uuid, job_perform.stream, job_perform.data_source, seq=job_perform.seq)
        return wrap_json(d)
    else:
        return wrap_json(
            {}, code=410, message="data_format must be openlabel or simple-directory"
        )
        
        
@app.put("/stream/meta")
async def update_stream_meta_uris(uuid:str= Body(..., embed=True), uris:list[str]= Body(..., embed=True),
                                  jobConfig: JobPerform = Body(..., embed=True)):
    user_id = CTX_USER_ID.get("user_id")
    # check
    if uuid is None or uuid == '':
        return wrap_json(
            {}, code=410, message="uuid不能为空"
        )
    if len(uris) == 0:
        return wrap_json(
            {}, code=410, message="uris不能为空"
        )
    
    if jobConfig.data_source == "imageURLs":
        result = await job_meta.update_stream_urls(uuid, uris)
        if result.modified_count == 1:
            return wrap_json({})
        else:
            return wrap_json(
                {}, code=410, message="更新失败"
            )
    else:
        return wrap_json(
            {}, code=410, message="不允许更新"
        )

@app.post("/meta")
async def seq_meta2(job_perform: JobPerform):
    user_id = CTX_USER_ID.get("user_id")
    if job_perform.data_format == "simple-directory" or \
            job_perform.data_format == "openlabel":
        d = await job_meta.find_seq_meta(job_perform.uuid)
        return wrap_json(d)
    else:
        raise wrap_json(
            {}, code=410, message="data_format must be openlabel or simple-directory"
        )
