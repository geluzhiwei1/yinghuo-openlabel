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
OpenLabel 
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-04-03 甲辰年二月廿五"

from typing import Generic, TypeVar, Optional
from enum import Enum
from pydantic import BaseModel, conlist, Field


ValType = TypeVar('ValType')


class BaseAttributes(BaseModel):
    score: Optional[float] = None
    annotator: Optional[str] = None
    class Config:
        allow_extra: bool = True

class BaseObject(BaseModel):
    """Parent for all objects.
    Args:
        BaseModel (_type_): _description_
    """
    object_id: Optional[str] = Field(
        default=None,
        description="Identifier of the object within the annotation file, known as traking ID"
    )
    object_type: Optional[str] = Field(
        default=None,
        description="Type of the object.")
    object_uuid: str = Field(
        default=None,
        description="UUID of the object, which is unique across different files"
    )
    object_attibutes: object|None = None

class BaseLabel(BaseModel):
    """Parent for all Geometry.
    Args:
        BaseLabel (_type_): _description_
    """
    label_id: Optional[str] = Field(
        default=None,
        description="Identifier of the Geometry within the annotation file, known as traking ID"
    )
    # TODO rename to label_type
    ol_type_: str = Field(
        default=None,
        description="Geometry type of the object."
    )
    label_uuid: str = Field(
        default=None,
        description="UUID of the Geometry, which is unique across different files"
    )
    

class Metadata(BaseModel):
    """This JSON object contains information, that is, metadata, about the annotation file itself.
    """
    file_version: Optional[str] = Field(
        default='0.0.1',
        description="Version number of the OpenLABEL annotation content."
    )
    annotator: Optional[str] = Field(
        default=None,
        description="Name or description of the annotator that created the annotations."
    )
    comment: Optional[str] = Field(
        default=None,
        description="Additional information or description about the annotation content."
    )
    name: Optional[str] = Field(
        default=None,
        description="Name of the OpenLABEL annotation content."
    )
    schema_version: str = "1.0.0"
    tagged_file: Optional[str] = Field(
        default=None,
        description="File name or URI of the data file being tagged."
    )

class Vec(BaseModel):
    class TypeEnum(str, Enum):
        values = 'values'
        range = 'range'
    attributes: object|None = None
    coordinate_system: Optional[str] = Field(
        default=None,
        description="Name of the coordinate system in respect of which this object data is expressed."
    )
    name:Optional[str] = Field(
        default=None,
        description="This is a string encoding the name of this object data. It is used as index inside the corresponding object data pointers."
    )
    type: Optional[TypeEnum] = Field(
        default=None,
        description="This attribute specifies whether the vector shall be considered as a descriptor of individual values or as a definition of a range."
    )
    val: list[float | str] = Field(
        description="The numerical values of the vector (list) of numbers."
    )

class Text(BaseModel):
    """A text.

    Args:
        BaseModel (_type_): _description_
    """
    attributes: object|None = None
    coordinate_system:Optional[str] = Field(
        default=None,
        description="Name of the coordinate system in respect of which this object data is expressed."
    )
    name:Optional[str] = Field(
        default=None,
        description="This is a string encoding the name of this object data. It is used as index inside the corresponding object data pointers."
    )
    type:Optional[str] = Field(
        # default="value",
        default=None,
        description="This attribute specifies how the text shall be considered. The only possible option is as a value."
    )
    val:str = Field(
        description = "The characters of the text."
    )

class Num(BaseModel):
    """A number.

    Args:
        BaseModel (_type_): _description_
    """
    class NumType(str, Enum):
        value = 'value'
        min = 'min'
        max = 'max'
    
    attributes: object|None = None
    coordinate_system:Optional[str] = Field(
        default=None,
        description="Name of the coordinate system in respect of which this object data is expressed."
    )
    name:Optional[str] = Field(
        default=None,
        description="This is a string encoding the name of this object data. It is used as index inside the corresponding object data pointers."
    )
    type:Optional[NumType] = Field(
        default=None,
        description="This attribute specifies whether the number shall be considered as a value, a minimum, or a maximum in its context."
    )
    val:float = Field(
        description = "The numerical value of the number."
    )

class Boolean(BaseModel):
    """A boolean.

    Args:
        BaseModel (_type_): _description_
    """
    attributes: object|None = None
    coordinate_system:Optional[str] = Field(
        default=None,
        description="Name of the coordinate system in respect of which this object data is expressed."
    )
    name:Optional[str] = Field(
        default=None,
        description="This is a string encoding the name of this object data. It is used as index inside the corresponding object data pointers."
    )
    type:Optional[str] = Field(
        default=None,
        description="This attribute specifies how the boolean shall be considered. In this schema the only possible option is as a value."
    )
    val:bool = Field(
        description = "The boolean value."
    )


