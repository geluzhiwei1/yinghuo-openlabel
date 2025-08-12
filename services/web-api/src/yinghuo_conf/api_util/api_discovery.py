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
api conf
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-04-05 甲辰年 二月廿七"

import redis
import time
import json
import psutil
import socket
import platform
import datetime
import sys
import distro

class ApiDiscovery:
    """
        {prefix_key}:{api_group}:{api_id}:nodes:{node_name}
        {prefix_key}:{api_group}:{api_id}:info
    """
    def __init__(self,
                 redis_host='localhost', redis_port=6379, redis_db=0, redis_auth=None, ttl=-1, 
                 prefix_key='discovered:'):
        self.prefix_key = prefix_key
        self.ttl = ttl
        self.redis = redis.StrictRedis(host=redis_host, port=redis_port, db=redis_db, password=redis_auth, decode_responses=True)

    def build_key_api(self, api_group, api_id):
        key = '{}:{}:{}'.format(self.prefix_key, api_group, api_id)
        return key
    
    def build_key_node(self, api_group, api_id, node_name):
        node_key = '{}:{}:{}:{}:{}'.format(self.prefix_key, api_group, api_id, 'nodes', node_name)
        return node_key

    def register_api(self, api_group, api_id, serv_info:dict={}):
        info = serv_info
        key = self.build_key_api(api_group, api_id)
        # self.redis.hmset(f'{key}:info', info)
        self.redis.setex(f'{key}:info', self.ttl, json.dumps(info))
        return info
    
    def unregister_api(self, api_group, api_id):
        """删除api下所有的key
        Args:
            api_group (_type_): _description_
            api_id (_type_): _description_

        Returns:
            _type_: _description_
        """
        key = self.build_key_api(api_group, api_id)
        for n in self.redis.scan_iter(f'{key}:*'):
            self.redis.delete(n)

    def register_node(self, api_group, api_id, node_name, node_info:dict = None):        
        # node system info
        info = {}
        ip = []
        for name,iface in psutil.net_if_addrs().items():
            for obj in iface:
                if obj.family == 2:
                    ip.append(obj.address)
        info['ip'] = ','.join(ip)
        info['os'] = platform.system()
        if info['os'] == 'Linux':
            info['platform'] = '{} ({})'.format(platform.platform(), '-'.join(distro.linux_distribution()))
        else:
            info['platform'] = platform.platform()
        info['arch'] = platform.architecture()[0]
        info['cpu_count'] = psutil.cpu_count()
        info['memory'] = int(psutil.virtual_memory().total) / 1048576
        info['last_boot'] = datetime.datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")
    
        node_info['system'] = info
        node_key = self.build_key_node(api_group, api_id, node_name)
        self.redis.setex(f'{node_key}:info', self.ttl, json.dumps(node_info))
            
    def unregister_node(self, api_group, api_id, node_name):
        node_key = self.build_key_node(api_group, api_id, node_name)
        for n in self.redis.scan_iter(f'{node_key}:*'):
            self.redis.delete(n)
        return node_key

    def get_api_info(self, api_group, api_id):
        key = self.build_key_api(api_group, api_id)
        v = self.redis.get(f'{key}:info')
        if v is not None:
            return json.loads(v)
        return None
    
    def get_node_info(self, api_group, api_id, node_name):
        key = self.build_key_node(api_group, api_id, node_name)
        v = self.redis.get(f'{key}:info')
        if v is not None:
            return json.loads(v)
        return None
    
    def get_nodes(self, api_group, api_id):
        key = '{}:{}:{}:{}:{}'.format(self.prefix_key, api_group, api_id, 'nodes', '*')
        nodes = []
        for node in self.redis.scan_iter(key):
            if node.endswith(':info'):
                v = self.redis.get(node)
                if v is not None:
                    kvs = json.loads(v)
                    nodes.append(kvs)
        return nodes

    def list_apis(self, api_group=None):
        """列出所有的api

        Args:
            api_group (_type_, optional): _description_. Defaults to None.

        Returns:
            _type_: [(api_group, api), ...]
        """
        scan = []
        apis = []
        
        # all group's
        key = '{}:{}'.format(self.prefix_key, '*')
        if api_group:
            # api_group's
            key = '{}:{}:*'.format(self.prefix_key, api_group)
        
        for s in self.redis.scan_iter(key):
            scan.append(s)
            
        unique_apis = set()
        for i in scan:
            x = i.split(':')
            # unique api
            ua = '{}:{}'.format(x[1], x[2])
            if ua not in unique_apis:
                unique_apis.add(ua)
                apis.append([x[1], x[2]])
        return list(apis)
    
    def list_nodes(self, api_group=None) -> list[tuple[str,str,list[dict]]]:
        """list node list

        Args:
            api_group (_type_, optional): _description_. Defaults to None.

        Returns:
            list[tuple[str,str,list[dict]]]: [(api_group, api_id, [{node_info}]), ...]
        """
        rtn = []
        apis = self.list_apis(api_group=api_group)
        for api_group, api_id in apis:
            nodes = self.get_nodes(api_group, api_id)
            serv_info = self.get_api_info(api_group, api_id)
            rtn.append({
                "api_group": api_group,
                "api_id": api_id,
                "serv_info": serv_info,
                "nodes": nodes
            })
        return rtn

    def list_api_groups(self):
        scan = []
        groups = set()
        for s in self.redis.scan_iter('{}:*'.format(self.prefix_key)):
            scan.append(s)
        for i in scan:
            x = i.split(':')
            groups.add(x[1])
        return list(groups)