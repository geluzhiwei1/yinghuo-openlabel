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

import httpx
from fastapi import APIRouter, Body, Query, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from starlette.background import BackgroundTask
import pydash as _

from yinghuo_app.biz.services.user import user_service
from yinghuo_app.dto.users import *
from .ctx import CTX_USER_ID, CTX_USER_FRESHNESS
from ..config import Conf, gConf, settings
from ..biz.data_paths import shared_data_root, split_shared_prefix
from ..dto.response import SuccessJson, FailJson
from ..biz.services.job import job_service
from ..biz.services.job_meta import find_stream_meta
from .dependency import permission_required

logger = logging.getLogger(__name__)

app = APIRouter(dependencies=[permission_required("business:dataset:read")])

async def proxy_http_file(url: str) -> Response:
    client = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(60.0))
    try:
        upstream = await client.send(client.build_request("GET", url), stream=True)
    except httpx.HTTPError as e:
        await client.aclose()
        logger.error(f"拉取远程文件失败: {url}, {e}")
        return FailJson(statusText="访问资源失败")
    if upstream.status_code != 200:
        logger.error(f"拉取远程文件失败: {url}, status={upstream.status_code}")
        await upstream.aclose()
        await client.aclose()
        return FailJson(statusText="访问资源失败")

    async def close_upstream():
        await upstream.aclose()
        await client.aclose()

    headers = {"content-type": upstream.headers.get("content-type") or "application/octet-stream"}
    if "content-length" in upstream.headers:
        headers["content-length"] = upstream.headers["content-length"]
    return StreamingResponse(upstream.aiter_bytes(), headers=headers, background=BackgroundTask(close_upstream))


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
    # shared-datas 前缀的 seq 数据在共享根下,不在 job owner 私有目录
    seq_is_shared, seq_rest = split_shared_prefix(job_seq)
    if seq_is_shared:
        seq_base = str(pathlib.Path(shared_data_root()) / seq_rest)
    else:
        seq_base = f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq.strip('/')}"

    # 检查stream meta
    stream_meta = find_stream_meta(uuid, stream, doc["label_spec"]["data"].get("dataSource", ""), seq=job_seq)
    file_path = _.get(stream_meta, f"openlabel.frames.{frame}.frame_properties.name", None)
    if file_path is None:
        # 存储成文件了
        full_file_paths = glob.glob(f"{seq_base}/{stream}/{frame:06d}.*")
        if len(full_file_paths) > 0:
            full_file_path = full_file_paths[0]

            if full_file_path.endswith(".json"):
                j = json.loads(open(full_file_path, 'r', encoding='utf-8').read())
                return SuccessJson(data=j)
    else:
        if file_path.startswith(("http://", "https://")):
            # 互联网图像(HTTP)数据源: uri 是完整 URL,由后端代理拉取(直连会被 CORS 拦)
            return await proxy_http_file(file_path)
        if doc["label_spec"]["data"]["format"] == 'simple-directory':
            full_file_path = f"{seq_base}/{file_path}"
        else:
            pcd_file = file_path.replace("file://.", "")
            full_file_path = f"{seq_base}/{pcd_file}"
        
    if os.path.exists(full_file_path):
        res = FileResponse(str(full_file_path))
        return res
    else:
        logger.error(f"文件不存在: {full_file_path}")
        return FailJson(statusText="访问资源失败")