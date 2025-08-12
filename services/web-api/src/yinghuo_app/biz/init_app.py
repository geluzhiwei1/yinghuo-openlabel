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
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-09-24"

from yinghuo_conf import Conf
from yinghuo_conf.loader import app_settings
from ..log import logger
from .services.user import user_service
from yinghuo_app.dto.users import UserCreate, UserUpdate

async def init_user_admin():
    logger.info("init admin user")
    admin_user = app_settings.admin.user
    admin_passwd = app_settings.admin.password
    
    exist_user = await user_service.get_by_username(admin_user)
    if exist_user:
        logger.info("admin user already exists")
        return
    
    new_usser = await user_service.create_user(UserCreate(
        email=admin_user,
        password=admin_passwd,
        is_superuser=True
    ))
    logger.info("create admin user")
    logger.info(f"Created admin user: {new_usser.email}")

async def init_mongo_indexes():
    logger.info("init mongo indexes")
    
    db = Conf.MG_USER_TEAM.database
    try:
        await db.command('ping')
    except Exception as e:
        logger.info(f"ping: {e}")
        
    # user_team
    collection = Conf.MG_USER_TEAM
    try:
        indexes = await collection.list_indexes().to_list(length=None)
        index_exists = any(
            index for index in indexes
            if (
                index['key'] == [('creater', 1), ('email', 1)] and
                index.get('unique', False) is True
            )
        )
        if not index_exists:
            logger.info("创建唯一索引creater,email")
            await collection.create_index([("creater", 1), ("email", 1)], unique=True)
        else:
            logger.info("唯一索引creater,email已经存在")
    except Exception as e:
        logger.error(f"Error creating user_team indexes: {e}")
    
    # label collection
    index_cols = [('jobConfig.uuid', 1),
                  ('jobConfig.seq', 1),
                  ('jobConfig.stream', 1),
                  ('jobConfig.frame', 1),
                  ('authority.owner', 1)]
    for k, v in Conf.MG_COLLECTION.items():
        collection = v
        try:
            indexes = await collection.list_indexes().to_list(length=None)
            index_exists = any(
                index for index in indexes
                if (
                    index['key'] == index_cols and
                    index.get('unique', False) is True
                )
            )
            if not index_exists:
                logger.info(f"创建{k}的唯一索引")
                await collection.create_index(index_cols, unique=True)
            else:
                logger.info(f"{k}的唯一索引存在")
        except Exception as e:
            logger.error(f"Error creating indexes for {k}: {e}")
