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
__date__ = "2024-04-04 甲辰年 二月廿六 清明"

import os
import yaml


def load_api_conf(api_conf_yaml:str, param_map:dict)->dict:
    """load yaml config

    Args:
        api_conf_yaml (str): file name
        param_map (dict): params

    Returns:
        dict: key value from yaml
    """
    assert os.path.exists(api_conf_yaml), f'yaml file {api_conf_yaml} not exists'
    def process_param(kvs):
        for k, v in kvs.items():
            if isinstance(v, str) and v.find("{") > -1:
                kvs[k] = v.format_map(param_map)
            elif isinstance(v, dict):
                process_param(v)
            elif isinstance(v, list):
                for i in range(len(v)):
                    if isinstance(v[i], dict):
                        process_param(v[i])
                    elif isinstance(v, str) and v.contains("{"):
                        v[i] = v.format_map(param_map)
    kvs = yaml.load(open(api_conf_yaml, "rt"), Loader=yaml.FullLoader)
    if isinstance(kvs, list):
        # 多个api配置
        for api_conf in kvs:
            process_param(api_conf)
            api_conf['node_info']['node_name'] = param_map['NODE_NAME']
    else:
        # single api
        process_param(kvs)
        kvs['node_info']['node_name'] = param_map['NODE_NAME']
    
    return kvs