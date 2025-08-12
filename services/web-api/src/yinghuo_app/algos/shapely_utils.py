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
algos from shapely
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-04-19"
import shapely
import math
import numpy as np
from shapely.geometry import LineString, Point, Polygon, MultiPoint
import shapely.geometry as geom
import cv2
import uuid
import pydash as _

from yinghuo_app.algos import shapely_utils
from openlabel.models import utils as olUtils
from openlabel.models import openlabel

from .algo_sets import ALGOS


@ALGOS.register_module()
def polygon_minimum_rotated_rectangle(params: dict):
    arr = np.array(params['val']).reshape(-1, 2)
    line = LineString(arr)
    rect = line.minimum_rotated_rectangle
    xx, yy = rect.exterior.xy
    points = []
    for p in zip(xx[0:-1], yy[0:-1]):
        points.append(p)
    return calculate_rectangle_properties(points)


def convert_mask_to_polygon(mask):
    contours = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_KCOS)[0]
    contours = max(contours, key=lambda arr: arr.size)
    if contours.shape.count(1):
        contours = np.squeeze(contours)
    if contours.size < 3 * 2:
        # raise Exception('Less then three point have been detected. Can not build a polygon.')
        return None
    polygon = []
    for point in contours:
        int_list = point.astype(int).tolist()
        polygon.append([int_list[0], int_list[1]])

    return polygon


def convert_ol_json_to_shapely_polygon(ol_json: dict, params):
    ol_img: openlabel.Mask2dBase64 = openlabel.Mask2dBase64.model_validate(ol_json)
    img = olUtils.ol_image_to_mask(ol_img)
    p = convert_mask_to_polygon(np.asarray(img))
    return p


@ALGOS.register_module()
async def ol_image_to_polygon(params: dict):
    """ol_image  orig_width, orig_height

    Args:
        params (dict): _description_
    """
    ol_i_json = params['ol_image']
    p = convert_ol_json_to_shapely_polygon(ol_i_json, params)
    return p


def convert_to_openlabel(frame_polys: [], imgObj:openlabel.Mask2dBase64) -> openlabel.Doc:

    frames = {}
    for frameNo, poly in frame_polys:
        # 每帧一个object
        objects = dict()
        
        label_uuid = str(uuid.uuid4())
        poly2ds = [
            openlabel.Poly2d(
                object_id=imgObj.object_id,
                object_type=imgObj.object_type,
                object_uuid=imgObj.object_uuid,
                object_attibutes=imgObj.object_attibutes,
                
                label_uuid=label_uuid,
                label_id=imgObj.label_id,
                ol_type_=imgObj.ol_type_,
                
                attributes=openlabel.Poly2d.Attributes(
                    mode='MODE_POLY2D_ABSOLUTE',
                    closed=True,
                    annotator="auto:algo-interpolation"
                ),
                val=poly
            )
        ]
        objects[label_uuid] = openlabel.Object(
            object_data=openlabel.ObjectData(
                poly2d=poly2ds,
            )
        )

        frames[str(frameNo)] = openlabel.Frame(objects=objects)

    doc = openlabel.Doc(openlabel=openlabel.Openlabel(
        metadata=openlabel.Metadata(),
        frames=frames
    )
    )
    return doc


@ALGOS.register_module()
async def interpolate_mask(params: dict):
    """_summary_

    Args:
        params (dict): ol_image1, ol_image2, n

    Returns:
        _type_: _description_
    """

    frameNo1 = params['object1']['attributes']['frameNo']
    frameNo2 = params['object2']['attributes']['frameNo']

    count = abs(int(frameNo1)-int(frameNo2)) - 1
    if count < 1:
        return []

    p1 = convert_ol_json_to_shapely_polygon(params['object1'], params)
    p2 = convert_ol_json_to_shapely_polygon(params['object2'], params)

    pls = inpter_n(p1, p2, count)

    rtn = []
    for pl in pls:
        l = []
        for p in pl:
            l.append(p.x)
            l.append(p.y)
        rtn.append(l)

    # convert to openlabel
    ol_img: openlabel.Image = openlabel.Mask2dBase64.model_validate(
        params['object1'])
    # ol_img2: openlabel.Image = openlabel.Mask2dBase64.model_validate(
    #     params['object2'])

    if frameNo2 < frameNo1:
        frameNos = range(frameNo2 + 1, frameNo1)
    else:
        frameNos = range(frameNo1 + 1, frameNo2)

    doc = convert_to_openlabel(zip(frameNos, rtn), ol_img)

    return doc

