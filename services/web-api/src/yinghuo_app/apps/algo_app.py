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
from yinghuo_conf import Conf

app = APIRouter()


@app.post("/{algo_id}")
async def algo(algo_id: str, request: Request):
    if algo_id in ALGOS.algos:
        req_json = await request.json()
        rtn = await ALGOS.algos[algo_id](req_json)
        return wrap_json(data=json_encoder(rtn))
    else:
        return wrap_json(data=[], status=1, statusText='error algo id')
