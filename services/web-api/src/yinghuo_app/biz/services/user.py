from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi.exceptions import HTTPException
import os
from redis import asyncio as aioredis

from ...log import logger
from ...config import settings
from yinghuo_app.biz.services.crud import CRUDBase
from yinghuo_app.biz.db.models import User
from yinghuo_app.dto.login import CredentialsSchema
from yinghuo_app.dto.users import UpdateAccount, UserCreate, UserRegister2, UserUpdate
from yinghuo_app.utils.password import get_password_hash, verify_password
from .role import role_service


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ip_fail_key(ip: str) -> str:
    return f"login:fail:ip:{ip}"


def _user_fail_key(user_id: int) -> str:
    return f"login:fail:user:{user_id}"


class UserService(CRUDBase[User, UserCreate, UserUpdate]):
    def __init__(self):
        super().__init__(model=User)

    async def get_by_email(self, email: str) -> Optional[User]:
        return await self.model.filter(email=email, deleted_at__isnull=True).first()

    async def get_by_mobile(self, mobile_phone_no: str) -> Optional[User]:
        return await self.model.filter(mobile_phone_no=mobile_phone_no, deleted_at__isnull=True).first()

    async def get_by_username(self, email: str) -> Optional[User]:
        return await self.get_by_email(email)

    async def create_user(self, obj_in: UserCreate) -> User:
        obj_in.password = get_password_hash(password=obj_in.password)
        obj = await self.create(obj_in)
        return obj

    async def update_last_login(self, id: int) -> None:
        user = await self.model.get(id=id)
        user.last_login = datetime.now()
        await user.save(update_fields=["last_login"])

    # —— 登录限频 / 失败锁定 ——————————————————————————

    async def _check_ip_throttle(self, redis: aioredis.Redis, ip: str | None) -> None:
        """同一 IP 在窗口内失败次数限制,防止同一来源撞库。"""
        if not ip:
            return
        key = _ip_fail_key(ip)
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, settings.LOGIN_FAIL_WINDOW_SECONDS)
        if count > settings.LOGIN_FAIL_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=429, detail="该 IP 登录失败次数过多,请稍后再试"
            )

    async def _record_user_fail(self, redis: aioredis.Redis, user: User) -> None:
        """累计 user.failed_login_count,达到阈值写入 locked_until。"""
        from .audit import audit_service  # 延迟导入避免循环
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= settings.LOGIN_FAIL_MAX_ATTEMPTS:
            user.locked_until = _utcnow() + timedelta(minutes=settings.LOGIN_LOCK_MINUTES)
            user.failed_login_count = 0  # 进入锁定,清零;解锁后重新计数
            logger.warning(f"user {user.id} locked until {user.locked_until} due to login fails")
            await audit_service.log(
                action="user.locked",
                actor_id=user.id,
                resource_type="user",
                resource_id=str(user.id),
                detail={"locked_until": user.locked_until.isoformat()},
            )
        else:
            await audit_service.log(
                action="user.login_failed",
                actor_id=user.id,
                resource_type="user",
                resource_id=str(user.id),
                detail={"failed_count": user.failed_login_count},
            )
        await user.save(update_fields=["failed_login_count", "locked_until"])

    async def reset_login_fail_count(self, user_id: int, redis: aioredis.Redis) -> None:
        """登录成功后调用,清零计数。"""
        user = await self.model.get(id=user_id)
        if user.failed_login_count or user.locked_until:
            user.failed_login_count = 0
            user.locked_until = None
            await user.save(update_fields=["failed_login_count", "locked_until"])

    # —————————————————————————————————————————————————

    async def authenticate(
        self,
        credentials: CredentialsSchema,
        *,
        redis: aioredis.Redis | None = None,
        client_ip: str | None = None,
    ) -> Optional["User"]:
        """校验凭据。失败累加计数,达到阈值锁定;成功由上层调用 reset_login_fail_count。"""
        if redis is not None:
            await self._check_ip_throttle(redis, client_ip)

        user: Optional[User] = None
        if credentials.accountType == '1':
            # 手机号登录(密码或短信验证码)
            user = await self.get_by_mobile(credentials.mobile_phone_no)
        elif credentials.accountType == '2':
            # 邮箱登录
            user = await self.get_by_email(credentials.email)

        # 用户不存在也记一次 IP 失败(防止枚举探测),但不写 user.failed_login_count
        if not user:
            if redis is not None and client_ip:
                # IP 计数已在 _check_ip_throttle 中 incr,这里仅返回错误
                pass
            raise HTTPException(status_code=501, detail="账号或密码错误！")

        # 锁定检查
        if user.locked_until and user.locked_until > _utcnow():
            remaining_min = int((user.locked_until - _utcnow()).total_seconds() // 60) + 1
            raise HTTPException(
                status_code=423, detail=f"账号已锁定,请约 {remaining_min} 分钟后重试"
            )
        # 锁定已过期,清掉 locked_until(失败计数已在锁定写入时清零)
        if user.locked_until:
            user.locked_until = None
            await user.save(update_fields=["locked_until"])

        verified = True
        if credentials.accountType == '1' and credentials.useMobileMsgCode:
            pass  # 验证码已在路由层校验
        else:
            verified = verify_password(credentials.password, user.password)

        if not verified:
            if redis is not None:
                await self._record_user_fail(redis, user)
            raise HTTPException(status_code=502, detail="账号或密码错误!")

        if not user.is_active:
            raise HTTPException(status_code=503, detail="用户已被禁用。")
        return user

    async def update_roles(self, user: User, role_ids: List[int]) -> None:
        pass

    async def reset_password(self, user_id: int, new_password: str, *, force: bool = False):
        user_obj = await self.get(id=user_id)
        if user_obj.is_superuser and not force:
            raise HTTPException(status_code=403, detail="不允许重置超级管理员密码")
        user_obj.password = get_password_hash(password=new_password)
        user_obj.password_changed_at = _utcnow()
        user_obj.failed_login_count = 0
        user_obj.locked_until = None
        await user_obj.save(update_fields=[
            "password", "password_changed_at", "failed_login_count", "locked_until",
        ])

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
        user.password_changed_at = _utcnow()
        await user.save(update_fields=["password", "password_changed_at"])

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