class BBox(BaseObject, BaseLabel, Generic[ValType]):
    """A 2D bounding box is defined as a 4-dimensional vector [x, y, w, h], where [x, y] is the center of the bounding box and [w, h] represent the width (horizontal, x-coordinate dimension) and height (vertical, y-coordinate dimension), respectively.

    Args:
        BaseModel (_type_): _description_
        Generic (_type_): _description_
    """
    class Attributes(BaseAttributes):
        pass
    class ValTypeEnum(str, Enum):
        XYXY = 'XYXY'
        """ xmin,ymin,xmax,ymax """
        
        XYWH = 'XYWH'
        """ xmin,ymin,w,h """
        
        CXCYWH = 'CXCYWH'
        """ center point , width,height"""
        
    attributes: Optional[Attributes] = None
    val: tuple[ValType, ValType, ValType, ValType] = Field(
        description="The array of 4 values that define the [x, y, w, h] values of the bbox.",
    )
    val_type: ValTypeEnum = Field(
        default=ValTypeEnum.CXCYWH,
        description="The type of the coordinates for the bounding box."
    )
    ol_type_: str = "BBox"
    
class RBBox(BaseObject, BaseLabel,):
    """A 2D rotated bounding box is defined as a 5-dimensional vector [x, y, w, h, alpha], where [x, y] is the center of the bounding box and [w, h] represent the width (horizontal, x-coordinate dimension) and height (vertical, y-coordinate dimension), respectively. The angle alpha, in radians, represents the rotation of the rotated bounding box, and is defined as a right-handed rotation, that is, positive from x to y axes, and with the origin of rotation placed at the center of the bounding box (that is, [x, y]).
    according to https://github.com/open-mmlab/mmrotate/blob/main/docs/en/intro.md
    val   => x_center, y_center, width, height, theta
    theta => in radians,Clockwise 长边 90° 定义法，angle∈[-90°, 90°)，theta∈[-pi / 2, pi / 2) 并且 width > height
    0-------------------> x (0 rad)
    |  A-------------B
    |  |             |
    |  |     box     h
    |  |   angle=0   |
    |  D------w------C
    v
    y (pi/2 rad)

    Args:
        BaseModel (_type_): _description_
        Generic (_type_): _description_
    """
    class Attributes(BaseAttributes):
        pass
    attributes: Optional[Attributes] = None
    val: tuple[float, float, float, float, float] = Field(
        description="The array of 5 values that define the [x, y, w, h, alpha] values of the bbox.",
    )
    ol_type_: str = "RBBox"

CuboidValType = conlist(float, min_length=9, max_length=10)
class BBox3d(BaseObject, BaseLabel):
    """A cuboid or 3D bounding box. It is defined by the position of its center, the rotation in 3D, and its dimensions.

    Args:
        BaseModel (_type_): _description_
        Generic (_type_): _description_
    """
    class Attributes(BaseAttributes):
        class Config:
            allow_extra: bool = True
            
    attributes: Optional[Attributes] = None
    coordinate_system: Optional[str] = Field(
        default=None,
        description="Name of the coordinate system in respect of which this object data is expressed."
    )
    val: CuboidValType | None = Field(
        description="List of values encoding the position, rotation and dimensions. Two options are supported, using 9 or 10 values. If 9 values are used, the format is (x, y, z, rx, ry, rz, sx, sy, sz), where (x, y, z) encodes the position, (rx, ry, rz) encodes the Euler angles that encode the rotation, and (sx, sy, sz) are the dimensions of the cuboid in its object coordinate system. If 10 values are used, then the format is (x, y, z, qx, qy, qz, qw, sx, sy, sz) with the only difference of the rotation values which are the 4 values of a quaternion.",
    )
    ol_type_: str = "BBox3d"

class Image(BaseObject, BaseLabel):
    """An image.

    Args:
        BaseModel (_type_): _description_
    """
    encoding: str = Field(
        default="base64",
        description="This is a string that declares the encoding type of the bytes for this image, for example, \"base64\"."
    )
    mimeType: Optional[str] = Field(
        default="image/png",
        description="This is a string that declares the MIME (multipurpose internet mail extensions) of the image, for example, \"image/gif\"."
    )
    val:str = Field(
        description="A string with the encoded bytes of this image."
    )
    
