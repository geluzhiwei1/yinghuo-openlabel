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
# -*- coding: utf-8 -*-
# by Zhang Lizhi, 2022-08-22

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

from ..transform_utils import Projector


def box_to_nparray(box):
    return np.array([
        [box["position"]["x"], box["position"]["y"], box["position"]["z"]],
        [box["scale"]["x"], box["scale"]["y"], box["scale"]["z"]],
        [box["rotation"]["x"], box["rotation"]["y"], box["rotation"]["z"]],
    ])

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
    "Unknown":        (136, 136, 0),  # '#008888',
    "Construction_vehicle": (136, 136, 0),  # '#008888',
    "Barrier":        (136, 136, 0),  # '#008888',
    "Traffic_cone":        (136, 136, 0),  # '#008888',
    "Trailer":        (136, 136, 0),  # '#008888',
}

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


def get_obj_color(obj_type):
    return obj_color_map[obj_type.capitalize()]


def plot_boxes(T, K,
               json_obj: dict,
               cv_img: np.array,
               line_width: int = 1,
               plot_aabb: bool = True,
               plot_3d: bool = True) -> np.array:
    """
    """
    img = cv_img
    img_canvas = np.zeros(img.shape, dtype=img.dtype)
    img_canvas_headplane = np.zeros(img.shape, dtype=img.dtype)
    for l in json_obj:
        #color = get_color(l["objId"])
        color = get_obj_color(l["objType"])
        box_array = box_to_nparray(l["psr"])
        points_in_image, aabb = Projector.box_to_2d_points(box_array, T, K)
        if points_in_image is not None and plot_3d:
            points_in_image = points_in_image.T
            pts = np.int32(points_in_image)
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

            cv2.putText(img_canvas, str(l['objId']), tuple(
                pts[0]), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        if aabb is not None and plot_aabb:
            color = (0, 0, 255)
            aabb = np.int32(aabb)
            cv2.line(img_canvas, tuple(aabb[0]),
                     tuple(aabb[1]), color, line_width)
            cv2.line(img_canvas, tuple(aabb[1]),
                     tuple(aabb[2]), color, line_width)
            cv2.line(img_canvas, tuple(aabb[2]),
                     tuple(aabb[3]), color, line_width)
            cv2.line(img_canvas, tuple(aabb[3]),
                     tuple(aabb[0]), color, line_width)

    final_img = img
    final_img[img_canvas != 0] = 0.2 * final_img[img_canvas != 0]
    final_img = final_img + img_canvas*0.8

    final_img[img_canvas_headplane != 0] = 0.8 * \
        final_img[img_canvas_headplane != 0]
    final_img = final_img + img_canvas_headplane*0.2

    return final_img


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
