"""
label rest api
"""

__author__ = "Zhang Lizhi"
__date__ = "2023-09-01"

import os
import sys
import time
import pathlib
import httpx
from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi import BackgroundTasks

from yinghuo_app.dto.response import FailJson, SuccessJson
from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from ..exceptions import BizException
from ..config import Conf
if sys.version_info >= (3, 11):
    from datetime import UTC
else:
    from datetime import timezone
    UTC = timezone.utc
from datetime import datetime
from bson.objectid import ObjectId
import json
import pydash
from fastapi import Depends
import traceback
from .ctx import CTX_USER_ID, CTX_USER_FRESHNESS
from ..biz.services.job import job_service
from ..biz.services.anno_job import annoJobService
from ..biz.services.anno import anno_service
from ..biz.data_paths import shared_data_root, split_shared_prefix
from ..biz.services.job_meta import find_stream_meta
from ..dto.users import RoleEnum, UserJobAuth
from ..log import logger
from ..config import Conf, gConf, settings
from .dependency import permission_required

app = APIRouter(tags=["label api"], dependencies=[permission_required("business:label:write")])

@app.post("/val")
async def load_val(request: Request):

    data = await request.json()

    user_id = CTX_USER_ID.get("user_id")
    uuid = data.get("uuid")
    if not ObjectId.is_valid(uuid):
        return wrap_json(status=1, statusText="uuid is invalid")
    label_uuid = data.get("label_uuid", None)
    if label_uuid is None:
        return wrap_json(status=1, statusText="label_uuid is required")

    doc = job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        return wrap_json(status=1, statusText="没有权限")

    job_owner_id = doc['authority']['owners'][0]
    job_seq = doc["label_spec"]["data"]["seq"]


    full_file_path = f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq}/_yh_output/anno_vals/{label_uuid}.json"
    if not os.path.exists(full_file_path):
        return wrap_json(status=1, statusText="文件不存在")

    # res = FileResponse(full_file_path)
    return SuccessJson(data=json.loads(open(full_file_path, mode="r", encoding='utf8').read()))


VOLUME_MASK_MAX_BYTES = 512 * 1024 * 1024


def _volume_mask_path(job_doc, label_uuid: str) -> str:
    """体数据分割 mask 统一按 job owner 落盘(读写同路径,规避 anno_vals 的协作者不一致问题)"""
    job_owner_id = job_doc['authority']['owners'][0]
    job_seq = job_doc["label_spec"]["data"]["seq"].strip("/")
    return f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq}/_yh_output/anno_masks/{label_uuid}.seg.nrrd.gz"


def _check_volume_mask_params(request: Request):
    uuid = request.query_params.get("uuid")
    label_uuid = request.query_params.get("label_uuid")
    if not uuid or not ObjectId.is_valid(uuid):
        return None, None, wrap_json(status=1, statusText="uuid is invalid")
    if not label_uuid or not ObjectId.is_valid(label_uuid):
        return None, None, wrap_json(status=1, statusText="label_uuid is invalid")

    user_id = CTX_USER_ID.get("user_id")
    doc = job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        return None, None, wrap_json(status=1, statusText="没有权限")
    return label_uuid, doc, None


@app.post("/volume_mask/upload")
async def volume_mask_upload(request: Request):
    """体数据分割 labelmap 上传。raw gzip body(.seg.nrrd.gz),按 job owner 原子落盘。
    query: uuid, label_uuid
    """
    label_uuid, doc, err = _check_volume_mask_params(request)
    if err:
        return err

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > VOLUME_MASK_MAX_BYTES:
        return JSONResponse(status_code=413, content={"status": 1, "statusText": "mask 文件超过 512MB 限制"})

    body = await request.body()
    if len(body) == 0:
        return wrap_json(status=1, statusText="空内容")
    if len(body) > VOLUME_MASK_MAX_BYTES:
        return JSONResponse(status_code=413, content={"status": 1, "statusText": "mask 文件超过 512MB 限制"})

    full_path = _volume_mask_path(doc, label_uuid)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    tmp_path = f"{full_path}.tmp"
    with open(tmp_path, "wb") as fp:
        fp.write(body)
    os.replace(tmp_path, full_path)
    return wrap_json({"val_ref": label_uuid, "size": len(body)})


