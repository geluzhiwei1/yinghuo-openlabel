"""
algo api
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-04-19"

from fastapi import APIRouter, Request

from yinghuo_conf.api_util.utils import wrap_json, json_encoder

from fastapi import FastAPI, File, UploadFile, Form
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask
from pydash import _
import json
import numpy as np

from ..algos import ALGOS
from ..config import Conf
from .dependency import permission_required

app = APIRouter(dependencies=[permission_required("business:algo:write")])


# class RoundingFloat(float):
#     __repr__ = staticmethod(lambda x: format(x, '.3f'))

# json.encoder.c_make_encoder = None
# json.encoder.float = RoundingFloat

# class JEncoder(json.JSONEncoder):
#     def default(self, obj):
#         if isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
#                             np.int16, np.int32, np.int64, np.uint8,
#                             np.uint16, np.uint32, np.uint64)):
#             return int(obj)
#         elif isinstance(obj, (np.float16, np.float32, np.float64)):
#             return float(obj)
#         elif isinstance(obj, (np.ndarray,)):
#             return obj.tolist()
#         return json.JSONEncoder.default(self, obj)


@app.post("/{algo_id}")
async def algo(algo_id: str, request: Request):
    if algo_id in ALGOS.algos:
        req_json = await request.json()
        rtn = await ALGOS.algos[algo_id](req_json)
        return wrap_json(data=json_encoder(rtn))
    else:
        return wrap_json(data=[], status=1, statusText='error algo id')
