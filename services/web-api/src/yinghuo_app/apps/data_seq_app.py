#!/usr/bin/env python
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
from ..config import Conf, gConf, settings
from yinghuo_app.dto.seq_data import SeqData
from ..biz.db.collection import JobPerform
from ..biz.services import job_meta
from ..biz.data_paths import (
    SHARED_DIR_NAME,
    shared_data_root,
    resolve_seq_dir,
)
from fastapi import Depends
from .ctx import CTX_USER_ID
from .dependency import permission_required


# app = FastAPI()
app = APIRouter(dependencies=[permission_required("business:dataset:read")])



def _is_visible_dir(entry, ignore_hidden=True):
    return entry.is_dir() and (not ignore_hidden or not entry.name.startswith((".", "_")))


def _has_sub_dir(path, ignore_hidden=True):
    try:
        return any(_is_visible_dir(entry, ignore_hidden) for entry in os.scandir(path))
    except OSError:
        return False


def _shared_mount_node():
    """顶层挂载的 shared-datas 虚拟节点;共享根不存在时返回 None。"""
    shared_root = shared_data_root()
    if not os.path.isdir(shared_root):
        return None
    return {
        "value": "/" + SHARED_DIR_NAME,
        "label": SHARED_DIR_NAME,
        "isLeaf": not _has_sub_dir(shared_root),
    }


def list_sub_dirs(prefix, base_dir, ignore_hidden=True):
    """列出 base_dir 下一层子目录，供前端树懒加载逐层取用。

    带 meta.json 的目录按 openlabel 序列解析并标记为叶子；其余目录按是否还有
    下一层子目录决定 leaf，避免一次性递归整棵树把 el-tree-select 撑爆。
    """
    nodes = []
    for entry in os.scandir(base_dir):
        if not _is_visible_dir(entry, ignore_hidden):
            continue
        node = {
            "value": prefix + "/" + entry.name,
            "label": entry.name,
            "isLeaf": True,
        }
        if os.path.exists(os.path.join(entry.path, "meta.json")):
            try:
                seqData = SeqData.from_seq_data_dir(entry.path)
                node["seq_meta"] = seqData.seq_meta_obj.meta_dict
            except Exception:
                logging.warning("解析 openlabel 序列失败: %s", entry.path, exc_info=True)
        else:
            node["isLeaf"] = not _has_sub_dir(entry.path, ignore_hidden)
        nodes.append(node)
    return sorted(nodes, key=lambda node: node["label"])


@app.get("/dataSeq")
def list_dataSeq(path: str = ""):
    """按层加载数据集目录结构，path 为相对数据根目录的路径，空即根目录。
    用户私有目录直接扫;根层额外挂载 shared-datas 共享节点,其子层路由到共享根。
    """
    user_id = CTX_USER_ID.get('user_id')
    base_dir = resolve_seq_dir(user_id, path)
    if base_dir is None:
        return wrap_json(status=400, statusText=f"非法路径: {path}")
    if not os.path.isdir(base_dir):
        return wrap_json([])

    nodes = list_sub_dirs((path or "").rstrip("/"), base_dir)
    if not (path or "").strip("/"):
        mount = _shared_mount_node()
        if mount is not None and all(n["value"] != mount["value"] for n in nodes):
            nodes.append(mount)
    return wrap_json(json_encoder(nodes))



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
    base_dir = resolve_seq_dir(CTX_USER_ID.get('user_id'), seq)
    if base_dir is None or not os.path.isdir(base_dir):
        return wrap_json([])
    # check seq format
    if os.path.exists(os.path.join(base_dir, "meta.json")):
        seqData = SeqData.from_seq_data_dir(base_dir)
        # streams = [{k:v.meta_dict} for k, v in seqData.stream_metas_obj.streams.items()],
        streams = [k for k, v in seqData.stream_metas_obj.streams.items()]
    else:
        # 2. simple-directory
        streams = get_non_empty_subdirs(base_dir)
    return wrap_json(streams)


@app.post("/stream/meta")
async def stream_meta2(job_perform: JobPerform, request: Request):
    user_id = CTX_USER_ID.get("user_id")
    if job_perform.data_format == "openlabel" or \
            job_perform.data_format == "simple-directory":
        d = job_meta.find_stream_meta(job_perform.uuid, job_perform.stream, job_perform.data_source, seq=job_perform.seq)
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
        result = job_meta.update_stream_urls(uuid, uris)
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
        d = job_meta.find_seq_meta(job_perform.uuid)
        return wrap_json(d)
    else:
        raise wrap_json(
            {}, code=410, message="data_format must be openlabel or simple-directory"
        )
