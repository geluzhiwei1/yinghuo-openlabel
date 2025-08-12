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
from enum import Enum
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List, Any
import os
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
import json
import logging
from glob import glob
import pathlib
from pydash import _
from yinghuo_app.dto.resource import ResourceType
from yinghuo_conf import Conf
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any, Annotated

class DataAuthority(BaseModel):
    # 至少有一个owner，数据和label的所有权限
    owners: List[int]
    # 可以设置一个或多个collaborator，有label的权限；不可以删除、修改数据本身
    collaborators: Optional[List[int]] = None
    dept: Optional[str] = None

def get_utc_now():
    return datetime.now(timezone.utc)


class CollectionBase(BaseModel):
    _id: str = None
    created_time: datetime = Field(default_factory=get_utc_now)
    updated_time: datetime = Field(default_factory=get_utc_now)
    deleted_time: Optional[datetime] = None  # 默认为None，可以在删除时设置
    creater: int = None
    is_deleted: Annotated[bool, Field(default=False, description="是否被删除")]
    authority: Optional[DataAuthority] = None


class Pager(BaseModel):
    page: int = Field(default=1, gt=0)
    page_size: int = Field(default=10, gt=0, lt=100)
    total: int | None = 0


# class JobCollaborator(CollectionBase):
#     # email: EmailStr
#     # uuid: str
#     is_owner: False


class Data(BaseModel):
    clip_key: Optional[str]
    format: Optional[str]
    root_dir: Optional[str]
    seq: Optional[str]
    # streams:Optional[list]

    class Config:
        extra = "allow"
        
class LabelSpec(BaseModel):
    domain: Dict[str, str]
    mission: Dict[str, str]
    taxonomy: Dict[str, str]
    data: Optional[Data]

    class Config:
        extra = "allow"

class JobStatus(BaseModel):
    class Status(Enum):
        NEW_JOB = '待标注'
        LABELING = '标注中'
        TO_REVIEW = '待审核'
        REVIEW_FAILED = '待修正'
        REVIEW_SUCESS = '已完成'
        CANCELD = '已取消'
        LOCKED = '已锁定'
        ARCHIVED = '已归档'
    status: str 
    update_time: datetime = None
    user_id: Optional[int] = None
    desc: Optional[str] = None


class AnnoJob(CollectionBase):
    """标注任务执行

    Args:
        CollectionBase (_type_): _description_
    """
    auto_job_id: Optional[int]
    data_clip_id: Optional[int]
    desc: Optional[str]
    id: Optional[int]
    label_spec: Optional[LabelSpec]
    name: Optional[str]
    priority: Optional[int]
    taxonomy_key: Optional[str]
    type: Optional[int]
    version: Optional[str]
    current_status: Optional[JobStatus] = None
    status_history: Optional[list[JobStatus]] = None

    class Config:
        extra = "allow"


class JobPerform(BaseModel):
    seq: str | None = None
    stream: str | None = None
    uuid: str | None = None
    frame: int
    coordinate_system: str
    mission: str
    data_format: str
    data_source: str
    domain: str
    taxonomy: dict | None = None

    class Config:
        extra = "allow"


class UserRoles(CollectionBase):
    label: Annotated[str, Field(max_length=100, min_length=1, description="名称", example="标注员")]
    desc: Optional[Annotated[str, Field(default='', max_length=1000, description="备注", example="")]] = None
    is_system: Optional[bool] = False
    # TODO 权限

class UserTeamAgreement(BaseModel):
    # 是否已签署
    is_signed: Optional[bool] = False
    sign_time: datetime = None

class UserTeamInvitation(BaseModel):
    # 邀请时间
    invite_time: datetime = None

class UserTeam(CollectionBase):
    """_summary_
    Args:
        CollectionBase (_type_): _description_
    """
    email: Annotated[EmailStr, Field(max_length=100, min_length=1, description="邮箱", example="xx@yy.zz")]
    user_id: Optional[int] = 0
    is_registered: Optional[bool] = False
    enabled: Optional[bool] = True
    invitation: Optional[UserTeamInvitation] = None
    agreement: Optional[UserTeamAgreement] = None
    roles: list = []
    dept: Optional[str] = None
    class Config:
        extra = "allow"

class UserResource(CollectionBase):
    resources: list[str]
    # title: Optional[str] = None
    # index: Optional[str] = None
    # icon: Optional[str] = None
    # order: Optional[int] = 0
    # parent_id: Optional[str] = ''
    # type: ResourceType = ResourceType.MENU
    # desc: Optional[Annotated[str, Field(max_length=1000, description="备注", example="主菜单")]]
    # class Config:
    #     extra = "allow"

    
class UserProfile(CollectionBase):
    max_job_count: Optional[int] = 15