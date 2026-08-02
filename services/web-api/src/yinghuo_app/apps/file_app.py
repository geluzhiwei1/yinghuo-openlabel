 # @author Zhang Lizhi
 # @email erlingba@qq.com
 # @date 2024-08-22
 # @date 甲辰 [龙] 年 七月十九 处暑
import logging
import os
import pathlib
from bson import ObjectId

from fastapi import APIRouter, Body, Query, Request
from fastapi.responses import FileResponse, Response

from yinghuo_app.biz.services.user import user_service
from yinghuo_app.dto.users import *
from .ctx import CTX_USER_ID, CTX_USER_FRESHNESS
from ..config import Conf, gConf, settings
from ..dto.response import SuccessJson, FailJson
from ..biz.services.job import job_service
from .dependency import permission_required
logger = logging.getLogger(__name__)

app = APIRouter(dependencies=[permission_required("business:dataset:read")])

@app.route("/{stream_file:path}")
async def get_file(request: Request):
    stream_file:str = request.path_params["stream_file"]
    uuid = request.query_params.get("uuid")
    user_id = CTX_USER_ID.get("user_id")
    
    # check path
    if not ObjectId.is_valid(uuid):
        return FailJson(status=1, statusText="uuid is invalid")
    
    if stream_file.startswith(str(user_id) + '/'):
        # 我自己的数据
        pass
    else:
        # 别人的数据，验证user_id是否有job uuid的权限
        doc = job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
        if doc is None:
            return FailJson(status=1, statusText="没有权限")
    # job_user_id = doc['authority']['owners'][0]
    root_dir = settings.YH_USER_DATA_ROOT
    file_path = pathlib.Path(root_dir) / stream_file
    if file_path.exists():
        res = FileResponse(str(file_path))
        return res
    else:
        logger.warning(f"文件不存在: {file_path}")
        return FailJson(statusText="访问资源失败")