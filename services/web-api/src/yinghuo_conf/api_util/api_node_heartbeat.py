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
HTTP Service
"""
__author__ = "Zhang Lizhi"
__date__ = "甲辰年二月廿三"

import multiprocessing
import time
import logging

from ..config import Conf
from ..logging import init_logger
init_logger('ApiNodeHeartbeat', 'run.log')

from .api_discovery import ApiDiscovery

class ApiNodeHeartbeat:
    def __init__(self, api_conf:dict):
        
        self.rate = 300
        
        self.api_conf = api_conf
        self.api_group = api_conf['api_group']
        self.api_id = api_conf['api_id']
        self.node_name = self.api_conf['node_info']['node_name']
        
        self.process: multiprocessing.Process = None
        self.running = False
        self.SERVICE = ApiDiscovery(
            redis_host=Conf['global']['redis']['host'],
            redis_port=int(Conf['global']['redis']['port']),
            prefix_key='yh-func-api',
            ttl=self.rate
        )
        
    def start(self):
        self.running = True
        def worker():
            while self.running:
                self.register()
                time.sleep(self.rate - 1)
            
        self.process = multiprocessing.Process(target=worker)
        self.process.start()
    
    def register(self):
        self.SERVICE.register_api(
            self.api_group,
            self.api_id,
            serv_info=self.api_conf['serv_info'])
        self.SERVICE.register_node(
            self.api_group,
            self.api_id,
            self.node_name,
            node_info=self.api_conf['node_info'],
            )
        logging.info(f"{self.node_name} registered")
    
    def unregister(self):
        self.running = False
        self.SERVICE.unregister_node(
            self.api_group,
            self.api_id,
            self.node_name)
        self.SERVICE.unregister_api(
            self.api_group,
            self.api_id
            )
    
    def stop(self):
        self.unregister()
        logging.info(f"{self.node_name} unregistered")
        if self.process:
            try:
                self.process.kill()
            except:
                pass