@app.get("/volume_mask/get")
async def volume_mask_get(request: Request):
    """下载体数据分割 labelmap(.seg.nrrd.gz 原样返回,前端 gunzip)。
    query: uuid, label_uuid (token 走中间件 ?token= 兜底)
    """
    label_uuid, doc, err = _check_volume_mask_params(request)
    if err:
        return err

    full_path = _volume_mask_path(doc, label_uuid)
    if not os.path.exists(full_path):
        return wrap_json(status=1, statusText="文件不存在")
    return FileResponse(
        full_path,
        media_type="application/octet-stream",
        filename=f"{label_uuid}.seg.nrrd.gz",
    )


# ── 体数据模型推理(volume_infer): 代理 med-seg 服务 ─────────────────────
# 设计: docs/internals/nrrd-auto-segmentation.md Part B。
# 服务从磁盘自载体数据字节, web-api 只传服务端解析好的绝对路径; mask 字节经
# 本端点鉴权后转发, med-seg 不直接暴露给租户。

_INFER_CLIENT = httpx.AsyncClient(timeout=httpx.Timeout(60.0))
_VOLUME_INFER_TASKS: dict = {}
_VOLUME_INFER_TTL = 3600.0

# model id → 所需流(与 med-seg 服务 /models 的 requires 保持一致)
_INFER_MODEL_REQUIRES = {
    'total-segmentator': ['ct'],
    'autopet': ['ct', 'pet'],
}


def _med_seg_base() -> str:
    infer = gConf.kvs.get('infer') or {}
    url = ((infer.get('med_seg') or {}).get('url') or '').strip().rstrip('/')
    return url or ''


def _volume_frame_file(doc, uuid: str, stream: str, frame: int):
    """解析 (uuid, stream, frame) → 体数据文件绝对路径。镜像 files_app /get 的解析。"""
    job_owner_id = doc['authority']['owners'][0]
    job_seq = doc["label_spec"]["data"]["seq"]
    seq_is_shared, seq_rest = split_shared_prefix(job_seq)
    if seq_is_shared:
        seq_base = str(pathlib.Path(shared_data_root()) / seq_rest)
    else:
        seq_base = f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq.strip('/')}"
    stream_meta = find_stream_meta(
        uuid, stream, doc["label_spec"]["data"].get("dataSource", ""), seq=job_seq)
    file_path = pydash.get(stream_meta, f"openlabel.frames.{frame}.frame_properties.name", None)
    if file_path is None or file_path.startswith(("http://", "https://")):
        return None
    if doc["label_spec"]["data"]["format"] != 'simple-directory':
        file_path = file_path.replace("file://.", "")
    return f"{seq_base}/{file_path}"


def _volume_infer_sweep() -> None:
    now = time.time()
    for tid in list(_VOLUME_INFER_TASKS.keys()):
        t = _VOLUME_INFER_TASKS[tid]
        if now - t['created'] > _VOLUME_INFER_TTL:
            _VOLUME_INFER_TASKS.pop(tid, None)


async def _infer_service_segment(ct_path, pet_path, owner_id, seq, frame,
                                 models, split_structures=False) -> str:
    """调 med-seg POST /segment, 返回 task_id。"""
    base = _med_seg_base()
    if not base:
        raise BizException('infer 服务未配置')
    r = await _INFER_CLIENT.post(f"{base}/segment", json={
        'ct_path': ct_path, 'pet_path': pet_path, 'owner_id': owner_id,
        'seq': seq, 'frame': frame, 'models': models,
        'split_structures': split_structures,
    })
    if r.status_code != 202:
        raise BizException(f'infer 服务受理失败: {r.status_code} {r.text[:200]}')
    return r.json()['task_id']


@app.get("/volume_infer/models")
async def volume_infer_models():
    """模型探测。未配置/不可达 → 503, 前端隐藏 AI 分割入口。"""
    base = _med_seg_base()
    if not base:
        return JSONResponse(status_code=503, content={"status": 1, "statusText": "infer service not configured"})
    try:
        r = await _INFER_CLIENT.get(f"{base}/models")
        if r.status_code != 200:
            raise httpx.HTTPError(f'status {r.status_code}')
        return wrap_json(data=r.json())
    except httpx.HTTPError as e:
        logger.warning(f"volume_infer models probe failed: {e}")
        return JSONResponse(status_code=503, content={"status": 1, "statusText": "infer service unreachable"})


