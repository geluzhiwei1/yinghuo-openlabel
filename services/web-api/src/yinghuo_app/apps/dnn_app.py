"""
rest api for dnn model inference
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-11-22"

from fastapi import FastAPI, File, UploadFile, Form
from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import StreamingResponse, Response
from starlette.background import BackgroundTask
import httpx
from pydash import _
import os
import json


from ..config import Conf, gConf, settings
from .ctx import CTX_USER_ID
from yinghuo_conf.api_util.api_discovery import ApiDiscovery
from yinghuo_conf.api_util.utils import wrap_json
from ..log import logger
from .dependency import permission_required

# app = FastAPI()
app = APIRouter(dependencies=[permission_required("business:dnn:write")])
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

HOP_HEADERS = frozenset({'host'})

def _filter_headers(headers: dict) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in HOP_HEADERS}

@app.post("/serv/{service_group}/{api_id}", tags=["dnn"])
async def serv(service_group:str, api_id: str, request: Request):
    serv_url_str = Conf.get_serv_uri(service_group, api_id)
    if serv_url_str is None:
        return wrap_json(1, "api_id not found")
    serv_url = httpx.URL(serv_url_str)
    client = get_client(api_id)
    body = await request.body()
    req = client.build_request(
        request.method, serv_url, headers=_filter_headers(dict(request.headers)), content=body
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
        redis_host=gConf['global']['redis']['host'], 
        redis_port=gConf['global']['redis']['port'],
        prefix_key='yh-func-api')
    data = apiWater.list_nodes()
    return wrap_json(data)

@app.post("/yh-func-api/{api_group}/{api_id}", tags=["dnn"])
async def serv_func_api(api_group:str, api_id:str, request: Request):
    logger.info("got api_group: %s, api_id: %s" % (api_group, api_id))
    
    # TODO 结合API管理，检查是否具有权限
    
    apiWater = ApiDiscovery(
        redis_host=gConf['global']['redis']['host'], 
        redis_port=gConf['global']['redis']['port'],
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
    headers = _filter_headers(dict(request.headers))
    headers['data_root'] = root_dir
    headers['user_id'] = str(user_id)
    body = await request.body()
    req = client.build_request(
        request.method, serv_url, headers=headers, content=body
    )
    logger.info(f"{request.method} to {serv_uri}, headers={headers}, body_len={len(body)}")
    r = await client.send(req, stream=True)
    if r.status_code >= 400:
        error_body = await r.aread()
        logger.error(f"upstream {serv_uri} returned {r.status_code}: {error_body[:500]}")
        try:
            detail = json.loads(error_body)
        except Exception:
            detail = error_body.decode(errors='replace')
        return wrap_json(status=r.status_code, statusText=f'模型推理服务异常 ({serv_uri}): {detail}')
    return StreamingResponse(
        r.aiter_raw(),
        status_code=r.status_code,
        headers=r.headers,
        background=BackgroundTask(r.aclose)
    )