"""
Config 
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-25"

from datetime import datetime
import os
from typing import Any
from dotenv import dotenv_values
from pymongo import MongoClient
import os
import typing
import logging

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from yinghuo_conf.config import gConf, BaseServConfig


logging.getLogger('pymongo').setLevel(logging.WARNING)


class Config(BaseServConfig):
    
    WATCHING_SERVICES = ["det.lidar.3d"]
    FILE_PATH = "/api/v1/b/file/"

    def __init__(self):
        self.PACKAGE_ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
        super().__init__(
                module_name='serv-mmdet',
                app_root_dir=os.path.join(self.PACKAGE_ROOT_DIR, '../../')
            )

        mongodb_client = MongoClient(gConf['global']['mongodb']['uri'])
        db = mongodb_client[gConf['global']['mongodb']['db']]
        # self.MG_label_semantic2d = db['label_semantic2d']
        # self.MG_label_aabb2d = db['label_aabb2d']
        self.MG_ANNO_JOB_PERFORM = db['anno_job']
        self.MG_COUNTER = db['counter']
        self.MG_COLLECTION = {
            'semantic2d': db['label_semantic2d'],
            'objectBBox2d': db['label_object_bbox2d'],
            'objectRBBox2d': db['label_object_rbbox2d'],
            'trafficSignal2d': db['label_traffic_signal2d'],
            'trafficSign2d': db['label_traffic_sign2d'],
            'parkingSlot2d': db['label_parking_slot2d'],
            'trafficLine2d': db['label_traffic_line2d'],
            'objectDet3dLidar': db['label_object3d_lidar'],
            # 3d
            'objectBBox3d': db['label_object3d_bbox'],
            'pcSemantic3d': db['label_setamic3d_pc'],
            'pcPolyline3d': db['label_polyline3d_pc'],
            
            # 图像自身的标注信息
            'imageLabel': db['label_image'],
            # 序列的标注信息
            'seqLabel': db['label_seq'],
            
            # funcs 相关
            'funcs': db['funcs'],
            'flows': db['flows'],
            
            # 视频事件的标注信息
            'videoEvents': db['label_video_event'],
        }
        
        # 存储数据元信息
        self.MG_DATA_SEQ_META = db['data_seq_meta']
        self.MG_DATA_STREAM_META = db['data_stream_meta']
        self.MG_DATA_ANNO_SPEC = db['user_anno_spec']

        # migrations/data/ 数据迁移的应用记录
        self.MG_DATA_MIGRATION = db['data_migration']
        
        self.MG_USER_DEPTS = db['user_depts']
        self.MG_USER_ROLES = db['user_roles']
        self.MG_USER_TEAM = db['user_team']
        self.MG_USER_PROFILE = db['user_profile']

        # Stage 6:新版(Unit-based)标签数据集合
        self.MG_UNIT_LABEL = db['unit_label']

        # 保存成文件的anno
        self.TO_FILE_ANNO = set(
            [
                'semantic2d',
                'pcSemantic3d',
                'pcPolyline3d',
            ]
        )

class Settings(BaseSettings):
    """运行期配置。敏感项必须通过环境变量注入,缺失即拒启动。

    环境变量前缀 YH_,例如:
      YH_JWT_SECRET=$(openssl rand -hex 32)
      YH_CORS_ORIGINS=https://a.example.com,https://b.example.com
    """

    model_config = SettingsConfigDict(
        env_prefix='YH_',
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False,
    )

    VERSION: str = "dev"
    GIT_SHA: str = ""
    CHANNEL: str = "dev"
    APP_TITLE: str = "Yinghuo Label Platform"
    PROJECT_NAME: str = "Yinghuo"
    APP_DESCRIPTION: str = "Data annotation platform"

    # CORS。生产必须显式列出可信源;逗号分隔。
    # 例:YH_CORS_ORIGINS=https://a.example.com,https://b.example.com
    CORS_ORIGINS: str = "http://localhost:5173"
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: str = "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    CORS_ALLOW_HEADERS: str = "*"

    DEBUG: bool = False

    # —— JWT ——
    # 必填,无默认值。openssl rand -hex 32 生成,长度 >= 32
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    # access/refresh token 黑名单 key 前缀
    JWT_REDIS_PREFIX: str = "jwt:jti:revoked"

    # —— 登录安全 ——
    LOGIN_FAIL_WINDOW_SECONDS: int = 300        # 5 分钟窗口
    LOGIN_FAIL_MAX_ATTEMPTS: int = 5            # 窗口内最多失败次数
    LOGIN_LOCK_MINUTES: int = 15                # 触发阈值后锁定时长
    PASSWORD_MIN_LENGTH: int = 10
    PASSWORD_REQUIRE_LETTER_AND_DIGIT: bool = True

    # —— 验证码限频 ——
    # 同 IP 滑动窗口
    CAPTCHA_IP_WINDOW_SECONDS: int = 60
    CAPTCHA_IP_MAX: int = 10
    # 同目标(邮箱/手机号)短窗口 + 每日上限
    CODE_TARGET_WINDOW_SECONDS: int = 60
    CODE_TARGET_MAX: int = 1                    # 60 秒内每目标 1 条
    CODE_DAILY_WINDOW_SECONDS: int = 86400
    CODE_DAILY_MAX: int = 10                    # 每日每目标 10 条

    # —— 平台面 BFF ——
    # IP 白名单,逗号分隔。仅这些 IP 可访问 /api/v1/p/*。
    # 生产必填,缺省为空时模型校验直接拒启动。
    PLATFORM_ALLOWLIST: str = ""
    # 平台账号 access token TTL,默认 2 小时(平台会话比业务会话长)
    PLATFORM_TOKEN_TTL_MINUTES: int = 120
    # 平台登录横幅(告知运维条款 / 法律提示)
    PLATFORM_LOGIN_NOTICE: str = "本入口仅授权平台运维人员使用,所有操作均被审计。"

    TORTOISE_ORM: dict = {
        "connections": {
            "default": {
                "engine": "tortoise.backends.asyncpg",
                "credentials": {
                    "database": gConf['global']['postgres']['database'],
                    "host": gConf['global']['postgres']['host'],
                    "password": gConf['global']['postgres']['password'],
                    "port": int(gConf['global']['postgres']['port']),
                    "user": gConf['global']['postgres']['username'],
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
    YH_USER_DATA_ROOT: str = gConf['global']['datas'].get('YH_USER_DATA_ROOT', '/data1/prods/yh-users')

    @field_validator('CORS_ORIGINS', 'CORS_ALLOW_METHODS', 'CORS_ALLOW_HEADERS', mode='before')
    @classmethod
    def _split_csv(cls, v):
        """(保留兼容)若通过 init_kwargs 传 list 也能接受。"""
        return v

    @property
    def cors_origins_list(self) -> typing.List[str]:
        return [x.strip() for x in self.CORS_ORIGINS.split(',') if x.strip()]

    @property
    def cors_methods_list(self) -> typing.List[str]:
        items = [x.strip() for x in self.CORS_ALLOW_METHODS.split(',') if x.strip()]
        return items or ["*"]

    @property
    def cors_headers_list(self) -> typing.List[str]:
        items = [x.strip() for x in self.CORS_ALLOW_HEADERS.split(',') if x.strip()]
        return items or ["*"]

    @property
    def platform_allowlist_list(self) -> typing.List[str]:
        return [x.strip() for x in self.PLATFORM_ALLOWLIST.split(',') if x.strip()]

    @model_validator(mode='after')
    def _validate_security(self) -> "Settings":
        if not self.JWT_SECRET or len(self.JWT_SECRET) < 32:
            raise ValueError(
                "YH_JWT_SECRET 必须设置且长度 >= 32。生成:openssl rand -hex 32"
            )
        if "*" in self.cors_origins_list and self.CORS_ALLOW_CREDENTIALS:
            raise ValueError(
                "CORS_ORIGINS 含 '*' 时不能开启 CORS_ALLOW_CREDENTIALS;请显式列出可信源"
            )
        if self.JWT_ACCESS_EXPIRE_MINUTES > 120:
            raise ValueError("JWT_ACCESS_EXPIRE_MINUTES 上限 120 分钟(2 小时)")
        if self.LOGIN_FAIL_MAX_ATTEMPTS < 1:
            raise ValueError("LOGIN_FAIL_MAX_ATTEMPTS 必须 >= 1")
        if 0 < self.PLATFORM_TOKEN_TTL_MINUTES > 480:
            raise ValueError("PLATFORM_TOKEN_TTL_MINUTES 应在 1-480 分钟之间")
        return self


Conf: Config = Config()
settings = Settings()