@ALGOS.register_module()
async def interpolate_polygon(params: dict):
    """_summary_

    Args:
        params (dict): object1, object2, n

    Returns:
        _type_: _description_
    """
    def _to_openlabel(frame_polys: [], imgObj:openlabel.Poly2d) -> openlabel.Doc:
        frames = {}
        for frameNo, poly in frame_polys:
            # 每帧一个object
            objects = dict()
            label_uuid = str(uuid.uuid4())
            poly2ds = [
                openlabel.Poly2d(
                    object_id=imgObj.object_id,
                    object_type=imgObj.object_type,
                    object_uuid=imgObj.object_uuid,
                    object_attibutes=imgObj.object_attibutes,
                    
                    label_uuid=label_uuid,
                    label_id=imgObj.label_id,
                    ol_type_=imgObj.ol_type_,
                    
                    attributes=openlabel.Poly2d.Attributes(
                        mode='MODE_POLY2D_ABSOLUTE',
                        closed=True,
                        annotator="auto:algo-interpolation"
                    ),
                    val=poly
                )
            ]
            objects[label_uuid] = openlabel.Object(
                object_data=openlabel.ObjectData(
                    poly2d=poly2ds,
                )
            )

            frames[str(frameNo)] = openlabel.Frame(objects=objects)

        doc = openlabel.Doc(openlabel=openlabel.Openlabel(
            metadata=openlabel.Metadata(annotator="auto:algo-interpolation"),
            frames=frames
        )
        )
        return doc

    frameNo1 = params['object1']['attributes']['frameNo']
    frameNo2 = params['object2']['attributes']['frameNo']

    count = abs(int(frameNo1)-int(frameNo2)) - 1
    if count < 1:
        return []

    o1: openlabel.Poly2d = openlabel.Poly2d.model_validate(params['object1'])
    o2: openlabel.Poly2d = openlabel.Poly2d.model_validate(params['object2'])
    
    p1 = [(o1.val[i], o1.val[i + 1]) for i in range(0, len(o1.val), 2)]
    p2 = [(o2.val[i], o2.val[i + 1]) for i in range(0, len(o2.val), 2)]

    pls = inpter_n(p1, p2, count)

    rtn = []
    for pl in pls:
        l = []
        for p in pl:
            l.append(p.x)
            l.append(p.y)
        rtn.append(l)

    if frameNo2 < frameNo1:
        frameNos = range(frameNo2 + 1, frameNo1)
    else:
        frameNos = range(frameNo1 + 1, frameNo2)

    doc = _to_openlabel(zip(frameNos, rtn), o1)

    return doc

@ALGOS.register_module()
async def interpolate_bbox(params: dict):
    
    def _to_openlabel(frame_objs, imgObj:openlabel.BBox) -> openlabel.Doc:
        frames = {}
        for frameNo, poly in frame_objs:
            # 每帧一个object
            objects = dict()
            label_uuid = str(uuid.uuid4())
            bbs = [
                openlabel.BBox(
                    object_id=imgObj.object_id,
                    object_type=imgObj.object_type,
                    object_uuid=imgObj.object_uuid,
                    object_attibutes=imgObj.object_attibutes,
                    
                    label_uuid=label_uuid,
                    ol_type_=imgObj.ol_type_,
                    label_id=imgObj.label_id,
                    
                    attributes=openlabel.BBox.Attributes(
                        annotator="auto:algo-interpolation"
                    ),
                    val=poly
                )
            ]
            objects[label_uuid] = openlabel.Object(
                object_data=openlabel.ObjectData(
                    bbox=bbs,
                )
            )
            frames[str(frameNo)] = openlabel.Frame(objects=objects)

        doc = openlabel.Doc(openlabel=openlabel.Openlabel(
            metadata=openlabel.Metadata(annotator="auto:algo-interpolation"),
            frames=frames
        )
        )
        return doc

    frameNo1 = params['object1']['attributes']['frameNo']
    frameNo2 = params['object2']['attributes']['frameNo']

    count = abs(int(frameNo1)-int(frameNo2)) - 1
    if count < 1:
        return []

    o1: openlabel.BBox = openlabel.BBox.model_validate(params['object1'])
    o2: openlabel.BBox = openlabel.BBox.model_validate(params['object2'])
    olUtils.bbox_to_CXCYWH(o1)
    olUtils.bbox_to_CXCYWH(o2)
    
    # center
    x = [o1.val[0], o2.val[0]]
    y = [o1.val[1], o2.val[1]]
    x_new = np.linspace(x[0], x[1], count+2).tolist()
    y_new = np.interp(x_new, x, y).tolist()
    
    # width,height
    w_new = np.linspace(o1.val[2], o2.val[2], count+2).tolist()
    h_new = np.linspace(o1.val[3], o2.val[3], count+2).tolist()

    rtns = []
    for cx,cy,w,h in [x for x in zip(x_new, y_new, w_new, h_new)][1:-1]:
        rtns.append([cx,cy,w,h])

    if frameNo2 < frameNo1:
        frameNos = range(frameNo2 + 1, frameNo1)
    else:
        frameNos = range(frameNo1 + 1, frameNo2)

    doc = _to_openlabel(zip(frameNos, rtns), o1)

    return doc


