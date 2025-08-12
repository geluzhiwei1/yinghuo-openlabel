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
from pydantic import BaseModel, Field
from typing import Optional

class AdminConfig(BaseModel):
    user: str
    password: str

class LogConfig(BaseModel):
    level: str
    root_dir: str

class WeightsConfig(BaseModel):
    root_dir: str
    http_server: str

class DatasConfig(BaseModel):
    YH_USER_DATA_ROOT: str

class RedisConfig(BaseModel):
    host: str
    port: int
    uri: str

class MongoConfig(BaseModel):
    uri: str
    db: str

class PostgresConfig(BaseModel):
    host: str
    port: int
    username: str
    password: str
    database: str
    uri: str
    tortoise_uri: str

class SmtpConfig(BaseModel):
    host: str
    port: int
    user: str
    password: str
    from_email: str

class GlobalConfig(BaseModel):
    mode: str
    log: LogConfig
    datas: DatasConfig
    redis: RedisConfig
    mongodb: MongoConfig
    postgres: PostgresConfig
    smtp: Optional[SmtpConfig] = None

class AppConfig(BaseModel):
    admin: AdminConfig
    global_config: GlobalConfig = Field(..., alias="global")