# Copyright (C) 2025 geluzhiwei.com
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

"""
Pointcloud Algorithms - 点云算法模块
__author__ = "Zhang Lizhi"
__date__ = "2024-01-20"
"""

import numpy as np
from typing import Dict, Any, List, Optional
from yinghuo_app.algos.algo_sets import ALGOS
import logging

logger = logging.getLogger(__name__)

# ============= 位姿缓存 =============

pose_cache = {}  # {stream_ts: pose_array}
seq_meta_cache = {}


# ============= 算法实现 =============

@ALGOS.register_module()
def seq_get_pose(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    获取点云序列位姿信息

    Args:
        data: 包含以下字段
            - stream: 流ID
            - ts: 时间戳
            - seq: 序列ID
            - frame: 帧号

    Returns:
        位姿信息
        {
            "position": [x, y, z],
            "rotation": [roll, pitch, yaw],
            "quaternion": [w, x, y, z]
        }
    """
    try:
        stream = data.get("stream")
        ts = data.get("ts")
        seq = data.get("seq")
        frame = data.get("frame")

        cache_key = f"{stream}_{seq}_{ts}"

        # 从缓存获取
        if cache_key in pose_cache:
            return pose_cache[cache_key]

        # Mock位姿数据
        pose = {
            "position": [0.0, 0.0, 0.0],
            "rotation": [0.0, 0.0, 0.0],
            "quaternion": [1.0, 0.0, 0.0, 0.0],
            "transform_matrix": np.eye(4).tolist()
        }

        # 缓存结果
        pose_cache[cache_key] = pose

        return pose

    except Exception as e:
        logger.error(f"获取位姿失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def seq_parse_pcd(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    解析PCD文件

    Args:
        data: 包含以下字段
            - uri: PCD文件URI
            - frame: 帧号
            - stream: 流ID

    Returns:
        点云数据信息
        {
            "points_count": 1000000,
            "fields": ["x", "y", "z", "intensity"],
            "bounds": {"min": [x, y, z], "max": [x, y, z]}
        }
    """
    try:
        uri = data.get("uri")
        frame = data.get("frame")

        # TODO: 实现真实的PCD文件解析
        # 这里返回Mock数据
        result = {
            "points_count": 1000000,
            "fields": ["x", "y", "z", "intensity", "ring"],
            "bounds": {
                "min": [-50.0, -50.0, -5.0],
                "max": [50.0, 50.0, 5.0]
            },
            "metadata": {
                "frame": frame,
                "uri": uri,
                "format": "PCD"
            }
        }

        return result

    except Exception as e:
        logger.error(f"解析PCD失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def seq_get_seq_meta(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    获取序列元数据

    Args:
        data: 包含以下字段
            - seq: 序列ID

    Returns:
        序列元数据
        {
            "seq_id": "xxx",
            "frame_count": 100,
            "streams": ["lidar", "camera"],
            "coordinate_system": "vehicle"
        }
    """
    try:
        seq_id = data.get("seq")

        # 从缓存获取
        if seq_id in seq_meta_cache:
            return seq_meta_cache[seq_id]

        # Mock元数据
        meta = {
            "seq_id": seq_id,
            "frame_count": 100,
            "streams": {
                "lidar": {
                    "type": "pointcloud",
                    "format": "PCD",
                    "fps": 10
                },
                "camera": {
                    "type": "image",
                    "format": "JPEG",
                    "fps": 30
                }
            },
            "coordinate_system": "vehicle",
            "metadata": {
                "sensor_type": "Hesai Pandar64",
                "range": 200,
                "accuracy": 0.05
            }
        }

        # 缓存结果
        seq_meta_cache[seq_id] = meta

        return meta

    except Exception as e:
        logger.error(f"获取序列元数据失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def seq_get_frame_uris(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    获取帧URI列表

    Args:
        data: 包含以下字段
            - seq: 序列ID
            - stream: 流ID
            - start_frame: 起始帧（可选）
            - end_frame: 结束帧（可选）

    Returns:
        帧URI列表
        {
            "frames": [
                {"frame": 0, "uri": "path/to/frame_0.pcd"},
                {"frame": 1, "uri": "path/to/frame_1.pcd"}
            ]
        }
    """
    try:
        seq = data.get("seq")
        stream = data.get("stream")
        start_frame = data.get("start_frame", 0)
        end_frame = data.get("end_frame", 10)

        # TODO: 实现真实的URI获取逻辑
        frames = []
        for i in range(start_frame, end_frame):
            frames.append({
                "frame": i,
                "uri": f"/data/{seq}/{stream}/frame_{i}.pcd",
                "timestamp": i * 0.1
            })

        return {"frames": frames}

    except Exception as e:
        logger.error(f"获取帧URI失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def seq_sort_camera_by_point(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    按点云排序相机图像

    Args:
        data: 包含以下字段
            - seq: 序列ID
            - lidar_ts: 点云时间戳
            - camera_ts_list: 相机时间戳列表

    Returns:
        排序结果
        {
            "sorted_cameras": [
                {"camera_id": "1", "ts": 123.456, "matched": true}
            ]
        }
    """
    try:
        lidar_ts = data.get("lidar_ts")
        camera_ts_list = data.get("camera_ts_list", [])

        # Mock排序逻辑：找最近的相机帧
        sorted_cameras = []
        for i, cam_ts in enumerate(camera_ts_list):
            sorted_cameras.append({
                "camera_id": str(i),
                "ts": cam_ts,
                "matched": abs(cam_ts - lidar_ts) < 0.05
            })

        return {"sorted_cameras": sorted_cameras}

    except Exception as e:
        logger.error(f"排序相机失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def seq_load_annotation(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    加载标注数据

    Args:
        data: 包含以下字段
            - seq: 序列ID
            - frame: 帧号
            - stream: 流ID

    Returns:
        标注数据
        {
            "objects": [
                {
                    "id": "1",
                    "type": "vehicle",
                    "bbox": {"center": [x, y, z], "size": [l, w, h]},
                    "attributes": {...}
                }
            ]
        }
    """
    try:
        seq = data.get("seq")
        frame = data.get("frame")
        stream = data.get("stream")

        # TODO: 从数据库加载真实标注数据
        # 这里返回Mock数据
        annotations = {
            "objects": [
                {
                    "id": "obj_1",
                    "type": "vehicle",
                    "class": "car",
                    "bbox": {
                        "center": [10.5, 5.2, 0.0],
                        "size": [4.5, 2.0, 1.5],
                        "rotation": [0, 0, 0]
                    },
                    "attributes": {
                        "color": "red",
                        "confidence": 0.95
                    }
                }
            ],
            "frame": frame,
            "stream": stream
        }

        return annotations

    except Exception as e:
        logger.error(f"加载标注失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def seq_anno_calc_psr_box_from_points(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    从点计算PSR（Pairwise Surface Rotation）框

    Args:
        data: 包含以下字段
            - points: 点云数组 [[x,y,z], ...]
            - labels: 点标签

    Returns:
        3D边界框
        {
            "center": [x, y, z],
            "size": [length, width, height],
            "rotation": [roll, pitch, yaw]
        }
    """
    try:
        points = data.get("points", [])
        labels = data.get("labels", [])

        if not points:
            return {"error": "没有点数据"}

        points_array = np.array(points)

        # 计算边界框
        min_point = points_array.min(axis=0)
        max_point = points_array.max(axis=0)

        center = (min_point + max_point) / 2
        size = max_point - min_point

        # Mock计算PSR
        bbox = {
            "center": center.tolist(),
            "size": size.tolist(),
            "rotation": [0, 0, 0],
            "points_count": len(points)
        }

        return bbox

    except Exception as e:
        logger.error(f"计算PSR框失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def seq_anno_select_by_rect(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    矩形选择点

    Args:
        data: 包含以下字段
            - rect: 矩形 [x_min, y_min, x_max, y_max]
            - points: 点云数组

    Returns:
        选中的点索引
        {
            "selected_indices": [0, 1, 2, ...],
            "selected_count": 100
        }
    """
    try:
        rect = data.get("rect", [])  # [x_min, y_min, x_max, y_max]
        points = data.get("points", [])

        if not points or len(rect) != 4:
            return {"error": "参数错误"}

        x_min, y_min, x_max, y_max = rect
        points_array = np.array(points)

        # 选择在矩形内的点（投影到XY平面）
        mask = (
            (points_array[:, 0] >= x_min) &
            (points_array[:, 0] <= x_max) &
            (points_array[:, 1] >= y_min) &
            (points_array[:, 1] <= y_max)
        )

        selected_indices = np.where(mask)[0].tolist()

        return {
            "selected_indices": selected_indices,
            "selected_count": len(selected_indices)
        }

    except Exception as e:
        logger.error(f"矩形选择失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def seq_visualizer_plot_boxes_on_synced_image(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    在同步图像上绘制框

    Args:
        data: 包含以下字段
            - image_uri: 图像URI
            - boxes: 3D框列表
            - camera_params: 相机参数

    Returns:
        绘制后的图像URI
        {
            "image_uri": "path/to/plotted_image.jpg"
        }
    """
    try:
        image_uri = data.get("image_uri")
        boxes = data.get("boxes", [])
        camera_params = data.get("camera_params", {})

        # TODO: 实现真实的框绘制逻辑
        # 这里返回Mock结果
        result = {
            "image_uri": image_uri.replace(".jpg", "_plotted.jpg"),
            "plotted_boxes_count": len(boxes),
            "message": "绘制完成"
        }

        return result

    except Exception as e:
        logger.error(f"绘制框失败: {e}")
        return {"error": str(e)}


@ALGOS.register_module()
def pc_utils_calc_color(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    计算点云颜色

    Args:
        data: 包含以下字段
            - points: 点云数组
            - color_map: 颜色映射方案

    Returns:
        颜色数组
        {
            "colors": [[r, g, b, a], ...],
            "color_map": "viridis"
        }
    """
    try:
        points = data.get("points", [])
        color_map = data.get("color_map", "viridis")

        if not points:
            return {"error": "没有点数据"}

        points_array = np.array(points)

        # 基于高度计算颜色
        z_values = points_array[:, 2]
        z_min, z_max = z_values.min(), z_values.max()

        # 归一化到[0, 1]
        z_normalized = (z_values - z_min) / (z_max - z_min + 1e-6)

        # 简单的颜色映射（蓝色到红色）
        colors = np.zeros((len(points), 4))
        colors[:, 0] = z_normalized  # R
        colors[:, 1] = 0.5  # G
        colors[:, 2] = 1 - z_normalized  # B
        colors[:, 3] = 1.0  # A

        return {
            "colors": colors.tolist(),
            "color_map": color_map,
            "range": [float(z_min), float(z_max)]
        }

    except Exception as e:
        logger.error(f"计算颜色失败: {e}")
        return {"error": str(e)}
