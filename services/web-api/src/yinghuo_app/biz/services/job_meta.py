import os
from bson import ObjectId
from pydash import _

from ...config import Conf, gConf, settings
from ..data_paths import file_uri_prefix
from yinghuo_conf.api_util.utils import wrap_json, json_encoder, mongo_json_encoder


def find_seq_meta(uuid: str):
    rows = Conf.MG_DATA_SEQ_META.find({
        # "job.seq": seq,
        "job.uuid": ObjectId(uuid),
        })
    rows = list(rows)
    if len(rows) == 0:
        return None
    return mongo_json_encoder(rows[0]['datas'])


def find_stream_meta(uuid: str, stream: str, data_source:str, seq=None):
    rows = Conf.MG_DATA_STREAM_META.find({
        # "job.seq": seq,
        "job.uuid": ObjectId(uuid),
        "job.stream": stream
    })
    rows = list(rows)
    if len(rows) == 0:
        return None
    data = rows[0]['datas']
    job_owner_id = rows[0]['authority']['owners'][0]
    
    if "openlabel" in data:
        data["openlabel"]['metadata']['uuid'] = str(rows[0]['_id'])
        for k, v in data["openlabel"]["frames"].items():
            uri = _.get(v, "frame_properties.uri")
            _.set(v, "frame_properties.name", uri)

            if data_source == 'serverLocalDir' and seq is not None:
                uri = uri.replace("file://.", "")
                uri = f"{file_uri_prefix(job_owner_id, seq) / uri.strip('/')}"

            _.set(v, "frame_properties.uri", uri)
        
    return mongo_json_encoder(data)


def update_stream_urls(uuid: str, uris: list[str]):
    q = {
        "_id": ObjectId(uuid)
    }
    
    COLL = Conf.MG_DATA_STREAM_META
    
    frames = {}
    for index, img in enumerate(uris):
        _.set(
            frames,
            f"{index}",
            {
                "frame_properties": {
                    "timestamp": index,
                    "uri": img,
                    "imageName": os.path.basename(img),
                }
            },
        )
    return COLL.update_one(q, {
        "$set": {
            "datas.openlabel.frames": frames
        }
    })