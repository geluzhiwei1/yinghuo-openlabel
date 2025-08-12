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
__date__ = "2024-08-07 甲辰年 七月初四 立秋"

from tortoise import fields

from .base import BaseModel, TimestampMixin


class User(BaseModel, TimestampMixin):
    email = fields.CharField(max_length=255, null=True, description="邮箱", index=True)
    mobile_phone_no = fields.CharField(max_length=128, null=True, description="手机号:+86xxx", index=True)
    password = fields.CharField(max_length=128, null=True, description="密码")
    is_active = fields.BooleanField(default=True, description="是否激活", index=True)
    is_superuser = fields.BooleanField(default=False, description="是否为超级管理员", index=True)
    is_verified = fields.BooleanField(default=False, description="邮箱激活", index=True)
    last_login = fields.DatetimeField(null=True, description="最后登录时间", index=False)

    class Meta:
        table = "user"

    class PydanticMeta:
        # todo
        # computed = ["full_name"]
        ...