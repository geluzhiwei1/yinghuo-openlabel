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
rest api for dnn model inference
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-11-22"

from fastapi import FastAPI, File, UploadFile, Form
from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
import httpx
from pydash import _
import os


from yinghuo_conf import Conf, settings
from yinghuo_conf.loader import app_settings
from .ctx import CTX_USER_ID
from yinghuo_conf.api_util.api_discovery import ApiDiscovery
from yinghuo_conf.api_util.utils import wrap_json
from ..log import logger

# app = FastAPI()
app = APIRouter()
HTTP_Clients = {}

def get_client(api_name: str):
    """get http client

    Args:
        api_name (str): _description_

    Returns:
        _type_: _description_
    """
    if api_name not in HTTP_Clients:
        client = httpx.AsyncClient(timeout=20.0)
        HTTP_Clients[api_name] = client

    return HTTP_Clients[api_name]

@app.post("/serv/{service_group}/{api_id}", tags=["dnn"])
async def serv(service_group:str, api_id: str, request: Request):
    serv_url_str = Conf.get_serv_uri(service_group, api_id)
    if serv_url_str is None:
        return wrap_json(1, "api_id not found")
    serv_url = httpx.URL(serv_url_str)
    client = get_client(api_id)
    req = client.build_request(
        request.method, serv_url, headers=request.headers.raw, content=request.stream()
    )
    logger.info(f"{request.method} to {serv_url_str}")
    r = await client.send(req, stream=True)
    return StreamingResponse(
        r.aiter_raw(),
        status_code=r.status_code,
        headers=r.headers,
        background=BackgroundTask(r.aclose)
    )
    
@app.post("/service/{service_group}", tags=["dnn"])
async def service(service_group: str, request: Request):
    service_apis = []
    if service_group in Conf.WATCHING_SERVICES:
        service_api_node_dict = Conf.get_services(service_group=service_group)
        for app_api_name, api_nodes in service_api_node_dict[service_group].items():
            for node in api_nodes['nodes']:
                api_node = {}
                api_node['serv_info'] = node['serv_info']
                api_node['api_id'] = app_api_name
                service_apis.append(api_node)
    return service_apis

@app.get("/yh-func-api", tags=["dnn"])
async def get_service(request: Request):
    # TODO 结合API管理，过滤能看到的api
    apiWater = ApiDiscovery(
        redis_host=app_settings.global_config.redis.host,
        redis_port=app_settings.global_config.redis.port,
        prefix_key='yh-func-api')
    data = apiWater.list_nodes()
    return wrap_json(data)

@app.post("/yh-func-api/{api_group}/{api_id}", tags=["dnn"])
async def serv_func_api(api_group:str, api_id:str, request: Request):
    logger.info("got api_group: %s, api_id: %s" % (api_group, api_id))
    
    # TODO 结合API管理，检查是否具有权限
    
    apiWater = ApiDiscovery(
        redis_host=app_settings.global_config.redis.host,
        redis_port=app_settings.global_config.redis.port,
        prefix_key='yh-func-api')
    nodes = apiWater.get_nodes(api_group, api_id)
    if nodes is None or len(nodes) == 0:
        return wrap_json(status=501, statusText=f'api not availabe: {api_group}:{api_id}')
    
    node = _.sample(nodes)
    serv_uri = node['serv_uri']
    logger.info(f"got serv_uri: {serv_uri}")
    if serv_uri is None:
        return wrap_json(1, "api_id not found")
    serv_url = httpx.URL(serv_uri)
    client = get_client(api_id)
    
    user_id = CTX_USER_ID.get("user_id")
    root_dir = os.path.join(settings.YH_USER_DATA_ROOT)
    headers = {'data_root':root_dir, 'user_id': str(user_id)}
    for k, v in request.headers.items():
        headers[k] = v
    req = client.build_request(
        request.method, serv_url, headers=headers, content=request.stream()
    )
    logger.info(f"{request.method} to {serv_uri}")
    r = await client.send(req, stream=True)
    return StreamingResponse(
        r.aiter_raw(),
        status_code=r.status_code,
        headers=r.headers,
        background=BackgroundTask(r.aclose)
    )