@app.post("/volume_infer", status_code=202)
async def volume_infer_create(request: Request):
    """发起体数据模型推理。body: {uuid, stream, frame, models, params?}
    stream=当前标注基流(几何参照);所需流(ct/pet)的文件由服务端解析后传给 med-seg。
    """
    _volume_infer_sweep()
    data = await request.json()
    uuid = data.get("uuid")
    models = data.get("models") or []
    if not uuid or not ObjectId.is_valid(uuid):
        return wrap_json(status=1, statusText="uuid is invalid")
    if not models or not isinstance(models, list):
        return wrap_json(status=1, statusText="models 不能为空")
    try:
        frame = int(data.get("frame", 0))
    except (TypeError, ValueError):
        return wrap_json(status=1, statusText="frame is invalid")
    unknown = [m for m in models if m not in _INFER_MODEL_REQUIRES]
    if unknown:
        return wrap_json(status=1, statusText=f"未知模型: {unknown}")

    user_id = CTX_USER_ID.get("user_id")
    doc = job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        return wrap_json(status=1, statusText="没有权限")

    streams = doc["label_spec"]["data"].get("streams") or []
    ct_stream = 'ct' if 'ct' in streams else (streams[0] if streams else 'ct')
    pet_stream = 'pet' if 'pet' in streams else None
    owner_id = doc['authority']['owners'][0]
    seq = doc["label_spec"]["data"]["seq"]

    required = set()
    for m in models:
        required.update(_INFER_MODEL_REQUIRES[m])
    wanted = {'ct': ct_stream}
    if 'pet' in required:
        if not pet_stream:
            return wrap_json(status=1, statusText="任务缺少 pet 流, 无法运行 autopet")
        wanted['pet'] = pet_stream
    paths = {}
    for kind, stream_name in wanted.items():
        p = _volume_frame_file(doc, uuid, stream_name, frame)
        if not p or not os.path.exists(p):
            return wrap_json(status=1, statusText=f"流 {kind}({stream_name}) 的体数据文件不存在(frame={frame})")
        paths[kind] = p

    try:
        service_task_id = await _infer_service_segment(
            paths.get('ct'), paths.get('pet'), owner_id, seq, frame, models)
    except BizException as e:
        return wrap_json(status=1, statusText=str(e))
    except httpx.HTTPError as e:
        return wrap_json(status=1, statusText=f"infer 服务不可达: {e}")

    task_id = str(ObjectId())
    _VOLUME_INFER_TASKS[task_id] = {
        'uuid': uuid, 'user_id': user_id, 'created': time.time(),
        'service_task_id': service_task_id, 'terminal': None, 'mask_bytes': None,
    }
    return JSONResponse(status_code=202, content={"status": 0, "data": {"task_id": task_id}})


@app.get("/volume_infer/{task_id}")
async def volume_infer_status(task_id: str):
    """轮询推理状态。done 时 mask_url 指回本服务的鉴权下载端点。"""
    task = _VOLUME_INFER_TASKS.get(task_id)
    if task is None:
        return wrap_json(status=1, statusText="task not found")

    if task['terminal'] is None:
        base = _med_seg_base()
        try:
            r = await _INFER_CLIENT.get(f"{base}/segment/{task['service_task_id']}")
            if r.status_code != 200:
                raise httpx.HTTPError(f'status {r.status_code}')
            remote = r.json()
        except httpx.HTTPError as e:
            return wrap_json(status=1, statusText=f"infer 服务不可达: {e}")
        if remote.get('status') in ('done', 'failed'):
            task['terminal'] = remote
    remote = task['terminal'] or {}
    out = {
        'status': remote.get('status') or 'running',
        'progress': remote.get('progress') or 0.0,
    }
    if remote.get('error'):
        out['error'] = remote['error']
    if remote.get('status') == 'done':
        # 裸 router 路径, 前端拼 bizBaseURL(nginx 网关会加 /api/v1/b 前缀)
        out['mask_url'] = f"/label/volume_infer/{task_id}/mask"
    return wrap_json(data=out)