class Mask2d(Image):
    class Attributes(BaseAttributes):
        ltwh: Optional[list[float]] = Field(
            default=...,
            description="The coordinates of the top left corner, width height of the mask."
        )
        image_shape: list[int] = Field(
            default=...,
            description="The size of the image in pixels."
        )
        class Config:
            allow_extra: bool = True
    attributes: Optional[Attributes] = Field(
        default=None,
        description="Attributes of the object."
    )
    ol_type_: str = "Mask2d"
    
class Mask2dRle(Mask2d):
    """A mask is an image whose pixels have integer values between 0 and 1.

    Args:
        BaseModel (_type_): _description_
    """
    encoding: str = 'RLE'
    ol_type_: str = "Mask2dRle"
    
class Mask2dBase64(Mask2d):
    """A mask is an image whose pixels have integer values between 0 and 1.

    Args:
        BaseModel (_type_): _description_
    """
    encoding: str = Field(
        default="base64",
        description="Attributes of the object."
    )
    ol_type_: str = "Mask2dBase64"
    
class Mask2dFile(Mask2d):
    """A mask is an image whose pixels have integer values between 0 and 1.

    Args:
        BaseModel (_type_): _description_
    """
    encoding: str = Field(
        default="file",
        description="Attributes of the object."
    )
    ol_type_: str = "Mask2dFile"
    
    
class Poly2d(BaseObject, BaseLabel):
    """A 2D polyline defined as a sequence of 2D points.

    Args:
        BaseModel (_type_): _description_
    """
    class Attributes(BaseAttributes):
        closed: bool = Field(
            default=True,
            description="A boolean that defines whether the polyline is closed or not. In case it is closed, it is assumed that the last point of the sequence is connected with the first one."
        )
        mode: str = Field(
            default='MODE_POLY2D_ABSOLUTE',
            description="Mode of the polyline list of values: \"MODE_POLY2D_ABSOLUTE\" determines that the poly2d list contains the sequence of (x, y) values of all points of the polyline. \"MODE_POLY2D_RELATIVE\" specifies that only the first point of the sequence is defined with its (x, y) values, while all the rest are defined relative to it. \"MODE_POLY2D_SRF6DCC\" specifies that SRF6DCC chain code method is used. \"MODE_POLY2D_RS6FCC\" specifies that the RS6FCC method is used."
        )
    attributes: Optional[Attributes] = Field(
        default=None,
        description="Attributes of the object."
    )
    val: list[float] | list[str] | None = Field(
        description="List of numerical values of the polyline, according to its mode."
    )
    ol_type_: str = "Poly2d"
    
class Poly3d(BaseModel):
    """A 3D polyline defined as a sequence of 3D points.

    Args:
        BaseModel (_type_): _description_
    """
    class Attributes(BaseAttributes):
        pass
    attributes: Optional[Attributes] = None
    coordinate_system: Optional[str] = Field(
        default=None,
        description="Name of the coordinate system in respect of which this object data is expressed."
    )
    name: Optional[str] = Field(
        default=None,
        description="This is a string encoding the name of this object data. It is used as index inside the corresponding object data pointers."
    )
    closed: bool = Field(
        default=True,
        description="A boolean that defines whether the polyline is closed or not. In case it is closed, it is assumed that the last point of the sequence is connected with the first one."
    )
    mode: Optional[str] = None
    val: list[float] | None = Field(
        description="List of numerical values of the polyline, according to its mode."
    )

class Point3d(BaseObject, BaseLabel):
    """.

    Args:
        BaseModel (_type_): _description_
    """
    class Attributes(BaseAttributes):
        pass
    attributes: Optional[Attributes] = None
    val: list[int] | None = Field(
        description="List of indexs of the pointcloud."
    )
    ol_type_: str = "Point3d"
    
class FrameInterval(BaseModel):
    """A frame interval defines a starting and ending frame number as a closed interval. That means the interval includes the limit frame numbers.

    Args:
        BaseModel (_type_): _description_
    """
    frame_start:Optional[int] = Field(
        default=None,
        description="Initial frame number of the interval."
    )
    frame_end:Optional[int] = Field(
        default=None,
        description="Ending frame number of the interval."
    )
    time_start:Optional[float] = Field(
        default=None,
        description="Initial seconds of the interval."
    )
    time_end:Optional[float] = Field(
        default=None,
        description="Ending seconds of the interval."
    )

class ObjectData(BaseModel):
    """Additional data to describe attributes of the object.

    Args:
        BaseModel (_type_): _description_
    """
    # area_reference
    bbox: Optional[list[BBox]] = None
    rbbox: Optional[list[RBBox]] = None
    bbox3d: Optional[list[BBox3d]] = None
    mask: Optional[list[Mask2d]] = None
    poly2d: Optional[list[Poly2d]] = None
    poly3d: Optional[list[Poly3d]] = None
    text: Optional[list[Text]] = None
    point3d: Optional[list[Point3d]] = None

