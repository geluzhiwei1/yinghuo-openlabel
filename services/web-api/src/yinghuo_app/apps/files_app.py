 # @author Zhang Lizhi
 # @email erlingba@qq.com
 # @date 2024-08-22
 # @date 甲辰 [龙] 年 七月十九 处暑
import json
import logging
import os
import pathlib
from bson import ObjectId
import glob

from fastapi import APIRouter, Body, Query, Request
from fastapi.responses import FileResponse, Response
import pydash as _

from yinghuo_app.biz.services.user import user_service
from yinghuo_app.dto.users import *
from .ctx import CTX_USER_ID, CTX_USER_FRESHNESS
from ..config import Conf, gConf, settings
from ..dto.response import SuccessJson, FailJson
from ..biz.services.job import job_service
from ..biz.services.job_meta import find_stream_meta
from .dependency import permission_required

logger = logging.getLogger(__name__)

app = APIRouter(dependencies=[permission_required("business:dataset:read")])

@app.get("/get")
async def get_file(request: Request):
    
    user_id = CTX_USER_ID.get("user_id")
    uuid = request.query_params.get("uuid")
    if not ObjectId.is_valid(uuid):
        return FailJson(status=1, statusText="uuid is invalid")
    frame = request.query_params.get("frame")
    frame = int(frame)
    stream = request.query_params.get("stream")
    
    doc = job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        return FailJson(status=1, statusText="没有权限")
    
    job_owner_id = doc['authority']['owners'][0]
    job_seq = doc["label_spec"]["data"]["seq"]
    
    # 检查stream meta
    stream_meta = find_stream_meta(uuid, stream, doc["label_spec"]["data"].get("dataSource", ""), seq=job_seq)
    file_path = _.get(stream_meta, f"openlabel.frames.{frame}.frame_properties.name", None)
    if file_path is None:
        # 存储成文件了
        full_file_paths = glob.glob(f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq}/{stream}/{frame:06d}.*")
        if len(full_file_paths) > 0:
            full_file_path = full_file_paths[0]
            
            if full_file_path.endswith(".json"):
                j = json.loads(open(full_file_path, 'r', encoding='utf-8').read())
                return SuccessJson(data=j)
    else:
        if doc["label_spec"]["data"]["format"] == 'simple-directory':
            full_file_path = f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq}/{file_path}"
        else:
            pcd_file = file_path.replace("file://.", "")
            full_file_path = f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq}/{pcd_file}" #pathlib.Path(settings.YH_USER_DATA_ROOT) / str(job_owner_id) / job_seq / stream / pcd_file
        
    if os.path.exists(full_file_path):
        res = FileResponse(str(full_file_path))
        return res
    else:
        logger.error(f"文件不存在: {full_file_path}")
        return FailJson(statusText="访问资源失败")