@app.get("/volume_infer/{task_id}/mask")
async def volume_infer_mask(task_id: str):
    """下载推理结果 mask(.seg.nrrd.gz), 重新走 job 鉴权。"""
    task = _VOLUME_INFER_TASKS.get(task_id)
    if task is None:
        return wrap_json(status=1, statusText="task not found")

    user_id = CTX_USER_ID.get("user_id")
    if job_service.can_user_see_job(user_id, task['uuid'], CTX_USER_FRESHNESS.get()) is None:
        return wrap_json(status=1, statusText="没有权限")

    if task.get('mask_bytes') is None:
        remote = task.get('terminal') or {}
        url = (remote.get('mask') or {}).get('url')
        if not url:
            return wrap_json(status=1, statusText="任务尚未完成")
        try:
            r = await _INFER_CLIENT.get(url)
            if r.status_code != 200:
                raise httpx.HTTPError(f'status {r.status_code}')
            task['mask_bytes'] = r.content
        except httpx.HTTPError as e:
            return wrap_json(status=1, statusText=f"mask 拉取失败: {e}")
    return Response(
        content=task['mask_bytes'],
        media_type="application/octet-stream",
        headers={"content-disposition": f'attachment; filename="{task_id}.seg.nrrd.gz"'},
    )



@app.post("/load")
async def load_label(request: Request):
    """按照权限获取数据，并返回

    Args:
        request (Request): _description_

    Returns:
        _type_: _description_
    """
    user_id = CTX_USER_ID.get('user_id')
    data = await request.json()
    # check params    
    current_mission = data["current_mission"]
    seq = data["seq"]
    stream = data["stream"]
    frame = data["frame"]
    uuid = data["uuid"]
    if uuid is None or uuid == "" \
                or data["seq"] == "" \
                or data["stream"] == "" \
                or data["frame"] == "":
        return wrap_json({}, status=1, statusText="参数错误")
    
    logger.info(f"authority check")
    # check authority
    auth = job_service.get_user_job_auth(user_id, uuid)
    logger.info(f"{user_id} has auth {auth}")
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")

    if current_mission not in Conf.MG_COLLECTION.keys():
        return wrap_json({}, status=1, statusText="不支持的任务类型")
    
    query = {
            "jobConfig.uuid": uuid,# job id
            "jobConfig.seq": seq,
            "jobConfig.stream": stream,
            "jobConfig.frame": frame,
    }
    # if auth == UserJobAuth.COLLABORATOR or auth == UserJobAuth.DEPT_ROLE_ANNO:
    #     # my own data 
    #     query['authority.owner'] = user_id

    logger.info(f"finding data")
    rows = Conf.MG_COLLECTION[current_mission].find(query)
    logger.info(f"finded.")
    # datas = mongo_json_encoder(list(rows))
    
    # 遍历rows, 将每个row转换为字典形式，然后添加到datas列表中
    datas = []
    for row in rows:
        
        logger.info(f"get one row")
        
        data = {}
        data['jobConfig'] = row['jobConfig']
        data['frame_labels'] = {}
        for k, v in row['frame_labels'].items():
            if v.get("is_removed", False):
                continue
            
            logger.info(f"get one label")
            new_op_log = []
            for op_log in v['op_log']:
                new_op_log.append({
                    'user': op_log['user'],
                    'time': op_log['time'].isoformat(),
                    'action': op_log['action'],
                })
            v['op_log'] = new_op_log
            data['frame_labels'][k] = v

        data['update_time'] = row['update_time'].isoformat()
        data['authority'] = row['authority']
        datas.append(data)
    
    logger.info(f"mongo_json_encoder done")
    # for d in datas:
    #     for k, v in d['frame_labels'].items():
    #         if v.get("is_removed", False):
    #             d['frame_labels'][k] = None
    #             # del d['frame_labels'][k]
    #             # d['frame_labels'].remove(k)
    # logger.info(f"is_removed done")
    return wrap_json(datas)


