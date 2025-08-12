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
API Models
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-04-02"

from typing import Generic, TypeVar, Optional, Any
from enum import Enum, IntEnum
from pydantic import BaseModel, Field
import pydash

class ToolEnum(IntEnum):
    spanner = 1
    wrench = 2
    
class ImageTypeEnum(str, Enum):
    jpg = 'jpg'
    jpeg = 'jpeg'
    png = 'png'
class ImageDataTypeEnum(str, Enum):
    uri = 'uri'
    base64 = 'base64'
class ImageData(BaseModel):
    image: str
    id: str | None = None
    index: int | None = None
    type: ImageTypeEnum = ImageTypeEnum.jpg
    data_type: ImageDataTypeEnum = ImageDataTypeEnum.uri
    
class Point2D(BaseModel):
    x: float = Field(default=0.0)
    y: float = Field(default=0.0)


class ImageWithParams(BaseModel):
    req: dict | None = None # 原样返回
    image: ImageData
    params: dict[str, Any] | None = None
    
class ImageWithPointsLabels(ImageWithParams):
    point_coords: list[Point2D]
    point_labels: list[int]
    
class BBoxTypeEnum(str, Enum):
    XYXY = 'XYXY' # xmin,ymin,xmax,ymax
    XYWH = 'XYWH' # xmin,ymin,w,h
    CXCYWH = 'CXCYWH' # center x,y

class BBox(BaseModel):
    valType: BBoxTypeEnum = BBoxTypeEnum.XYXY
    val: tuple[float, float, float, float]
    
    def _xyxy(self):
        if self.valType == BBoxTypeEnum.XYXY:
            return pydash.clone_deep(self.val)
        elif self.valType == BBoxTypeEnum.XYWH:
            xmin, ymin, w, h = self.val
            xmax = xmin + w
            ymax = ymin + h
            return (xmin, ymin, xmax, ymax)
        elif self.valType == BBoxTypeEnum.CXCYWH:
            cx, cy, w, h = self.val
            xmin = cx - 0.5 * w
            ymin = cy - 0.5 * h
            xmax = xmin + w
            ymax = ymin + h
            return (xmin, ymin, xmax, ymax)
        else:
            raise ValueError(f'Unsupported box type {self.valType}')
    
    def to_box(self, valType=BBoxTypeEnum.XYXY):
        if valType == self.valType:
            return pydash.clone_deep(self)
        else:
            xyxy = self._xyxy()
            if valType == BBoxTypeEnum.XYXY:
                return BBox(valType=BBoxTypeEnum.XYXY, val=xyxy)
            elif valType == BBoxTypeEnum.XYWH:
                xmin, ymin, xmax, ymax = xyxy
                w = xmax - xmin
                h = ymax - ymin
                return BBox(valType=BBoxTypeEnum.XYWH, val=(xmin, ymin, w, h))
            elif valType == BBoxTypeEnum.CXCYWH:
                xmin, ymin, xmax, ymax = xyxy
                w = xmax - xmin
                h = ymax - ymin
                cx = 0.5 * (xmin + xmax)
                cy = 0.5 * (ymin + ymax)
                return BBox(valType=BBoxTypeEnum.CXCYWH, val=(cx, cy, w, h))
            else:
                raise ValueError(f'Unsupported box type {self.valType} to {valType}')
    
class ImageWithBoxPointsLabels(ImageWithPointsLabels):
    box: BBox | None = None

class _FramePrompt(BaseModel):
    image: ImageData
    point_coords: list[Point2D]
    point_labels: list[int]
    box: BBox | None = None
    text: str | None = None
class VideoPrompts(BaseModel):
    req: dict | None = None # 原样返回
    params: dict[str, Any] | None = None
    prompts: list[_FramePrompt]

class ImageWithTextPrompt(BaseModel):
    req: dict | None = None # 原样返回
    image: ImageData
    text_prompt: str | None = None
    params: dict[str, Any] | None = None

DataT = TypeVar('DataT')
class Response(BaseModel, Generic[DataT]):
    req: dict | None = None # 请求中的req
    data: Optional[DataT] | None = None
    status:int
    statusText:str

class Polygon2DTypeEnum(str, Enum):
    closed = 'closed'
    open = 'open'

class Polygon2D(BaseModel):
    type: Polygon2DTypeEnum = Polygon2DTypeEnum.closed
    points: list[Point2D]
    
    
class RLE(BaseModel):
    # model_config = ConfigDict(strict=True)
    counts: list[int]
    size: tuple[int, int]

class SAMOutput(BaseModel):
    """SAM family model's Output

    Args:
        BaseModel (_type_): _description_
    """
    scores: list[float]
    mask_rles: list[RLE]
    polygons: list[list[Polygon2D]]
    bboxes: list[BBox]
    classes: list[str]
    
