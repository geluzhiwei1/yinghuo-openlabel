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
from datetime import datetime
from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, EmailStr, Field


class RoleEnum(Enum):
    WORKER = "worker"
    MANAGER = "manager"
    ADMIN = "admin"


class UserJobAuth(Enum):
    """一个user id和一个job id的权限关系

    Args:
        Enum (_type_): _description_
    """

    FORBIDDEN = 1
    OWNER = 2
    COLLABORATOR = 3
    DEPT_ROLE_ANNO = 4
    DEPT_ROLE_MANAGE = 5


class BaseUser(BaseModel):
    id: int
    email: Optional[EmailStr] = None
    mobile_phone_no: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    last_login: Optional[datetime]
    roles: Optional[list] = []


class UserCreate(BaseModel):
    email: Optional[EmailStr] = Field(None, example="admin@qq.com", lowercase=True)
    mobile_phone_no: Optional[str] = None
    password: str = Field(example="123456")
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False


class UserUpdate(BaseModel):
    id: int
    email: Optional[EmailStr] = Field(None, example="admin@qq.com", lowercase=True)
    mobile_phone_no: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False


class UpdatePassword(BaseModel):
    old_password: str = Field(description="旧密码")
    new_password: str = Field(description="新密码")

class UpdateAccount(BaseModel):
    email: Optional[EmailStr] = Field(None, example="admin@qq.com", lowercase=True)
    mobile_phone_no: Optional[str] = None
    
class UserRegister(BaseModel):
    email: Optional[EmailStr] = Field(None, example="admin@qq.com", lowercase=True)
    mobile_phone_no: Optional[str] = None
    password: Optional[str] = Field(None, example="123456")
    is_active: Optional[bool] = True

class UserRegister2(BaseModel):
    mobile_phone_no: Optional[str] = None
    password: Optional[str] = Field(None, example="123456")
    is_active: Optional[bool] = True