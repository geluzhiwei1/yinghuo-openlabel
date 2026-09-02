"""
algos for pointcloud
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-10-24"

import math
import numpy as np
import os

from .algo_sets import ALGOS
from ..utils.object_pool import ObjectPool
from yinghuo_app.dto.seq_data import SeqData
from ..config import settings
from ..apps.ctx import CTX_USER_ID, CTX_USER_FRESHNESS
from ..biz.services.job import job_service
from ..biz.data_paths import file_uri_prefix, resolve_seq_dir
from ..utils.pointcloud_utils import PC

seq_data_object_pool = ObjectPool(expiration_time=180)
def get_seq_data_object(seq: str, user_id: int):
    seq_data_object = seq_data_object_pool.get_object(seq)
    if seq_data_object is None:
        seq_root = resolve_seq_dir(user_id, seq) or f"{settings.YH_USER_DATA_ROOT}/{str(user_id)}/{seq}"
        seq_data_object = SeqData.from_seq_data_dir(seq_root)
        seq_data_object_pool.release_object(seq, seq_data_object)
    return seq_data_object

def check_job_permission(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    uuid = params.get('uuid')
    doc = job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        raise Exception("You can not access this job")
    return doc

@ALGOS.register_module()
async def seq_parse_pcd(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    seqData = get_seq_data_object(params.get('seq'), user_id)
    
    stream_id = params.get('stream')
    if stream_id is None:
        raise ValueError('stream_id must be specified')
    frame_id = None #params.get('frame')
    ts = params.get('ts')
    to_cs = None # params.get('to_cs')
    return await seqData.parse_pcd(stream_id=stream_id, frame_id=frame_id, ts=ts, to_cs=to_cs)


@ALGOS.register_module()
async def seq_get_pose(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    seqData = get_seq_data_object(params.get('seq'), user_id)
    
    ts = params.get('ts')
    to_cs = params.get('to_cs')
    return seqData.get_pose(ts=ts, to_cs=to_cs)


@ALGOS.register_module()
async def seq_load_annotation(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    seqData = get_seq_data_object(params.get('seq'), user_id)
    
    stream_id = params.get('stream')
    ts = params.get('ts')
    to_cs = params.get('to_cs')
    return await seqData.annotation.load(stream_id=stream_id, ts=ts, to_cs=to_cs)


@ALGOS.register_module()
async def seq_anno_select_by_rect(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    seqData = get_seq_data_object(params.get('seq'), user_id)
    
    stream_id = params.get('stream')
    frame_ts = params.get('ts')
    to_cs = params.get('to_cs')
    pcd_data = await seqData.parse_pcd(stream_id=stream_id, frame_id=None, ts=frame_ts, to_cs=None)
    rect = params.get('rect')
    camera_conf = params.get('camera_conf')
    return await seqData.annotation.select_by_rect(pcd_data['position'], rect, camera_conf, frame_ts, None)

@ALGOS.register_module()
async def seq_anno_calc_psr_box_from_points(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    seqData = get_seq_data_object(params.get('seq'), user_id)
    
    stream_id = params.get('stream')
    frame_ts = params.get('ts')
    to_cs = params.get('to_cs')
    pcd_data = await seqData.parse_pcd(stream_id=stream_id, frame_id=None, ts=frame_ts, to_cs=None)
    position_arr = pcd_data.get('position')
    
    points_indexes = params.get('points_indexes')
    rotation_z = params.get('rotation_z')
    return await seqData.annotation.calc_psr_box_from_Points(position_arr, points_indexes, rotation_z)

@ALGOS.register_module()
async def seq_get_seq_meta(params: dict):
    
    check_job_permission(params)
    
    user_id = CTX_USER_ID.get('user_id')
    seqData = get_seq_data_object(params.get('seq'), user_id)

    return seqData.get_seq_meta()


@ALGOS.register_module()
async def seq_visualizer_plot_boxes_on_synced_image(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    seqData = get_seq_data_object(params.get('seq'), user_id)
    
    ts = params.get('ts')
    psr_boxes = params.get('psr_boxes')
    target_box = params.get('target_box')
    stream_cam_id = params.get('stream_cam_id')
    stream_lidar_id = params.get('stream_lidar_id')
    plot_conf = params.get('plot_conf')
    crop_box_conf = params.get('crop_box_conf')
    points_color_conf = params.get('points_color_conf')
    undistort_conf = params.get('undistort_conf')
    return await seqData.visualizer.plot_boxes_on_synced_image(
        psr_boxes,
        target_box=target_box,
        frame_id=None,
        ts=ts,
        stream_cam_id=stream_cam_id,
        stream_lidar_id=stream_lidar_id,
        plot_conf=plot_conf,
        crop_box_conf=crop_box_conf,
        points_color_conf=points_color_conf,
        undistort_conf=undistort_conf,
        to_html_img=True
    )

@ALGOS.register_module()
async def seq_sort_camera_by_point(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    seqData = get_seq_data_object(params.get('seq'), user_id)
    uuid = params.get('uuid')
    seq = params.get('seq')
    ts = params.get('ts')
    stream_lidar_id = params.get('stream_lidar_id')
    
    point:list = params.get('point')
    if point is None:
        raise Exception("point must be set")
    if len(point) != 3:
        raise Exception("point length must be 3")
    
    point.append(1)
    point = np.array(point)
    stream_ids = seqData.sort_camera_by_point(point, stream_lidar_id=stream_lidar_id)
    
    doc = job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        raise Exception("You can not access this job")
    job_owner_id = doc['authority']['owners'][0]
    
    rtn = []
    for stream in stream_ids:
        uri = seqData.get_uri(stream_id=stream, ts=ts)
        uri = uri.replace("file://.", "")
        uri = f"{file_uri_prefix(job_owner_id, seq) / uri.strip('/')}"

        rtn.append({"uri":uri, "stream":stream})
        
    return rtn


@ALGOS.register_module()
async def seq_get_frame_uris(params: dict):
    """_summary_

    Args:
        params (dict): _description_

    Returns:
        _type_: {}
    """
    user_id = CTX_USER_ID.get('user_id')
    uuid = params.get('uuid')
    doc = job_service.can_user_see_job(user_id, uuid, CTX_USER_FRESHNESS.get())
    if doc is None:
        raise Exception("You can not access this job")
    
    seq = params.get('seq')
    ts = params.get('ts')
    
    if params['data_format'] == 'openlabel':
        seqData = get_seq_data_object(seq, user_id)
        # TODO 我可以访问别人的数据
        job_owner_id = doc['authority']['owners'][0]
        
        rtn = {'ts': ts, 'uris':[]}
        streams = seqData.stream_metas_obj.streams.keys()
        for stream in sorted(streams):
            uri = seqData.get_uri(stream_id=stream, ts=ts)
            uri = uri.replace("file://.", "")
            uri = f"{file_uri_prefix(job_owner_id, seq) / uri.strip('/')}"
            rtn['uris'].append({"uri":uri, "stream":stream})
    elif params['data_format'] == 'simple-directory':
        rtn = {'ts': ts, 'uris':[]}
    else:
        raise Exception("Unknown data format")
        
    return rtn


@ALGOS.register_module()
async def pc_utils_calc_color(params: dict):
    user_id = CTX_USER_ID.get('user_id')
    
    arr:list = params.get('arr')
    range_min:float = params.get('range_min')
    range_max:float = params.get('range_max')
    color_map_name:str = params.get('color_map_name')
    return PC.calc_color(arr, range_min, range_max, color_map_name)