@app.post("/volume_frames_summary")
async def volume_frames_summary(request: Request):
    """帧级标注概要(轻量): 返回 {frame(str): {segments: 非移除段数, ai: 含模型预标注}}。

    供 DataPanel 徽章用。frame_labels 键是动态 label_uuid, 点路径投影进不去,
    用聚合在库内数(不回传 val/contours, 浏览器保存的 doc 可达数百 KB)。
    """
    user_id = CTX_USER_ID.get('user_id')
    data = await request.json()
    current_mission = data.get("current_mission")
    seq = data.get("seq") or ""
    stream = data.get("stream") or ""
    uuid = data.get("uuid") or ""
    if not uuid or not stream or not seq or current_mission not in Conf.MG_COLLECTION:
        return wrap_json({}, status=1, statusText="参数错误")

    if job_service.get_user_job_auth(user_id, uuid) == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")

    pipe = [
        {"$match": {"jobConfig.uuid": uuid, "jobConfig.seq": seq, "jobConfig.stream": stream}},
        {"$project": {"frame": "$jobConfig.frame",
                      "arr": {"$ifNull": [{"$objectToArray": {"$ifNull": ["$frame_labels", {}]}}, []]}}},
        {"$project": {"frame": 1,
                      "n": {"$size": {"$filter": {"input": "$arr",
                                                  "cond": {"$ne": ["$$this.v.is_removed", True]}}}},
                      "ai": {"$gt": [{"$size": {"$filter": {"input": "$arr",
                                                            "cond": {"$eq": ["$$this.v.attributes.origin", "model"]}}}}, 0]}},
        },
    ]
    frames = {}
    for row in Conf.MG_COLLECTION[current_mission].aggregate(pipe):
        frame = str(row.get("frame") or "")
        if not frame or not row.get("n"):
            continue
        acc = frames.setdefault(frame, {"segments": 0, "ai": False})
        acc["segments"] += row["n"]
        acc["ai"] = acc["ai"] or bool(row.get("ai"))
    return wrap_json({"frames": frames})


@app.post("/frame_save")
async def frame_save(request: Request):
    data = await request.json()
    frame_labels, jobConfig = data["frame_labels"], data["jobConfig"]
    current_mission = data["current_mission"]
    if current_mission not in Conf.MG_COLLECTION.keys():
        return wrap_json({}, status=1, statusText="不支持的任务类型")
    
    # check params
    if jobConfig is None \
            or jobConfig["uuid"] == "" \
            or jobConfig["seq"] == "" \
            or jobConfig["stream"] == "" \
            or jobConfig["frame"] == "":
        return wrap_json({}, status=1, statusText="参数错误")
    if frame_labels is None:
        return wrap_json({}, status=1, statusText="没有要保存的内容")

    user_id = CTX_USER_ID.get('user_id')
    uuid = jobConfig["uuid"]
    # check authority
    auth = job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")
    
    collection = Conf.MG_COLLECTION[current_mission]
    frame_anno_id = None
    query = {
        "jobConfig.uuid": jobConfig["uuid"],# job id
        "jobConfig.stream": jobConfig["stream"],
        "jobConfig.frame": jobConfig["frame"],
        "authority.owner": user_id,
    }
    update = {
        "$set": {"frame_labels": frame_labels}
    }
    frame_anno_doc = collection.find_one_and_update(query, update)
    if frame_anno_doc is None:
        res = collection.insert_one({
            "jobConfig": jobConfig,
            "frame_labels": frame_labels,
            "update_time": datetime.now(UTC),
            "authority": {'owner': user_id},
        })
        if not res.acknowledged:
            return wrap_json({}, status=1, statusText="save frame anno failed")
        frame_anno_id = res.inserted_id
    else:
        frame_anno_id = frame_anno_doc["_id"]
        
    if frame_anno_id:
        return wrap_json()
    else:
        return wrap_json({}, status=1, statusText="save frame anno failed")
    

@app.post("/frame_load")
async def frame_load(request: Request):
    user_id = CTX_USER_ID.get('user_id')
    data = await request.json()
    # check params    
    current_mission = data["current_mission"]
    seq = data["seq"]
    stream = data["stream"]
    frame = data["frame"]
    uuid = data["uuid"]
    if uuid is None or uuid == "" \
                or data["seq"] == "" \
                or data["stream"] == "" \
                or data["frame"] == "":
        return wrap_json({}, status=1, statusText="参数错误")
    
    # check authority
    auth = job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")

    if current_mission not in Conf.MG_COLLECTION.keys():
        return wrap_json({}, status=1, statusText="不支持的任务类型")
    
    query = {
            "jobConfig.uuid": uuid,# job id
            "jobConfig.seq": seq,
            "jobConfig.stream": stream,
            "jobConfig.frame": frame,
    }

    rows = Conf.MG_COLLECTION[current_mission].find(query)
    datas = list(rows)    
    return wrap_json(mongo_json_encoder(datas))

