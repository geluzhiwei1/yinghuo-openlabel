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
import os
import pathlib
from bson import ObjectId
from pydash import _

from yinghuo_conf import Conf, settings
from yinghuo_conf.api_util.utils import wrap_json, json_encoder, mongo_json_encoder


async def find_seq_meta(uuid: str):
    rows = Conf.MG_DATA_SEQ_META.find({
        # "job.seq": seq,
        "job.uuid": ObjectId(uuid),
        })
    rows = await rows.to_list(length=None)
    if len(rows) == 0:
        return None
    return mongo_json_encoder(rows[0]['datas'])


async def find_stream_meta(uuid: str, stream: str, data_source:str, seq=None):
    rows = Conf.MG_DATA_STREAM_META.find({
        # "job.seq": seq,
        "job.uuid": ObjectId(uuid),
        "job.stream": stream
    })
    rows = await rows.to_list(length=None)
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
                uri = f"{pathlib.Path(Conf.FILE_PATH) / str(job_owner_id) / (seq.strip('/')) / (uri.replace('file://.', ''))}"

            _.set(v, "frame_properties.uri", uri)
        
    return mongo_json_encoder(data)


async def update_stream_urls(uuid: str, uris: list[str]):
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
    return await COLL.update_one(q, {
        "$set": {
            "datas.openlabel.frames": frames
        }
    })