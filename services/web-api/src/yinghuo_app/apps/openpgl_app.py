"""
rest api
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-03-27"

from fastapi import APIRouter, Request
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles
import pydash as _

from yinghuo_conf.api_util.utils import wrap_json
from ..config import Conf
from openlabel import OpenLabel
from ..biz.db.collection import JobPerform
from .dependency import permission_required

app = APIRouter(dependencies=[permission_required("business:label:read")])

@app.get("/domains", summary="查询domain列表", tags=["openlabel"])
async def get_domain_list():
    domains = OpenLabel.available_domains()
    return wrap_json(domains)

# @app.get("/taxonomy/{domain_key}", summary="查询可用的taxonomy列表", tags=["openlabel"])
# async def get_taxonomy_list(domain_key: str):
#     return wrap_json(OpenLabel.available_taxonomy(domain_key))

# @app.post("/schema", summary="获取 taxonomy json schema", tags=["openlabel"])
# async def taxonomy_json(job_perform: JobPerform, request: Request):
#     taxonomy_key = job_perform.taxonomy
#     domain_key = job_perform.domain
#     if domain_key is None or domain_key == "":
#         domain_key = "common"
#     j = OpenLabel.from_taxonomy_key(taxonomy_key, domain_key)
#     return wrap_json(j.openlabel())

@app.post("/classes", summary="获取 taxonomy classes", tags=["openlabel"])
async def taxonomy_classes(job_perform: JobPerform, request: Request):
    taxonomy_key = job_perform.taxonomy['key']
    domain_key = job_perform.taxonomy['domain']
    if domain_key is None or domain_key == "":
        domain_key = "common"
    rtn = OpenLabel.from_taxonomy_key(taxonomy_key, domain_key).get_class_names(leaf_node_only=True)
    return wrap_json(rtn)

@app.post("/query", summary="schema", tags=["openlabel"])
async def query(job_perform: dict, request: Request):
    taxonomy_key = _.get(job_perform, 'taxonomy.key', "")
    domain_key = _.get(job_perform, 'taxonomy.domain', "")
    
    if domain_key is None or domain_key == "":
        # fine all
        specs = []
        domains = OpenLabel.available_domains()
        for d in domains:
            js = OpenLabel.available_taxonomy(d['key'])
            specs += js
        return wrap_json(specs)
    else:
        # find one
        j = OpenLabel.from_taxonomy_key(taxonomy_key, domain_key)
        return wrap_json([j.openlabel()])