@ALGOS.register_module()
async def interpolate_rbbox(params: dict):
    
    def _to_openlabel(frame_objs, imgObj:openlabel.RBBox) -> openlabel.Doc:
        frames = {}
        for frameNo, poly in frame_objs:
            # 每帧一个object
            objects = dict()
            label_uuid = str(uuid.uuid4())
            bbs = [
                openlabel.RBBox(
                    object_id=imgObj.object_id,
                    object_type=imgObj.object_type,
                    object_uuid=imgObj.object_uuid,
                    object_attibutes=imgObj.object_attibutes,
                    
                    label_uuid=label_uuid,
                    ol_type_=imgObj.ol_type_,
                    label_id=imgObj.label_id,
                    
                    attributes=openlabel.RBBox.Attributes(
                        annotator="auto:algo-interpolation"
                    ),
                    val=poly
                )
            ]
            objects[label_uuid] = openlabel.Object(
                object_data=openlabel.ObjectData(
                    rbbox=bbs,
                )
            )
            frames[str(frameNo)] = openlabel.Frame(objects=objects)

        doc = openlabel.Doc(openlabel=openlabel.Openlabel(
            metadata=openlabel.Metadata(annotator="auto:algo-interpolation"),
            frames=frames
        )
        )
        return doc

    frameNo1 = params['object1']['attributes']['frameNo']
    frameNo2 = params['object2']['attributes']['frameNo']

    count = abs(int(frameNo1)-int(frameNo2)) - 1
    if count < 1:
        return []

    o1: openlabel.RBBox = openlabel.RBBox.model_validate(params['object1'])
    o2: openlabel.RBBox = openlabel.RBBox.model_validate(params['object2'])

    # center
    x = [o1.val[0], o2.val[0]]
    y = [o1.val[1], o2.val[1]]
    x_new = np.linspace(x[0], x[1], count+2)
    y_new = np.interp(x_new, x, y)
    
    # width,height,theta
    w_new = np.linspace(o1.val[2], o2.val[2], count+2)
    h_new = np.linspace(o1.val[3], o2.val[3], count+2)
    theta_new = np.linspace(o1.val[4], o2.val[4], count+2)

    rtns = []
    for cx,cy,w,h,theta in [x for x in zip(x_new, y_new, w_new, h_new, theta_new)][1:-1]:
        rtns.append([cx,cy,w,h,theta])

    if frameNo2 < frameNo1:
        frameNos = range(frameNo2 + 1, frameNo1)
    else:
        frameNos = range(frameNo1 + 1, frameNo2)

    doc = _to_openlabel(zip(frameNos, rtns), o1)

    return doc


def calculate_rectangle_properties(points):
    assert len(points) == 4

    # 计算中心点
    center_x = sum(point[0] for point in points) / 4
    center_y = sum(point[1] for point in points) / 4

    a = math.sqrt((points[0][0] - points[3][0])**2 +
                  (points[0][1] - points[3][1])**2)
    b = math.sqrt((points[0][0] - points[1][0])**2 +
                  (points[0][1] - points[1][1])**2)
    if a > b:
        width = a
        height = b
        dx = points[0][0] - points[3][0]
        dy = points[0][1] - points[3][1]
    else:
        width = b
        height = a
        dx = points[0][0] - points[1][0]
        dy = points[0][1] - points[1][1]

    theta = math.atan2(dy, dx)

    return center_x, center_y, width, height, theta


def inpter_one(p1: list[tuple[float, float]], p2: list[tuple[float, float]]):
    assert len(p1) >= 3
    assert len(p2) >= 3
    poly1 = geom.LineString(p1)
    poly2 = geom.LineString(p2)
    mls = geom.MultiLineString([poly1, poly2])

    c = np.array(mls.centroid.coords.xy).ravel()
    x0, y0, x1, y1 = mls.bounds
    rScale = (x1-x0+y1-y0)/shapely.distance(geom.Point(c), mls)
    vs = []
    for p in np.column_stack(poly1.coords.xy):
        ray = geom.LineString([c, c + rScale*(p-c)])
        inter = shapely.intersection(mls, ray)
        if isinstance(inter, geom.Point):
            vs.append(inter)
        elif isinstance(inter, geom.MultiPoint):
            vs.append(inter.centroid)
        elif isinstance(inter, geom.GeometryCollection):
            vs.append(inter.centroid)
        elif isinstance(inter, geom.LineString):
            # vs.append(inter.centroid)
            pass
        else:
            raise ValueError("Unexpected type of intersection")
    return vs


def inpter_n(p1: list[tuple[float, float]], p2: list[tuple[float, float]], n: int):
    assert n > 0
    if n == 1:
        return [inpter_one(p1, p2)]
    else:

        intered = []

        avg = inpter_one(p1, p2)
        for _ in range(0, int(n / 2)):
            avg = inpter_one(p1, avg)
            intered.append(avg)

        intered.reverse()

        avg = inpter_one(p1, p2)
        for _ in range(int(n / 2), n):
            avg = inpter_one(avg, p2)
            intered.append(avg)

        return intered
