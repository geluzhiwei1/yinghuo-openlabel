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
可视化工具
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-12-30"

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
import pydash as _

from .transform_utils import TransformUtils
from .pointcloud_utils import PC

# def box_to_nparray(box):
#     return np.array([
#         [box["position"]["x"], box["position"]["y"], box["position"]["z"]],
#         [box["scale"]["y"], box["scale"]["x"], box["scale"]["z"]],
#         [box["rotation"]["x"], box["rotation"]["y"], box["rotation"]["z"] - np.pi / 2.0],
#     ])


obj_color_map = {
    "Car":            (0, 255, 0),  # '#00ff00',
    "Van":            (0, 255, 0),  # '#00ff00',
    "Bus":            (0, 255, 255),  # '#ffff00',
    "Pedestrian":     (0, 0, 255),  # '#ff0000',
    "Rider":          (0, 136, 255),  # '#ff8800',
    "Cyclist":        (0, 136, 255),  # '#ff8800',
    "Bicycle":        (0, 255, 136),  # '#88ff00',
    "BicycleGroup":   (0, 255, 136),  # '#88ff00',
    "Motor":          (0, 176, 176),  # '#aaaa00',
    "Motorcycle":          (0, 176, 176),  # '#aaaa00',
    "Truck":          (255, 255, 0),  # '#00ffff',
    "Tram":           (255, 255, 0),  # '#00ffff',
    "Animal":         (255, 176, 0),  # '#00aaff',
    "Misc":           (136, 136, 0),  # '#008888',
    "Unknown":        (0, 64, 0),  # '#008888',
    "Construction_vehicle": (136, 136, 0),  # '#008888',
    "Barrier":        (136, 136, 0),  # '#008888',
    "Traffic_cone":        (136, 136, 0),  # '#008888',
    "Trailer":        (136, 136, 0),  # '#008888',
}

def box_to_nparray(box):
    return np.array([
        [box["position"]["x"], box["position"]["y"], box["position"]["z"]],
        [box["scale"]["x"], box["scale"]["y"], box["scale"]["z"]],
        [box["rotation"]["x"], box["rotation"]["y"], box["rotation"]["z"]],
    ])
    
colorlist = [
    (255, 0, 0),
    (0, 255, 0),
    (0, 0, 255),
    (0, 255, 255),
    (255, 255, 0),
    (255, 0, 255),

    (128, 0, 255),
    (255, 0, 128),

    (0, 128, 255),
    (0, 255, 128),

    (128, 255, 0),
    (255, 128, 0),
]


def get_obj_color(objType):
    return obj_color_map[objType.capitalize()]

def plot_points_on_image(img_hwc_rgb:np.array,
        pts_in_lidar:np.array,
        T_lidar_in_cam_4x4:np.array,
        K_3x3:np.array,
        color_conf:dict = dict(
            field_index=-1,
            range_min=.0, 
            range_max=1.0, 
            color_map_name='rainbow'
        )
    ):
    """点投影到图片上

    Args:
        img_hwc_rgb (np.array): image array(H,W,C)
        pts_in_lidar (np.array): numpy array(N,3)/(N,4), in lidar coordinate
        T_lidar_in_cam_4x4 (np.array): transform matrix from lidar to camera
        K_3x3 (np.array): np.array(3,3)
        color_conf (dict): 着色方案. Defaults to dict( field_index=4, range_min=.0, range_max=1.0, color_map_name='rainbow' ).
    """
    assert len(img_hwc_rgb.shape) == 3, 'rgb image'
    assert img_hwc_rgb.shape[2] == 3, '3 channel'
    assert pts_in_lidar.shape[1] >=3, 'x,y,z must in pointcloud'
    
    height, width, _ = img_hwc_rgb.shape
    # arr_ego_lidar = TransformUtils.cart2hom(pts_in_lidar[:, :3]) # n,4
    # pts_in_lidar = np.matmul(T_ego_in_lidar, arr_ego_lidar.T).T # n,4
    points_img, mask, _ = TransformUtils.map_pointcloud_to_image([width, height], 
        pts_in_lidar, T_lidar_in_cam_4x4, K_3x3)
    
    # 计算颜色
    color_column = pts_in_lidar[mask][:, color_conf['field_index']]
    coloring = PC.calc_color_rgb(color_column, 
            range_min=color_conf['range_min'],
            range_max=color_conf['range_max'],
            color_map_name=color_conf['color_map_name']
        )
    
    # 
    coloring = coloring * 255
    coloring = [[int(i) for i in c] for c in coloring] # have to be int
    centers = np.round(points_img, 0).astype(np.int32)
    img_canvas = np.zeros(img_hwc_rgb.shape, dtype=np.uint8)
    for i in range(len(points_img)):
        cv2.circle(img_canvas, tuple(centers[i]), 2, tuple(coloring[i]), -1)
    
    return img_canvas


