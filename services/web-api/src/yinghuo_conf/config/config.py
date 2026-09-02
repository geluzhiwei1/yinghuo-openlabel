"""
Global Config
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-04-04 甲辰年 二月廿六 清明"

import os
import yaml
from dotenv import dotenv_values

from ..api_util.api_conf import load_api_conf


class GlobalConfig:

    def __init__(self):

        # 依次加载，只加载一个
        conf_files = [
            os.environ.get('YH_CONFIG_FILE', ''),
            "./yinghuo.yaml"
        ]

        finded = False
        for _file in conf_files:
            if '' != _file and os.path.exists(_file):
                print(f'Loading global config file from {_file}')
                self.load_yaml(_file)
                finded = True
                break

        if not finded:
            raise Exception(
                f'Global config file not found in {conf_files}, use export YH_CONFIG_FILE=xxx.yaml set your config')

    def load_yaml(self, _file):
        self.kvs = yaml.load(
            open(_file, 'rt', encoding='utf-8'), Loader=yaml.FullLoader)
        for k, v in self.kvs.items():
            print(f"key={k}, value={v}")

    def __getitem__(self, item):
        return self.kvs[item]


gConf: GlobalConfig = GlobalConfig()


class BaseServConfig(object):
    def __init__(self, module_name: str = None,
                 app_root_dir: str = None
                 ):
        self.PY_MODULE_NAME = module_name
        self.APP_ROOT_DIR = app_root_dir
        self.WEIGHTS_ROOT_DIR = gConf['global']['weights']['root_dir']

        self.SERV_SERVER_IP = '192.168.3.158'
        self.SERV_SERVER_PORT = 7000
        self.SERV_ROOT_PATH = "/"

        def load_env(env_file: str):
            print(f"Load env file from {env_file}")
            envs = dotenv_values(env_file)
            for k, v in envs.items():
                setattr(self, k, v)
                print(f"{k} = {v}")
        env_file = ".env"
        if os.path.exists(env_file):
            load_env(env_file)

    def api_conf(self, api_conf_yaml:str):
        """加载yaml

        Args:
            api_conf_yaml (str): api conf

        Returns:
            _type_: _description_
        """
        param_map = {
            'APP_ROOT_DIR': self.APP_ROOT_DIR,
            'WEIGHTS_ROOT_DIR': self.WEIGHTS_ROOT_DIR,
            'NODE_NAME': f'{self.SERV_SERVER_IP}-{self.SERV_SERVER_PORT}'
        }
        kvs = load_api_conf(api_conf_yaml,
                            param_map=param_map)

        return kvs