@app.post("/save")
async def save(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    frame_labels, jobConfig = data["frame_labels"], data["jobConfig"]
    frame_properties = data["frame_properties"]
    current_mission = data["current_mission"]
    if current_mission not in Conf.MG_COLLECTION.keys():
        return wrap_json({}, status=1, statusText="不支持的任务类型")
    
    # check params
    if frame_labels is None \
        or jobConfig is None \
            or jobConfig["uuid"] == "" \
            or jobConfig["seq"] == "" \
            or jobConfig["stream"] == "" \
            or jobConfig["frame"] == "":
        return wrap_json({}, status=1, statusText="参数错误")
    if len(frame_labels) == 0:
        return wrap_json({}, status=1, statusText="没有要保存的内容")
    
    user_id = CTX_USER_ID.get('user_id')
    uuid = jobConfig["uuid"]
    # check authority
    auth = job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")
    
    collection = Conf.MG_COLLECTION[current_mission]
    query = {
        "jobConfig.uuid": jobConfig["uuid"],# job id
        "jobConfig.stream": jobConfig["stream"],
        "jobConfig.frame": jobConfig["frame"],
        "authority.owner": user_id,
    }
    
    frame_anno_id = None
    frame_anno_doc = collection.find_one(query)
    if frame_anno_doc is None:
        res = collection.insert_one({
            "jobConfig": jobConfig,
            "frame_labels": {},
            "update_time": datetime.now(UTC),
            "authority": {'owner': user_id},
        })
        if not res.acknowledged:
            return wrap_json({}, status=1, statusText="save frame anno failed")
        frame_anno_id = res.inserted_id
        frame_anno_doc = collection.find_one({
            "_id": frame_anno_id
        })
        
        # update job status
        async def back():
            try:
                await annoJobService.ensure_labeling(user_id, uuid)
            except Exception as e:
                print("ensure_labeling error", e)
        background_tasks.add_task(back)
    
    else:
        frame_anno_id = frame_anno_doc["_id"]
    
    update_query = {
        "_id": frame_anno_id,
    }
    
    created = 0
    updataed = 0
    deleted = 0
    unprocessed = 0
    for o in frame_labels:
        
        if jobConfig["mission"] in Conf.TO_FILE_ANNO:
            anno_service.anno_val_to_file(o, user_id, jobConfig["seq"])
                
        op_type = o['attributes']["opType"]
        o['attributes']["opType"] = None # reset
        if op_type == "create":
            o['op_log'] = [{
                'user': user_id,
                'time': datetime.now(UTC),
                'action': 'create',
            }]
            result = collection.update_one(update_query, {
                "$set": {
                    f'frame_labels.{o["label_uuid"]}': o,
                    "frame_properties": frame_properties,
                },
            })
            if result.acknowledged:
                created += 1
        elif op_type == "update":
            label_uuid = o['label_uuid']
            if label_uuid in frame_anno_doc['frame_labels']:
                # 虽然被标记为update，但实际上是新建的
                old_ann = frame_anno_doc['frame_labels'][f'{label_uuid}']
                o['op_log'] = old_ann.get('op_log', []) + [{
                    'user': user_id,
                    'time': datetime.now(UTC),
                    'action': 'update',
                }]
            else:
                o['op_log'] = [{
                    'user': user_id,
                    'time': datetime.now(UTC),
                    'action': 'create',
                }]
            result = collection.update_one(update_query, {
                "$set": {
                    f'frame_labels.{o["label_uuid"]}': o,
                    "frame_properties": frame_properties,
                },
            })
            if result.acknowledged:
                updataed += 1
        elif op_type == "remove":
            label_uuid = o['label_uuid']
            if label_uuid is not None and label_uuid in frame_anno_doc['frame_labels']:
                # result = collection.update_one(update_query, {
                #     "$set": {
                #         f'frame_labels.{label_uuid}.is_removed': True,
                #     },
                #     "$push": {
                #         f'frame_labels.{label_uuid}.op_log': {
                #             'user': user_id,
                #             'time': datetime.now(UTC),
                #             'action': 'remove',
                #         }
                #     }
                # })
                result = collection.update_one(update_query, {
                    "$unset": {
                        f'frame_labels.{label_uuid}': ""
                    }
                })
                if result.acknowledged:
                    deleted += 1
            else:
                logger.warning(f"{label_uuid} is not in frame_anno_doc")
        else:
            unprocessed += 1

    return wrap_json({}, status=0, statusText=f"新增加{created}个，更新{updataed}个，删除{deleted}个，未处理{unprocessed}条")


@app.post("/deleteSeqAll")
async def deleteSeqAll(request: Request):
    """删除一个seq下指定stream的所有frame_labels

    Args:
        request (Request): _description_

    Returns:
        _type_: _description_
    """
    data = await request.json()
    jobConfig = data["jobConfig"]
    current_mission = data["current_mission"]
    if current_mission not in Conf.MG_COLLECTION.keys():
        return wrap_json({}, status=1, statusText="不支持的任务类型")
    
    # check params
    if jobConfig is None \
            or jobConfig["uuid"] == "" or jobConfig["uuid"] is None \
            or jobConfig["seq"] == "" or jobConfig["seq"] is None \
            or jobConfig["stream"] == "" or jobConfig["stream"] is None:
        return wrap_json({}, status=1, statusText="参数错误")
    
    user_id = CTX_USER_ID.get('user_id')
    uuid = jobConfig["uuid"]
    # check authority
    auth = job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")
    
    collection = Conf.MG_COLLECTION[current_mission]
    
    # 一个uuid下指定stream的frame_labels = {}
    query = {
        "jobConfig.uuid": jobConfig["uuid"],# job id
        "jobConfig.stream": jobConfig["stream"],
        "authority.owner": user_id,
    }
    
    result = collection.update_many(query, {
            "$set": {
                'frame_labels': {},
            },
        })
    if result.acknowledged:
        return wrap_json({})
    else:
        return wrap_json({}, status=1, statusText="删除失败")

@app.post("/seq_save")
async def seq_save(request: Request):
    data = await request.json()
    frame_labels, jobConfig = data["frame_labels"], data["jobConfig"]
    current_mission = data["current_mission"]
    if current_mission not in Conf.MG_COLLECTION.keys():
        return wrap_json({}, status=1, statusText="不支持的任务类型")
    
    # check params
    if jobConfig is None \
            or jobConfig["uuid"] == "" \
            or jobConfig["seq"] == "" \
            or jobConfig["stream"] == "":
        return wrap_json({}, status=1, statusText="参数错误")
    if frame_labels is None:
        return wrap_json({}, status=1, statusText="没有要保存的内容")

    user_id = CTX_USER_ID.get('user_id')
    uuid = jobConfig["uuid"]
    # check authority
    auth = job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")
    
    collection = Conf.MG_COLLECTION[current_mission]
    frame_anno_id = None
    query = {
        "jobConfig.uuid": jobConfig["uuid"],# job id
        "jobConfig.stream": jobConfig["stream"],
        "authority.owner": user_id,
    }
    if jobConfig["mission"] == "videoEvents":
        # video的场景，frame实际上代表视频
        query["jobConfig.frame"] = jobConfig["frame"]
        
    update = {
        "$set": {"frame_labels": frame_labels}
    }
    frame_anno_doc = collection.find_one_and_update(query, update)
    if frame_anno_doc is None:
        res = collection.insert_one({
            "jobConfig": jobConfig,
            "frame_labels": frame_labels,
            "update_time": datetime.now(UTC),
            "authority": {'owner': user_id},
        })
        if not res.acknowledged:
            return wrap_json({}, status=1, statusText="save seq anno failed")
        frame_anno_id = res.inserted_id
    else:
        frame_anno_id = frame_anno_doc["_id"]
        
    if frame_anno_id:
        return wrap_json()
    else:
        return wrap_json({}, status=1, statusText="save seq anno failed")

@app.post("/seq_load")
async def seq_load(request: Request):
    user_id = CTX_USER_ID.get('user_id')
    data = await request.json()
    # check params    
    current_mission = data["current_mission"]
    seq = data["seq"]
    stream = data["stream"]
    uuid = data["uuid"]
    if uuid is None or uuid == "" \
                or data["seq"] == "" \
                or data["stream"] == "" \
                or data["mission"] is None:
        return wrap_json({}, status=1, statusText="参数错误")
    
    # check authority
    auth = job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")

    if current_mission not in Conf.MG_COLLECTION.keys():
        return wrap_json({}, status=1, statusText="不支持的任务类型")
    
    query = {
            "jobConfig.uuid": uuid,# job id
            "jobConfig.seq": seq,
            "jobConfig.stream": stream,
    }
    
    if data["mission"] == "videoEvents":
        query["jobConfig.frame"] = data["frame"]

    rows = Conf.MG_COLLECTION[current_mission].find(query)
    datas = list(rows)    
    return wrap_json(mongo_json_encoder(datas))


@app.post("/export_coco")
async def export_coco(request: Request):
    data = await request.json()
    job_uuid = data["job_uuid"]
    d = await anno_service.export_to_coco(job_uuid=job_uuid)
    return wrap_json(d, status=0, statusText="")


@app.post("/export_format")
async def export_format(request: Request):
    """按格式和范围导出标签

    Body:
        format: 'OpenLabel' | 'YOLO' | 'COCO'
        scope: 'currentFrame' | 'currentTask'
        mission: str
        seq, stream, frame, uuid
    """
    data = await request.json()
    fmt = data.get("format") or "OpenLabel"
    scope = data.get("scope") or "currentFrame"
    mission = data.get("mission")
    seq = data.get("seq", "")
    stream = data.get("stream", "")
    frame = data.get("frame")
    uuid = data.get("uuid")

    if not uuid or not mission or mission not in Conf.MG_COLLECTION:
        return wrap_json({}, status=1, statusText="参数错误")

    user_id = CTX_USER_ID.get("user_id")
    auth = job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")

    if fmt == "OpenLabel":
        rows = anno_service._collect_anno_rows(uuid, mission, scope, seq, stream, frame)
        return wrap_json(rows)

    if fmt == "COCO":
        try:
            d = anno_service.export_to_coco_v2(
                job_uuid=uuid, mission=mission, scope=scope,
                seq=seq, stream=stream, frame=frame,
            )
            return wrap_json(d)
        except Exception as e:
            return wrap_json({}, status=1, statusText=f"COCO 导出失败: {e}")

    if fmt == "YOLO":
        try:
            zip_bytes, file_name = anno_service.export_to_yolo(
                job_uuid=uuid, mission=mission, scope=scope,
                seq=seq, stream=stream, frame=frame,
            )
            return Response(
                content=zip_bytes,
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
            )
        except Exception as e:
            return wrap_json({}, status=1, statusText=f"YOLO 导出失败: {e}")

    if fmt in ("SegNrrd", "VolumeJSON"):
        try:
            result = anno_service.export_volume_seg(
                job_uuid=uuid, mission=mission, scope=scope, fmt=fmt,
                seq=seq, stream=stream, frame=frame,
            )
            if fmt == "VolumeJSON":
                return wrap_json(result)
            zip_bytes, file_name = result
            return Response(
                content=zip_bytes,
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
            )
        except BizException as e:
            return wrap_json({}, status=1, statusText=str(e.statusText))
        except Exception as e:
            return wrap_json({}, status=1, statusText=f"体数据导出失败: {e}")


@app.post("/import_format")
async def import_format(request: Request):
    """批量导入体数据分割(File→导入标注)。

    query: uuid, stream(默认 ct), mode = skip | overwrite
    body: zip bytes(export_format SegNrrd 产物;散文件由前端 fflate 打包成 zip)。
    逐 series/*.seg.nrrd.gz 按 series_uid → manifest 帧号 → 几何路由到目标帧,
    patient/网格不一致跳过;命中帧写 mask + label 文档。
    """
    uuid = request.query_params.get("uuid")
    stream = request.query_params.get("stream") or "ct"
    mode = request.query_params.get("mode") or "skip"
    if not uuid or not ObjectId.is_valid(uuid):
        return wrap_json({}, status=1, statusText="uuid is invalid")

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > VOLUME_MASK_MAX_BYTES:
        return JSONResponse(status_code=413, content={"status": 1, "statusText": "导入文件超过 512MB 限制"})

    user_id = CTX_USER_ID.get("user_id")
    auth = job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")

    body = await request.body()
    if len(body) == 0:
        return wrap_json({}, status=1, statusText="空内容")
    if len(body) > VOLUME_MASK_MAX_BYTES:
        return JSONResponse(status_code=413, content={"status": 1, "statusText": "导入文件超过 512MB 限制"})

    try:
        result = anno_service.import_volume_seg(uuid, "volumeSegment3d", body, mode, stream)
        return wrap_json(result)
    except BizException as e:
        return wrap_json({}, status=1, statusText=str(e.statusText))
    except Exception as e:
        return wrap_json({}, status=1, statusText=f"体数据导入失败: {e}")

    return wrap_json({}, status=1, statusText="不支持的格式")