class Object(BaseModel):
    """An object is the main type of annotation element. Object is designed to represent spatiotemporal entities, such as physical objects in the real world. Objects shall have a name and type. Objects may have static and dynamic data. Objects are the only type of elements that may have geometric data, such as bounding boxes, cuboids, polylines, images, etc.

    Args:
        BaseModel (_type_): _description_
    """
    frame_intervals:Optional[list[FrameInterval]] = Field(
        default=None,
        description="The array of frame intervals where this object exists or is defined."
    )
    object_data: Optional[ObjectData] = None


class BaseContext(BaseModel):
    """
    Args:
        BaseModel (_type_): _description_
    """
    class Attributes(BaseAttributes):
        pass
    uuid: str = Field(
        default=None,
        description="UUID of the obejct."
    )
    attributes: Optional[Attributes] = None
    type: Optional[str] = Field(
        default=None,
        description="The type of a context defines the class the context corresponds to."
    )
    frame_intervals:Optional[list[FrameInterval]] = Field(
        default=None,
        description="The array of frame intervals where this context exists or is defined."
    )
    
    
class Context(BaseContext):
    """A context is a type of element which defines any nonspatial or temporal annotation. Contexts can be used to add richness to the contextual information of a scene, including location, weather, application-related information.

    Args:
        BaseModel (_type_): _description_
    """
    ol_type_:str='Context',
    context_data: Optional[Object] = Field(
        default=None,
        description="Additional data to describe attributes of the context."
    )

class Action(BaseModel):
    """
    Args:
        BaseModel (_type_): _description_
    """
    ol_type_:str='Action',
    action_data: Optional[Object] = Field(
        default=None,
    )

class Event(BaseModel):
    """An event is an instantaneous situation that happens without a temporal interval. Events complement actions providing a mechanism to specify triggers or to connect actions and objects with causality relations.
    Args:
        BaseModel (_type_): _description_
    """
    ol_type_:str='Action',
    event_data: Optional[Object] = Field(
        default=None,
    )

class Frame(BaseModel):
    """A frame is a container of dynamic, timewise, information.

    Args:
        BaseModel (_type_): _description_
    """
    # TODO
    #frame_properties
    objects: dict[str, Object] = Field(
        description="This is a JSON object that contains dynamic information on OpenLABEL objects. Object keys are strings containing numerical UIDs or 32 bytes UUIDs. Object values may contain an \"object_data\" JSON object."
    )
    events: Optional[dict[str, Event]] = Field(
        default=None,
        description="This is the JSON object of OpenLABEL events. Event keys are strings containing numerical UIDs or 32 bytes UUIDs."
    )
    contexts: Optional[dict[str, Context]] = Field(
        default=None,
        description="This is the JSON object of OpenLABEL contexts. Context keys are strings containing numerical UIDs or 32 bytes UUIDs."
    )
    actions: Optional[dict[str, Action]] = Field(
        default=None,
        description="This is a JSON object that contains dynamic information on OpenLABEL actions. Action keys are strings containing numerical UIDs or 32 bytes UUIDs. Action values may contain an \"action_data\" JSON object."
    )

class Openlabel(BaseModel):
    """The OpenLABEL root JSON object, which contains all other JSON objects.
    """
    # TODO
    metadata: Optional[Metadata] = Field(
        default=None,
        description="This is the JSON object of OpenLABEL metadata."
    )
    objects: Optional[dict[str, Object]] = Field(
        default=None,
        description="This is the JSON object of OpenLABEL objects. Object keys are strings containing numerical UIDs or 32 bytes UUIDs."
    )
    frames: Optional[dict[str, Frame]] = Field(
        default=None,
        description="This is the JSON object of frames that contain the dynamic, timewise, annotations. Keys are strings containing numerical frame identifiers, which are denoted as master frame numbers."
    )
    events: Optional[dict[str, Event]] = Field(
        default=None,
        description="This is the JSON object of OpenLABEL events. Event keys are strings containing numerical UIDs or 32 bytes UUIDs."
    )
    contexts: Optional[dict[str, Context]] = Field(
        default=None,
        description="This is the JSON object of OpenLABEL contexts. Context keys are strings containing numerical UIDs or 32 bytes UUIDs."
    )
    actions: Optional[dict[str, Action]] = Field(
        default=None,
        description="This is a JSON object that contains dynamic information on OpenLABEL actions. Action keys are strings containing numerical UIDs or 32 bytes UUIDs. Action values may contain an \"action_data\" JSON object."
    )
    
class Doc(BaseModel):
    type: str = 'Openlabel'
    openlabel: Openlabel
