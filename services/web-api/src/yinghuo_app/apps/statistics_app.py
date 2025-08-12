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
数据统计
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-06-26"
import time
from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import ORJSONResponse

from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from yinghuo_conf import Conf
from ..biz.services.job import job_service
from .ctx import CTX_USER_ID, CTX_USER_FRESHNESS
from ..dto.response import SuccessJson, FailJson
from ..biz.services.team import team_service
from ..utils.perf import timeit
from ..log import logger

app = APIRouter()


def objTypeCountByFrame(datas: list[dict]) -> list[dict]:
    """https://plotly.com/javascript/bar-charts/
    [
        {
            frame: 1,
            objectCount: 20,
        },
        {},
    ]
    """
    frames = []
    for frame_dict in list(datas):
        if 'jobConfig' not in frame_dict:
            continue
        job_perform = frame_dict['jobConfig']
        labels = {
                k: v for k, v in frame_dict['frame_labels'].items()
                if not v.get('is_removed', False)
            }
        frames.append({
            "frame": job_perform['frame'],
            "objectCount": len(labels)
        })
        
    return frames

def objTypeCount(datas: list[dict]) -> list[dict]:
    """https://plotly.com/javascript/bar-charts/
    """
    objTypeCount = {}
    for frame_dict in list(datas):
        for k, obj in frame_dict['frame_labels'].items():
            if obj.get('is_removed'):
                continue
            objType = 'default'
            if 'objType' in obj.keys():
                objType = obj['objType']
            if objType in objTypeCount.keys():
                objTypeCount[objType] += 1
            else:
                objTypeCount[objType] = 1

    # objTypes = list(objTypeCount.keys())
    # objCounts = [objTypeCount[k] for k in objTypes]

    # plotly_data = [
    #     {
    #         "x": objTypes,
    #         "y": objCounts,
    #         "type": 'bar'
    #     }
    # ]
    return objTypeCount


@app.post("/seq")
async def seq(request: Request):
    data = await request.json()
    current_mission = data['current_mission']
    seq = data['seq']
    stream = data['stream']
    frame = data.get('frame')
    statisticsType = data['statisticsType']
    
    uuid = data["uuid"]
    user_id = CTX_USER_ID.get("user_id")
    doc = await job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        return FailJson(status=501, statusText="没有权限")

    if current_mission not in Conf.MG_COLLECTION.keys():
        return wrap_json([], status=1, statusText="不支持的任务类型")
    
    start = time.perf_counter()
    projection = {
        'jobConfig': 1,
        'frame_labels': 1,
        '_id': 0
    }
    query = {
        "jobConfig.uuid": uuid,
        "jobConfig.seq": seq,
        "jobConfig.stream": stream,
    }
    if frame is not None:
        query["jobConfig.frame"] = frame
    rows = Conf.MG_COLLECTION[current_mission].find(query, projection)
    end = time.perf_counter()
    elapsed = end - start
    logger.info(f'{current_mission}.find Time taken: {elapsed:.6f} seconds')

    rows = await rows.to_list(length=None)
    rtn = []
    if statisticsType == "objTypeCount":
        rtn = objTypeCount(rows)
    elif statisticsType == "objTypeCountByFrame":
        rtn = objTypeCountByFrame(rows)
    else:
        rtn = []

    return wrap_json(data=rtn)


@app.post("/my")
async def my(request: Request):
    data = await request.json()
    user_id = CTX_USER_ID.get("user_id")
    
    query1 = {"authority.owners": user_id}
    query2 = {"authority.collaborators": user_id}
    my_depts = await team_service.find_my_dept_ids(user_id)
    query3 = {"authority.dept": {"$in": my_depts}}
    
    collection = Conf.MG_ANNO_JOB_PERFORM
    admin_job_count = await collection.count_documents(query1)
    
    query = {"$or": [query2, query3]}
    collaborator_job_count = await collection.count_documents(query)
    
    rtn = {
        "job": {
            "collaborator": collaborator_job_count,
            "admin": admin_job_count,
        },
        "anno": {
            "total_count": 0,
        }
    }
    return wrap_json(data=rtn)