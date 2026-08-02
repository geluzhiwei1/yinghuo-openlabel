"""
HTTP Service
"""
__author__ = "Zhang Lizhi"
__date__ = "甲辰年二月廿三"

import multiprocessing
import time
import logging

from ..config import gConf
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
            redis_host=gConf['global']['redis']['host'], 
            redis_port=gConf['global']['redis']['port'],
            prefix_key='yh-func-api',
            ttl=self.rate)
        
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