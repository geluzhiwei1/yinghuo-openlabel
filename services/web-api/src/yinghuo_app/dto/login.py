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
from typing import Optional
from pydantic import BaseModel, Field


class CredentialsSchema(BaseModel):
    username: Optional[str] = Field(None, description="用户名", example="admin")
    email: str = Field(None, description="邮箱", example="admin@admin.com", max_length=100)
    password: str = Field(None, description="密码", example="123456", max_length=32)
    captchaId: Optional[str]
    captchaText: Optional[str]
    mobile_phone_no: Optional[str]
    accountType: Optional[str]
    useMobileMsgCode: Optional[bool] = False

class JWTOut(BaseModel):
    access_token: str
    user_name: str

class JWTPayload(BaseModel):
    user_id: int
    is_superuser: bool
    exp: datetime