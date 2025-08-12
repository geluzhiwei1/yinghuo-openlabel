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
label rest api
"""

__author__ = "Zhang Lizhi"
__date__ = "2023-09-01"

import os
import sys
from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import FileResponse, ORJSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi import BackgroundTasks

from yinghuo_app.dto.response import FailJson, SuccessJson
from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from yinghuo_conf import Conf
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
from ..dto.users import RoleEnum, UserJobAuth
from ..log import logger
from yinghuo_conf import Conf, settings

app = APIRouter(tags=["label api"])

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
    
    # 
    full_file_path = f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq}/_yh_output/anno_vals/{label_uuid}.json"
    if not os.path.exists(full_file_path):
        return wrap_json(status=1, statusText="文件不存在")

    # res = FileResponse(full_file_path)
    return SuccessJson(data=json.loads(open(full_file_path, mode="r", encoding='utf8').read()))



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
    auth = await job_service.get_user_job_auth(user_id, uuid)
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
    rows = await Conf.MG_COLLECTION[current_mission].find(query).to_list(length=None)
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
    auth = await job_service.get_user_job_auth(user_id, uuid)
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
    frame_anno_doc = await collection.find_one_and_update(query, update)
    if frame_anno_doc is None:
        res = await collection.insert_one({
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
    auth = await job_service.get_user_job_auth(user_id, uuid)
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
    datas = await rows.to_list(length=None)
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
    auth = await job_service.get_user_job_auth(user_id, uuid)
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
    frame_anno_doc = await collection.find_one(query)
    if frame_anno_doc is None:
        res = await collection.insert_one({
            "jobConfig": jobConfig,
            "frame_labels": {},
            "update_time": datetime.now(UTC),
            "authority": {'owner': user_id},
        })
        if not res.acknowledged:
            return wrap_json({}, status=1, statusText="save frame anno failed")
        frame_anno_id = res.inserted_id
        frame_anno_doc = await collection.find_one({
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
            result = await collection.update_one(update_query, {
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
            result = await collection.update_one(update_query, {
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
                # result = await collection.update_one(update_query, {
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
                result = await collection.update_one(update_query, {
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
    auth = await job_service.get_user_job_auth(user_id, uuid)
    if auth == UserJobAuth.FORBIDDEN:
        return wrap_json({}, status=1, statusText="无权限")
    
    collection = Conf.MG_COLLECTION[current_mission]
    
    # 一个uuid下指定stream的frame_labels = {}
    query = {
        "jobConfig.uuid": jobConfig["uuid"],# job id
        "jobConfig.stream": jobConfig["stream"],
        "authority.owner": user_id,
    }
    
    result = await collection.update_many(query, {
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
    auth = await job_service.get_user_job_auth(user_id, uuid)
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
    frame_anno_doc = await collection.find_one_and_update(query, update)
    if frame_anno_doc is None:
        res = await collection.insert_one({
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
    auth = await job_service.get_user_job_auth(user_id, uuid)
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
    datas = await rows.to_list(length=None)
    return wrap_json(mongo_json_encoder(datas))


@app.post("/export_coco")
async def export_coco(request: Request):
    data = await request.json()
    job_uuid = data["job_uuid"]
    d = await anno_service.export_to_coco(job_uuid=job_uuid)
    return wrap_json(d, status=0, statusText="")
