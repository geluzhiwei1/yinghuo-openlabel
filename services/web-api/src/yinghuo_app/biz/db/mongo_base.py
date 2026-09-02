"""MongoDB 文档基类(业务面)。

所有 Mongo 业务文档强制继承 TenantScopedBase:tenant_id / 时间戳 / creator / 软删除 /
data_version(乐观锁)统一存在,避免每个 collection 重复定义。

注意:Motor 未安装,运行期沿用 pymongo 同步客户端;异步路径用 asyncio.to_thread 包装。
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class TenantScopedBase(BaseModel):
    """Mongo 业务文档基类(设计 §4.4)。"""
    tenant_id: str = Field(..., description="所属租户 slug,强制")
    creator: Optional[int] = Field(None, description="创建者 user_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_deleted: bool = False
    data_version: int = Field(0, ge=0, description="乐观锁版本号")


class LabelObject(BaseModel):
    """单个标注对象(通用形态)。
    实际形态按 mission 不同(bbox 4 元组 / 多边形点列 / 3D 框 + rotation 等),
    这里只约定 id 必须存在以便 diff;其它字段走 extra="allow"。
    """
    id: str = Field(..., description="对象 id,diff 时用于匹配")

    class Config:
        extra = "allow"


class LabelPayload(BaseModel):
    """label 数据载荷。objects 是统一的对象列表,diff 按对象 id 比较。"""
    objects: list[LabelObject] = Field(default_factory=list)
    attrs: dict[str, Any] = Field(default_factory=dict, description="帧级附加属性")

    class Config:
        extra = "allow"