def plot_boxes_on_image(img_hwc_rgb:np.array,
        boxes:list,
        T_lidar_in_cam_4x4:np.array,
        K_3x3:np.array,
        line_width: int = 2,
        plot_2daabb: bool = True,
        plot_3d: bool = True
    ):
    """_summary_

    Args:
        img_hwc_rgb (np.array): uint8
        boxes (list): psr boxes
        T_lidar_in_cam_4x4 (np.array): _description_
        K_3x3 (np.array): _description_
        line_width (int, optional): _description_. Defaults to 1.
        plot_2daabb (bool, optional): _description_. Defaults to True.
        plot_3d (bool, optional): _description_. Defaults to True.
    """
    assert len(boxes) > 0, "No boxes to plot"
    assert len(img_hwc_rgb.shape) == 3, 'rgb image'
    assert img_hwc_rgb.shape[2] == 3, '3 channel'
    
    final_img = np.zeros(img_hwc_rgb.shape, dtype=np.uint8)
    height, width, _ = img_hwc_rgb.shape
    aabb = None
    for box in boxes:
        if 'val' in box.keys():
            # openlabel format
            val = box['val']
            p = np.array([val[0], val[1], val[2]])
            s = np.array([val[6], val[7], val[8]])
            r = np.array([val[3], val[4], val[5]])
        else:
            # psr format
            p = np.array([box['position']['x'], box['position']['y'], box['position']['z']])
            s = np.array([box['scale']['x'], box['scale']['y'], box['scale']['z']])
            r = np.array([box['rotation']['x'], box['rotation']['y'], box['rotation']['z']])
        
        corners_in_lidar = TransformUtils.psr_to_corners(p, s, r) # 8, 3

        box3d_corners_on_img, mask, depth_to_cam = TransformUtils.map_pointcloud_to_image([width, height],
            corners_in_lidar, T_lidar_in_cam_4x4, K_3x3, filter_by_dist=False)
        # 过滤框
        if np.all(depth_to_cam < 0):
            # 物体在相机后
            continue
        if np.all(box3d_corners_on_img[0, :] < 0) \
            or np.all(box3d_corners_on_img[0, :] > width) \
            or np.all(box3d_corners_on_img[1, :] < 0) \
            or np.all(box3d_corners_on_img[1, :] > height):
            # 物体在相机视野外
            continue
        
        box_img, head_plane, aabb = plot_box_corners(box, box3d_corners_on_img, img_hwc_rgb.shape, line_width=line_width, plot_aabb=plot_2daabb)
        
        # merge to image
        final_img[box_img != 0] = 0.2 * final_img[box_img != 0]
        final_img = final_img + box_img*0.8
        final_img[head_plane != 0] = 0.4 * \
            final_img[head_plane != 0]
        final_img = final_img + head_plane*0.6
        final_img = np.round(final_img, 0).astype(np.uint8)
        
    return final_img, aabb

