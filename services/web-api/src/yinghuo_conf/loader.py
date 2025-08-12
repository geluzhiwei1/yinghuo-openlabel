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
import os
import re
import yaml
from pydash import get, set_
from dotenv import load_dotenv
from yinghuo_conf.models import AppConfig
from yinghuo_conf.config_def import Config
from pydantic_settings import BaseSettings
import typing

def _replace_env_vars(config: dict):
    for key, value in config.items():
        if isinstance(value, dict):
            _replace_env_vars(value)
        elif isinstance(value, str):
            # 使用正则匹配 ${VAR_NAME} 格式的环境变量，并替换为其实际值（未设置时默认为空字符串）
            def replace_match(match):
                var_name = match.group(1)  # 获取 VAR_NAME 部分
                return os.getenv(var_name, '')  # 获取环境变量，若不存在返回空字符串
            # 正则：\$\{([^}]+)\} 匹配 ${xxx} 中的 xxx
            config[key] = re.sub(r'\$\{([^}]+)\}', replace_match, value)

            

def load_config() -> AppConfig:
    load_dotenv()

    conf_files = [
        os.environ.get('YH_CONFIG_FILE', ''),
        "./config/yinghuo.yaml"
    ]

    config_path = None
    for _file in conf_files:
        if _file and os.path.exists(_file):
            config_path = _file
            break

    if not config_path:
        raise Exception(f'Global config file not found in {conf_files}')

    with open(config_path, 'rt', encoding='utf-8') as f:
        config_dict = yaml.safe_load(f)

    _replace_env_vars(config_dict)

    return AppConfig(**config_dict)

app_settings = load_config()
Conf = Config()
class Settings(BaseSettings):
    VERSION: str = "0.1.0"
    APP_TITLE: str = "Vue FastAPI Admin"
    PROJECT_NAME: str = "Vue FastAPI Admin"
    APP_DESCRIPTION: str = "Description"

    CORS_ORIGINS: typing.List = os.getenv("CORS_ORIGINS", "*").split(",")
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: typing.List = ["*"]
    CORS_ALLOW_HEADERS: typing.List = ["*"]

    DEBUG: bool = False

    # openssl rand -hex 32
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "2c6fdc68daae0777ff11053576bc6838cb71512fa0a654e303ca72e838f22c19")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 5 * 24 * 60
    TORTOISE_ORM: dict = {
        "connections": {
            "default": {
                "engine": "tortoise.backends.asyncpg",
                "credentials": {
                    "database": app_settings.global_config.postgres.database,
                    "host": app_settings.global_config.postgres.host,
                    "password": app_settings.global_config.postgres.password,
                    "port": app_settings.global_config.postgres.port,
                    "user": app_settings.global_config.postgres.username,
                    # "ssl": ctx  # Here we pass in the SSL context
                }
            }
        },
        "apps": {
            "models": {
                "models": ["yinghuo_app.biz.db.models"],
                "default_connection": "default",
            },
        },
        "use_tz": False,
        "timezone": "Asia/Shanghai",
    }
    DATETIME_FORMAT: str = "%Y-%m-%d %H:%M:%S"
    YH_USER_DATA_ROOT:str = app_settings.global_config.datas.YH_USER_DATA_ROOT

settings = Settings()