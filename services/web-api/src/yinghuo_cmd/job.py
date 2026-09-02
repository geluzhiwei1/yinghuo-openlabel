import json
import fire
import os
import asyncio

from yinghuo_app.biz.db.collection import AnnoJob
from yinghuo_app.biz.services.job import job_service
from yinghuo_conf.api_util.utils import mongo_json_encoder

async def create(user_id:int, job_json_file:str):
    """根据指定的json文件创建job

    Args:
        user_id (int): 用户id
        job_json_file (str): job json文件路径
    """
    assert user_id > 0, "user_id must be greater than 0"
    assert os.path.exists(job_json_file), "job_json_file must exist"

    with open(job_json_file, "r") as f:
        job = AnnoJob.model_validate_json(f.read())
        await job_service.create_job(user_id, job)

async def export(job_uuid:str, job_json_file:str=None):
    """
    """
    doc = job_service.get_job(job_uuid)
    if not doc:
        raise ValueError("job not found")
    else:
        mission = doc['label_spec']['mission']['key']
        stream = doc['label_spec']['data']['streams']
        user_id = doc['authority']['owners']
        print(f"mission: {mission}")
        print(f"stream: {stream}")
        print(f"user_id: {user_id}")
    if job_json_file:
        json.dump(mongo_json_encoder(doc), open(job_json_file, "w"), indent=2)

def sync_create(user_id:int, job_json_file:str):
    asyncio.run(create(user_id, job_json_file))

def sync_export(job_uuid:str, job_json_file:str=None):
    asyncio.run(export(job_uuid, job_json_file))

if __name__ == "__main__":
    fire.Fire({
        'create': sync_create,
        'export': sync_export,
    })