def plot_box_corners(
        box,
        corners:np.array,
        img_shape: tuple,
        line_width: int = 1,
        plot_aabb: bool = True,
        plot_3d: bool = True) -> np.array:
    """_summary_

    Args:
        box (_type_): dict
        corners (np.array): 8,3
        img_shape (tuple): (height,width,channel)
        line_width (int, optional): _description_. Defaults to 1.
        plot_aabb (bool, optional): _description_. Defaults to True.
        plot_3d (bool, optional): _description_. Defaults to True.

    Returns:
        np.array: _description_,
        np.array: _description_
        np.array: left,top,right,bottom
    """
    def get_box_2d(box3d_corners_on_img):
        u1 = np.max(box3d_corners_on_img[:, 0])
        u2 = np.min(box3d_corners_on_img[:, 0])
        v1 = np.max(box3d_corners_on_img[:, 1])
        v2 = np.min(box3d_corners_on_img[:, 1])
        aabb = np.array([[u2, v2], [u2, v1], [u1, v1], [u1, v2]])
        return aabb
    
    # if isinstance(K, list):
    #     K = np.array(K, dtype=np.float32).reshape((4,4))
    img_canvas = np.zeros(img_shape, dtype=np.uint8)
    img_canvas_headplane = np.zeros(img_shape, dtype=np.uint8)
    
    objType = _.get(box, 'object_type', 'Unknown')
    # color = get_obj_color(objType)
    color = (255, 0, 0)

    if corners is not None and plot_3d:
        pts = np.round(corners[:, :2], 0).astype(np.int32)
        cv2.line(img_canvas, tuple(pts[0]),
                    tuple(pts[1]), color, line_width)
        cv2.line(img_canvas, tuple(pts[1]),
                    tuple(pts[2]), color, line_width)
        cv2.line(img_canvas, tuple(pts[2]),
                    tuple(pts[3]), color, line_width)
        cv2.line(img_canvas, tuple(pts[3]),
                    tuple(pts[0]), color, line_width)

        cv2.fillPoly(img_canvas_headplane, [
                        pts[0:4].reshape((-1, 1, 2))], color)
        cv2.line(img_canvas, tuple(pts[4]),
                    tuple(pts[5]), color, line_width)
        cv2.line(img_canvas, tuple(pts[5]),
                    tuple(pts[6]), color, line_width)
        cv2.line(img_canvas, tuple(pts[6]),
                    tuple(pts[7]), color, line_width)
        cv2.line(img_canvas, tuple(pts[7]),
                    tuple(pts[4]), color, line_width)
        cv2.line(img_canvas, tuple(pts[0]),
                    tuple(pts[4]), color, line_width)
        cv2.line(img_canvas, tuple(pts[1]),
                    tuple(pts[5]), color, line_width)
        cv2.line(img_canvas, tuple(pts[2]),
                    tuple(pts[6]), color, line_width)
        cv2.line(img_canvas, tuple(pts[3]),
                    tuple(pts[7]), color, line_width)

        objId = _.get(box, 'objId', '')
        cv2.putText(img_canvas, f"{objType}:{objId}", tuple(
            pts[0]), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
    

    aabb = get_box_2d(corners)
    aabb = np.int32(aabb)
    if plot_aabb:
        color = (0, 0, 255)
        cv2.line(img_canvas, tuple(aabb[0]),
                    tuple(aabb[1]), color, line_width)
        cv2.line(img_canvas, tuple(aabb[1]),
                    tuple(aabb[2]), color, line_width)
        cv2.line(img_canvas, tuple(aabb[2]),
                    tuple(aabb[3]), color, line_width)
        cv2.line(img_canvas, tuple(aabb[3]),
                    tuple(aabb[0]), color, line_width)
    
    return img_canvas, img_canvas_headplane, aabb[[0, 2]].flatten()


def plot_aabb(img: np.array, left_top: np.array, right_bottom: np.array,
              line_width: int = 1,
              color: tuple = (0, 0, 255),
              texts: list = None) -> np.array:
    """
    plot aabb box on image
    img: np.int8
    left_top, right_bottom: (n,2)
    color: bgr tuple
    """
    print(left_top.shape)
    assert img is not None
    assert left_top.shape[1] == 2
    assert left_top.shape == right_bottom.shape

    # img_canvas = np.zeros(img.shape, dtype=img.dtype)

    box_count = left_top.shape[0]
    for i in range(box_count):
        aabb = [
            left_top[i, :],
            [right_bottom[i, 0], left_top[i, 1]],
            right_bottom[i, :],
            [left_top[i, 0], right_bottom[i, 1]],
        ]
        aabb = np.int32(aabb)
        if texts is not None:
            cv2.putText(img, texts[i], tuple(aabb[0]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        cv2.line(img, tuple(aabb[0]), tuple(aabb[1]), color, line_width)
        cv2.line(img, tuple(aabb[1]), tuple(aabb[2]), color, line_width)
        cv2.line(img, tuple(aabb[2]), tuple(aabb[3]), color, line_width)
        cv2.line(img, tuple(aabb[3]), tuple(aabb[0]), color, line_width)

    # final_img = img
    # final_img[img_canvas!=0] = 0.2 * final_img[img_canvas!=0]
    # final_img = final_img + img_canvas*0.8
    return img


def pil_draw_box(box: list, draw: ImageDraw, label: str):
    """
    draw xyxy box
    """
    color = tuple(np.random.randint(0, 255, size=3).tolist())

    draw.rectangle(((box[0], box[1]), (box[2], box[3])), outline=color,  width=2)

    if label:
        font = ImageFont.load_default()
        if hasattr(font, "getbbox"):
            bbox = draw.textbbox((box[0], box[1]), str(label), font)
        else:
            w, h = draw.textsize(str(label), font)
            bbox = (box[0], box[1], w + box[0], box[1] + h)
        draw.rectangle(bbox, fill=color)
        draw.text((box[0], box[1]), str(label), fill="white")

        draw.text((box[0], box[1]), label)
