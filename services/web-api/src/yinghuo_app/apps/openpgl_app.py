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
rest api
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-03-27"

import logging
from fastapi import APIRouter, Request
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles
import pydash as _

from yinghuo_conf.api_util.utils import wrap_json
from yinghuo_conf import Conf
from openlabel import OpenLabel
from ..biz.db.collection import JobPerform

app = APIRouter()

@app.get("/domains", summary="查询domain列表", tags=["openlabel"])
async def get_domain_list():
    domains = OpenLabel.available_domains()
    return wrap_json(domains)

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
    logging.error(f"job_perform: {job_perform}")
    taxonomy_key = _.get(job_perform, 'taxonomy', "")
    domain_key = _.get(job_perform, 'domain', "")
    
    if domain_key == "":
        specs = []
        domains = OpenLabel.available_domains()
        for d in domains:
            logging.info(f"domain: {d['key']}")
            js = OpenLabel.available_taxonomy(d['key'])
            logging.info(f"domain: {d['key']}, taxonomy: {js}")
            specs += js
        return wrap_json(specs)
    else:
        # find one
        j = OpenLabel.from_taxonomy_key(taxonomy_key, domain_key)
        return wrap_json([j.openlabel()])