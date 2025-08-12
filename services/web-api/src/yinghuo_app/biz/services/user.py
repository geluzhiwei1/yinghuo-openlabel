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
from fastapi.exceptions import HTTPException
import os
from ...log import logger
from yinghuo_conf import settings
from yinghuo_app.biz.services.crud import CRUDBase
from yinghuo_app.biz.db.models import User
from yinghuo_app.dto.login import CredentialsSchema
from yinghuo_app.dto.users import UpdateAccount, UserCreate, UserRegister2, UserUpdate
from yinghuo_app.utils.password import get_password_hash, verify_password
from .role import role_service


class UserService(CRUDBase[User, UserCreate, UserUpdate]):
    def __init__(self):
        super().__init__(model=User)

    async def get_by_email(self, email: str) -> Optional[User]:
        return await self.model.filter(email=email).first()
    
    async def get_by_mobile(self, mobile_phone_no: str) -> Optional[User]:
        return await self.model.filter(mobile_phone_no=mobile_phone_no).first()

    async def get_by_username(self, email: str) -> Optional[User]:
        return await self.model.filter(email=email).first()

    async def create_user(self, obj_in: UserCreate) -> User:
        obj_in.password = get_password_hash(password=obj_in.password)
        obj = await self.create(obj_in)
        return obj

    async def update_last_login(self, id: int) -> None:
        user = await self.model.get(id=id)
        user.last_login = datetime.now()
        await user.save()

    async def authenticate(self, credentials: CredentialsSchema) -> Optional["User"]:
        
        user = None
        if credentials.accountType == '1':
            # 手机号登录
            if credentials.useMobileMsgCode:
                # 手机号 + 手机验证码
                user = await self.get_by_mobile(credentials.mobile_phone_no)
            else:
                # 手机号 + 密码
                user = await self.get_by_mobile(credentials.mobile_phone_no)
        elif credentials.accountType == '2':
            # 邮箱登录
            user = await self.model.filter(email=credentials.email).first()
        if not user:
            raise HTTPException(status_code=501, detail="账号或密码错误！")
        
        verified = True
        if credentials.accountType == '1' and credentials.useMobileMsgCode:
            # 不需要校验密码
            pass
        else:
            # 需要校验密码
            verified = verify_password(credentials.password, user.password)
        if not verified:
            raise HTTPException(status_code=502, detail="账号或密码错误!")
        if not user.is_active:
            raise HTTPException(status_code=503, detail="用户已被禁用。")
        return user

    async def update_roles(self, user: User, role_ids: List[int]) -> None:
        pass

    async def reset_password(self, user_id: int, new_password: str):
        user_obj = await self.get(id=user_id)
        if user_obj.is_superuser:
            raise HTTPException(status_code=403, detail="不允许重置超级管理员密码")
        user_obj.password = get_password_hash(password=new_password)
        await user_obj.save()
        
    async def update_password(self, user_id: int, old_password: str, new_password: str):
        user = await self.get(id=user_id)
        if not user:
            raise HTTPException(status_code=400, detail="无效的用户id，请重新登录")
        verified = verify_password(old_password, user.password)
        if not verified:
            raise HTTPException(status_code=400, detail="原密码错误")
        if not user.is_active:
            raise HTTPException(status_code=400, detail="用户已被禁用")
        user.password = get_password_hash(password=new_password)
        await user.save()
        
    async def update_account(self, user_id: int, dto: UpdateAccount):
        user = await self.get(id=user_id)
        if not user:
            raise HTTPException(status_code=400, detail="无效的用户id，请重新登录")
        # TODO 暂时不支持修改邮箱和手机号
        if user.email is None:
            user.email = dto.email
        if user.mobile_phone_no is None:
            user.mobile_phone_no = dto.mobile_phone_no
        await user.save()

    async def process_after_create(self, obj: User) -> None:
        logger.info(f'init datas for user {obj.id}')
        base_dir = os.path.join(settings.YH_USER_DATA_ROOT, str(obj.id))
        os.makedirs(base_dir, exist_ok=True)
        
        # 初始化系统角色
        role_service.init_system_role(obj.id)
        
    async def register_user(self, user_in: UserCreate) -> User:
        new_user = await self.create_user(obj_in=user_in)
        await self.process_after_create(new_user)
        return new_user
    
    async def register_mobile_phone_user(self, user_in: UserRegister2) -> User:
        user_in.password = get_password_hash(password=user_in.password)
        obj = await self.create(user_in)
        return obj

user_service = UserService()
