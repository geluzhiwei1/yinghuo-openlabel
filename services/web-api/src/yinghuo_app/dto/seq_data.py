"""
parse meta file
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-12-23"

import json
import pydash
import numpy as np
import pandas as pd
import asyncio
from pytransform3d import rotations as pr
from pytransform3d import transformations as pt
from pytransform3d.transform_manager import TransformManager
import logging
from PIL import Image
import os
import io
import math

from pypcd4 import PointCloud

from yinghuo_utils.transform_utils import TransformUtils
from yinghuo_utils.pc_utils import PcUtils
from yinghuo_utils import vis_util as VsUtils
from yinghuo_utils.image_utils import ImageUtils
from yinghuo_utils.http_utils import HTTPUtils


def format_ts(ts_secnonds: float):
    return ts_secnonds * 1e9


class StreamMeta(object):

    def build_df(self):
        rows = []
        for k, v in self.meta_dict['openlabel']['frames'].items():
            ts = format_ts(v['frame_properties']['timestamp'])
            uri = v['frame_properties']['uri']
            rows.append((
                ts, int(k), uri
            ))
        self.df = pd.DataFrame(rows, columns=['ts', 'frame_index', 'uri'])
        self.df.sort_values('ts', ascending=True)

    def __init__(self, meta_dict: dict):
        self.meta_dict = meta_dict
        self.df = None
        if 'openlabel' in self.meta_dict:
            self.build_df()

    @classmethod
    def from_json(cls, json_object: dict):
        return cls(json_object)

    @classmethod
    def from_json_file(cls, json_file: str):
        with open(json_file, 'rt') as f:
            json_object = json.load(f)
        return cls.from_json(json_object)

    def get_uri(self, ts: float = None, frame_id=None):
        """根据ts或者frame_id获取路径

        Args:
            ts (_type_, optional): _description_. Defaults to None.
            frame_id (_type_, optional): _description_. Defaults to None.

        Raises:
            RuntimeError: _description_
            ValueError: _description_

        Returns:
            _type_: _description_
        """
        assert ts is not None or frame_id is not None, 'ts or frame_id is None'
        if ts is not None:
            t = self.df['ts'] - format_ts(ts)
            i = t.abs().argmin()
            return self.df.iloc[i]['uri']
        else:
            return self.df[self.df['frame_index'] == frame_id].iloc[0]['uri']


class StreamMetas(object):
    def __init__(self, stream_meta_dict: dict):
        """_summary_

        Args:
            stream_meta_dict (dict): {'stream_ids':[], 'stream_metas':[]}
        """
        self.streams = {}
        self._build_stream_meta(stream_meta_dict)

    def _build_stream_meta(self, stream_meta_dict: dict):
        assert 'stream_metas' in stream_meta_dict.keys()
        assert 'stream_ids' in stream_meta_dict.keys()

        for stream_id, meta_dict in zip(stream_meta_dict['stream_ids'], stream_meta_dict['stream_metas']):
            self.streams[stream_id] = StreamMeta.from_json(meta_dict)

    def get_stream_meta(self, stream_id: str):
        assert stream_id in self.streams.keys()

        return self.streams.get(stream_id)


class SeqMeta(object):
    """seq meta
    Args:
        object (_type_): _description_
    """

    def __init__(self, seq_meta_dict: dict):
        """初始化
        Args:
            seq_meta_dict (dict): seq meta
        """
        self.meta_dict = seq_meta_dict

    @classmethod
    def from_json(cls, json_object: dict):
        return cls(json_object)

    @classmethod
    def from_json_str(cls, json_str):
        """_summary_

        Args:
            json_str (_type_): _description_
        """
        meta_dict = json.loads(json_str)
        return cls.from_json(meta_dict)

    @classmethod
    def from_json_file(cls, json_file):
        """加载json文件

        Args:
            json_file (_type_): _description_
        """
        meta_dict = json.load(open(json_file, 'tr'))
        return cls.from_json(meta_dict)

    def get_meta(self):
        return self.meta_dict

    def get_frame_quaternion(self, frame_id: int):
        """
        从meta数据拿quaternion x,y,z,w
        """
        path = f"openlabel.frames.{frame_id}.frame_properties.transforms.ego_to_world.transform_src_to_dst.quaternion"
        return pydash.get(self.meta_dict, path)

    def get_frame_translation(self, frame_id: int):
        """从meta数据拿translation x,y,z

        Args:
            frame_id (number): _description_

        Returns:
            _type_: _description_
        """
        path = f"openlabel.frames.{frame_id}.frame_properties.transforms.ego_to_world.transform_src_to_dst.translation"
        return pydash.get(self.meta_dict, path)

    def get_frame_position(self, frame_id: int):
        """读帧的位置，返回THREE.Matrix4

        Args:
            frame_id (int): _description_

        Returns:
            _type_: _description_
        """
        quaternion = self.get_frame_quaternion(frame_id)  # x,y,z,w
        quaternion = quaternion[3:] + quaternion[:3]  # w,x.y,z
        translation = self.get_frame_translation(frame_id)
        matrix = pt.transform_from_pq(translation + quaternion)
        return matrix

    def get_famera_intrisics(self, camera_id: str):
        """获取相机内参

        Args:
            camera_id (string): _description_

        Returns:
            _type_: object {"camera_matrix": [xx], "distortion_coeffs": [xx], "height_px":xx,"width_px":xx}
        """
        path = f"openlabel.streams.{camera_id}.stream_properties.intrinsics_pinhole"
        intrinsics = pydash.get(self.meta_dict, path)
        return intrinsics

    def get_extrinsics_sensor_in_ego(self, sensor_id: str) -> np.array:
        """获取sensor外参

        Args:
            sensor_id (string): _description_

        Returns:
            _type_: _description_
        """
        path = f"openlabel.coordinate_systems.{sensor_id}.pose_wrt_parent.matrix4x4"
        matrix4x4 = pydash.get(self.meta_dict, path, None)
        if matrix4x4 is None:
            raise RuntimeError(f"{sensor_id} not found in meta_dict")
        matrix4x4 = np.array(matrix4x4, dtype=np.float32).reshape((4, 4))
        # matrix4x4 = pt.translate_transform(matrix4x4) # check
        return matrix4x4

    def get_extrinsics_ego_in_sensor(self, sensor_id: str):
        """获取sensor外参

        Args:
            sensor_id (string): _description_

        Returns:
            _type_: _description_
        """
        m = self.get_extrinsics_sensor_in_ego(sensor_id)
        return TransformUtils.invert_arr4x4(m)

    def get_streams(self) -> list:
        """获取stream列表

        Returns:
            list: [{stream_id, stream_type, group_name, group_value}]
        """
        steam_list = []
        streams = self.meta_dict['openlabel']['streams']
        for stream_id, obj in streams.items():
            steam_list.append(dict(
                stream_id=stream_id,
                stream_type=obj['type'],
                group_name=pydash.get(obj, 'stream_properties.group.name', ''),
                group_value=pydash.get(
                    obj, 'stream_properties.group.value', '')
            ))

        return steam_list

    def get_cameras(self, group: str = None):
        """获取camera列表
        Args:
            group (str, optional): monocular or stereo or None. Defaults to None.
        """
        if group is None:
            return list(filter(lambda x: x['stream_type'] == 'camera', self.get_streams()))
        else:
            return list(filter(lambda x: x['stream_type'] == 'camera' and x['group_name'] == group, self.get_streams()))

    def get_camera_ids(self, group: str = None) -> list:
        """获取camera列表

        Args:
            group (str, optional): monocular or stereo or None. Defaults to None.

        Returns:
            list: stream_id list
        """
        return list(map(lambda x: x['stream_id'], self.get_cameras(group)))

    def get_frame_ids(self, stream_id: str):
        """时间戳，单位为纳秒

        Args:
            stream_id (str): _description_
        """

    # def get_pcd_uri(self, stream_id:str, frame_id:int):
    #     """获取点云的uri地址

    #     Args:
    #         stream_id (str): _description_
    #         frame_id (int): _description_

    #     Returns:
    #         _type_: _description_
    #     """
    #     uri = self.get_stream_meta(stream_id).get_uri(frame_id)
    #     return uri


class SeqData(object):
    def __init__(self, seq_meta: SeqMeta, streams_meta: StreamMetas, seq_data_dir: str = None, seq_data_base_uri: str = None):
        self.seq_meta_obj = seq_meta
        self.stream_metas_obj = streams_meta

        self.tm = self._create_transform_manager()
        self.visualizer = Visualizer(self)

        self.base_uri = seq_data_base_uri  # 通过http访问的根目录
        self.base_dir = seq_data_dir  # 本地数据目录

        self.annotation = Annotation(self)

    def get_seq_meta(self):
        return self.seq_meta_obj.meta_dict

    def seqMeta(self):
        return self.seq_meta_obj

    def check_uri(self, uri: str):
        uri = uri.replace('file://.', '')
        if self.base_uri is not None:
            uri = os.path.join(self.base_uri, uri)
        else:
            # local file
            uri = os.path.join(self.base_dir, uri)
        return uri

    @classmethod
    def from_meta(cls, seq_meta: dict, stream_meta: dict):
        seq_meta_obj = SeqMeta(seq_meta)
        stream_metas_obj = StreamMetas(stream_meta)
        return cls(seq_meta_obj, stream_metas_obj)

    @classmethod
    def parse_base_pose(cls, data: str):
        cls.base_poses: pd.DataFrame = pd.read_csv(io.StringIO(data), sep=' ', header=None,
                                                   names=['timestamp_ns', 'x', 'y', 'z', 'qx', 'qy', 'qz', 'qw'], dtype={'timestamp_ns': float, 'x': float, 'y': float, 'z': float, 'qx': float, 'qy': float, 'qz': float, 'qw': float}
                                                   )
        # 升序排列
        cls.base_poses.sort_index(ascending=True, inplace=True)
        logging.info(f"base_poses shape: {cls.base_poses.shape}")

    @classmethod
    def from_seq_data_dir(cls, seq_data_dir: str, seq_data_base_uri=None):
        """从指定路径建立SeqData对象

        Args:
            seq_data_dir (str): data root dir, where meta.json is located
        """
        assert os.path.exists(seq_data_dir), f"{seq_data_dir} not exist"

        stream_ids = []
        stream_metas = []

        seq_meta_obj = SeqMeta.from_json_file(
            os.path.join(seq_data_dir, 'meta.json'))

        for stream_dict in seq_meta_obj.get_streams():
            stream_id = stream_dict['stream_id']
            stream_uri = os.path.join(
                seq_data_dir, "meta", stream_id + ".json")
            if os.path.exists(stream_uri):
                stream_dict = json.load(open(stream_uri, 'rt'))

            stream_ids.append(stream_id)
            stream_metas.append(stream_dict)

        streams_meta_obj = StreamMetas(
            {'stream_ids': stream_ids, 'stream_metas': stream_metas})

        # load base pose
        url = os.path.join(seq_data_dir, 'base', 'pose.csv')
        d = open(url, 'rt').read()
        cls.parse_base_pose(d)

        return cls(seq_meta_obj, streams_meta_obj, seq_data_dir, seq_data_base_uri)

    @classmethod
    async def from_web_in_browser(cls, seq_id: str, http_server='http://192.168.3.187:7020/', tk=''):
        """从指定http server建立SeqData对象
        """
        assert seq_id is not None, "seq_id is None"
        cls.seq_id = seq_id

        base_uri = f'{http_server}{seq_id}/'

        # load meta
        url = f'{base_uri}meta.json'
        data = await HTTPUtils.json(url)
        seq_meta_obj = SeqMeta.from_json(data)

        # load base pose
        url = f'{base_uri}base/pose.tum.csv'
        data = await HTTPUtils.text(url)
        cls.parse_base_pose(data)

        stream_ids = []
        stream_metas = []
        for stream_dict in seq_meta_obj.get_streams():
            stream_id = stream_dict['stream_id']
            stream_uri = f'{base_uri}/meta/{stream_id}.json'

            stream_ids.append(stream_id)
            stream_metas.append(HTTPUtils.json(stream_uri))

        if IS_IN_WEB_BROWSER:
            stream_metas = await asyncio.gather(*stream_metas)
        streams_meta_obj = StreamMetas(
            {'stream_ids': stream_ids, 'stream_metas': stream_metas})

        return cls(seq_meta_obj, streams_meta_obj, base_uri)

    def _create_transform_manager(self):
        tm = TransformManager()
        coors = pydash.get(self.seq_meta_obj.meta_dict,
                           'openlabel.coordinate_systems')
        for coordinate_id, obj in coors.items():
            matrix4x4 = pydash.get(obj, 'pose_wrt_parent.matrix4x4', None)
            if (matrix4x4 is None):
                continue
            matrix4x4 = np.array(matrix4x4, dtype=np.float32).reshape((4, 4))
            # matrix4x4 = pt.translate_transform(matrix4x4) # check
            tm.add_transform(coordinate_id, pydash.get(
                obj, 'parent'), matrix4x4)  # // ego

        return tm

    def get_transform(self, from_frame: str, to_frame: str):
        return self.tm.get_transform(from_frame, to_frame)

    def convert_points(self, from_frame: str, to_frame: str, points_in_lidar: list):
        """_summary_

        Args:
            from_frame (str): _description_
            to_frame (str): _description_
            points (list): _description_

        Returns:
            _type_: _description_
        """
        assert len(points_in_lidar) % 3 == 0
        points_arr = np.array(
            points_in_lidar, dtype=np.float32).reshape((-1, 3))
        points_arr_ = np.ones((points_arr.shape[0], 4))
        points_arr_[:, :3] = points_arr
        t = self.get_transform(from_frame, to_frame)
        points_arr = t @ points_arr_.T
        points_arr = points_arr[:3, :].T
        return points_arr

    def sort_camera_by_point(self, point: np.array, camera_ids: list = None, stream_lidar_id=None):
        """根据point查找视野最好的camera

        Args:
            point (_type_): {position:}
            camera_ids (list, optional): 查找范围. Defaults to None.
        """
        if camera_ids is None:
            camera_ids = self.seq_meta_obj.get_camera_ids(group='monocular')

        lidar_ex = self.seq_meta_obj.get_extrinsics_sensor_in_ego(
            stream_lidar_id)
        proj_pos = []
        for camera_id in camera_ids:
            box_pos_in_ego = lidar_ex @ point
            cam_ex = self.seq_meta_obj.get_extrinsics_ego_in_sensor(camera_id)
            pos_to_cam = cam_ex @ box_pos_in_ego
            proj_pos.append(pos_to_cam[:3])

        dists = np.linalg.norm(proj_pos, axis=1).flatten()
        ids = np.argsort(dists)

        return np.array(camera_ids)[ids]

    def find_best_camera_by_box(self, box: dict, camera_ids: list = None, stream_lidar_id=None):
        """根据box的position查找视野最好的camera

        Args:
            box (_type_): {position:{x:0,y:0,z:0}}
            camera_ids (list, optional): 查找范围. Defaults to None.
        """
        point = np.array([box['val'][0], box['val'][1],
                         box['val'][2], 1]).reshape((4, 1))
        return self.sort_camera_by_point(point, camera_ids=camera_ids, stream_lidar_id=stream_lidar_id)[0]

    def get_uri(self, stream_id: str = None, frame_id: int = None, ts: float = None):
        return self.stream_metas_obj.get_stream_meta(stream_id).get_uri(ts=ts, frame_id=frame_id)

    async def load_pcd(self, stream_id: str = None, frame_id: int = None, ts: float = None, to_cs: str = None):
        """load pcd文件，并转为to_cs坐标系

        Returns:
            _type_: _description_
        """
        assert frame_id is not None or ts is not None, "frame_id or ts is None"
        assert stream_id is not None

        seqMeta: SeqMeta = self.seq_meta_obj

        # pcd_uri = self.stream_metas_obj.get_stream_meta(stream_id).get_uri(ts=ts, frame_id=frame_id)
        pcd_uri = self.get_uri(stream_id, frame_id, ts)
        pcd_uri = self.check_uri(pcd_uri)
        logging.debug(f'pcd_uri@{frame_id}={pcd_uri}')
        pc = await PcUtils.Io.load_pcd(pcd_uri)
        if to_cs is not None:
            if to_cs == stream_id:
                pass
            else:
                T = self.get_transform(stream_id, to_cs)
                pc = PcUtils.transform_pcd(pc, T)
        return pc

    async def parse_pcd(self, stream_id: str = None, frame_id: int = None, ts: float = None, to_cs: str = None):
        # pc = self.load_pcd(stream_id=stream_id, frame_id=frame_id, ts=ts, to_cs=to_cs)
        pc = await self.load_pcd(stream_id=stream_id, frame_id=frame_id, ts=ts, to_cs=to_cs)
        position = np.vstack(
            [pc.pc_data['x'], pc.pc_data['y'], pc.pc_data['z']]).T  # n,3
        position = position.flatten()

        intensity = pc.pc_data['intensity']

        rgb = []
        if 'rgb' in pc.fields:
            rgb = pc.pc_data['rgb'].flatten()

        return {'position': position, 'intensity': intensity, 'rgb': rgb}

    # async def load_pcd_async(self, stream_id:str=None, frame_id:int=None, ts:float=None, to_cs:str=None):
    #     assert frame_id is not None or ts is not None, "frame_id or ts is None"
    #     assert stream_id is not None

    #     pcd_uri = self.stream_metas_obj.get_stream_meta(stream_id).get_uri(ts=ts, frame_id=frame_id)
    #     pcd_uri = self.check_uri(pcd_uri)
    #     logging.debug(f'pcd_uri@{frame_id}={pcd_uri}')
    #     pc = await PcUtils.Io.load_from_uri(pcd_uri)
    #     if to_cs is not None:
    #         if to_cs == stream_id:
    #             pass
    #         else:
    #             T = self.get_transform(stream_id, to_cs)
    #             pc = PcUtils.transform_pcd(pc, T)
    #     return pc

    async def load_image(self, stream_id: str = None, frame_id: int = None, ts: float = None,
                         undistort_conf: dict = dict(
                             enabled=False,
                             alpha=0,
                         )) -> Image:
        """load image文件

        Args:
            stream_id (str, optional): _description_. Defaults to None.
            frame_id (int, optional): _description_. Defaults to -1.

        Returns:
            _type_: Image
        """
        assert frame_id is not None or ts is not None, "frame_id or ts is None"

        stream_metas_obj: StreamMetas = self.stream_metas_obj
        seqMeta: SeqMeta = self.seq_meta_obj

        # image_uri = stream_metas_obj.get_stream_meta(stream_id).get_uri(ts=ts, frame_id=frame_id)
        image_uri = self.get_uri(stream_id, frame_id, ts)
        image_uri = self.check_uri(image_uri)
        logging.debug(f'image_uri@{frame_id}={image_uri}')

        if image_uri.startswith('http'):
            pil_img = await ImageUtils.Io.load_from_uri(image_uri)
        else:
            pil_img = Image.open(image_uri)
        if undistort_conf is None or undistort_conf['enabled'] == False:
            return pil_img

        # 去畸变
        K = np.array(seqMeta.get_famera_intrisics(stream_id)[
                     'camera_matrix']).reshape((4, 4))[:3, :3]
        D = np.array(seqMeta.get_famera_intrisics(
            stream_id)['distortion_coeffs'])
        return ImageUtils.undistort(np.asarray(pil_img), K, D, undistort_conf['alpha'])

    def get_pose(self, ts: float = None, to_cs: str = None):
        """
        根据ts获取pose
        :return: 返回插值后的四元数
        """
        assert ts is not None

        df = self.base_poses
        ts = format_ts(ts)

        try_df = df[df['timestamp_ns'] == ts]
        if try_df.size > 0:
            base_in_world = try_df[['x', 'y', 'z', 'qw',
                                    'qx', 'qy', 'qz']].to_numpy().flatten()
        else:
            # 根据frame_id，从self.base_pose查找upper， lower
            upper_t = df[df['timestamp_ns'] >= ts].iloc[0]["timestamp_ns"]
            temp = df[df['timestamp_ns'] <= ts]
            if temp.size > 0:
                lower_t = temp.iloc[-1]["timestamp_ns"]
            else:
                lower_t = df.iloc[-1]["timestamp_ns"]
            target_t = (ts - lower_t) / (upper_t - lower_t)

            print(
                f'ts={ts}, upper_t={upper_t}, lower_t={lower_t}, target_t={target_t}')

            upper = df[df['timestamp_ns'] == upper_t]
            lower = df[df['timestamp_ns'] == lower_t]
            print(f'upper={upper}, lower={lower}')

            # 从base pose插值
            # (x, y, z, qw, qx, qy, qz)
            start = lower[['x', 'y', 'z', 'qw', 'qx',
                           'qy', 'qz']].iloc[-1].to_numpy().flatten()
            end = upper[['x', 'y', 'z', 'qw', 'qx',
                         'qy', 'qz']].iloc[-1].to_numpy().flatten()
            base_in_world = pt.pq_slerp(start, end, target_t)

        if to_cs is not None:
            sensor_in_base = self.tm.get_transform(to_cs, 'base')
            # sensor_in_world = pt.concat(sensor_in_base, base_in_world)
            sensor_in_world = pt.transform_from_pq(
                base_in_world) @ sensor_in_base
            return pt.pq_from_transform(sensor_in_world)
        else:
            return base_in_world


class Visualizer:
    def __init__(self, seqData) -> None:
        self._seqData = seqData

    def do_plot_points_on_image(self,
                                stream_cam_id: str,
                                stream_lidar_id: str,
                                img_rgb: np.array,
                                pc_in_lidar: PointCloud,
                                points_color_conf=dict(
                                    field_index=-1,
                                    range_min=.0,
                                    range_max=1.0,
                                    color_map_name='rainbow'
                                ),
                                plot_conf=dict(
                                    image=True,
                                    lidar=True
                                ),
                                ):
        """
        Plot points from a lidar stream on an RGB image.

        Args:
            stream_cam_id (str): The ID of the camera stream.
            stream_lidar_id (str): The ID of the lidar stream.
            img_rgb (np.array): The RGB image to be plotted.
            pc_in_lidar (PointCloud): The point cloud data from the lidar stream.
            points_color_conf (dict, optional): The configuration for coloring the points. Defaults to a dict with field_index=-1, range_min=0.0, range_max=1.0, color_map_name='rainbow'.
            plot_conf (dict, optional): The configuration for plotting the image and lidar points. Defaults to a dict with image=True, lidar=True.

        Returns:
            np.array: The final image with the plotted points.
        """
        seqData: SeqData = self._seqData
        seqMeta = self._seqData.seq_meta_obj

        pts_in_lidar = np.vstack([pc_in_lidar.pc_data['x'],
                                  pc_in_lidar.pc_data['y'],
                                  pc_in_lidar.pc_data['z'],
                                  pc_in_lidar.pc_data['intensity']]).T  # n,4

        T_lidar_in_cam = seqData.get_transform(stream_lidar_id, stream_cam_id)
        K = np.array(seqMeta.get_famera_intrisics(stream_cam_id)[
                     'camera_matrix']).reshape((4, 4))  # [:3,:3]
        points_img_layer = VsUtils.plot_points_on_image(img_rgb,
                                                        pts_in_lidar, T_lidar_in_cam,
                                                        K, color_conf=points_color_conf)

        final_img = np.zeros(img_rgb.shape, dtype=np.uint8)
        if plot_conf is None:
            plot_conf = {}
            plot_conf['image'] = True
            plot_conf['lidar'] = True
        if plot_conf['image']:
            final_img = img_rgb.copy()
        if plot_conf['lidar']:
            mask = points_img_layer != 0
            final_img[mask] = 0.1 * final_img[mask]
            final_img = final_img + points_img_layer*0.9

        return final_img.astype(np.uint8)

    async def plot_points_on_synced_image(self,
                                          frame_id: int = None,
                                          ts: float = None,
                                          stream_cam_id: str = None,
                                          stream_lidar_id: str = None,
                                          plot_conf=None,
                                          points_color_conf=None,
                                          undistort_conf=None
                                          ):
        assert frame_id is not None or ts is not None, "Either frame_id or ts must be provided"

        seqData: SeqData = self._seqData

        pc_in_lidar = await seqData.load_pcd(stream_lidar_id, frame_id=frame_id, ts=ts, to_cs=stream_lidar_id)
        img_orin: Image = await seqData.load_image(stream_cam_id, frame_id=frame_id, ts=ts, undistort_conf=undistort_conf)
        img_orin = np.asarray(img_orin)

        final_img = self.do_plot_points_on_image(stream_cam_id, stream_lidar_id, img_orin, pc_in_lidar,
                                                 points_color_conf=points_color_conf,
                                                 plot_conf=plot_conf
                                                 )

        return final_img

    async def plot_points_on_image(self,
                                   frame_cam_id=-1,
                                   frame_lidar_id=-1,
                                   stream_cam_id: str = 'camera1',
                                   stream_lidar_id: str = 'virtual_lidar',
                                   plot_conf=None,
                                   points_color_conf=None,
                                   undistort_conf=None
                                   ):
        assert frame_cam_id > -1
        assert frame_lidar_id > -1

        seqData: SeqData = self._seqData
        seqMeta = self._seqData.seq_meta_obj

        pc_in_lidar = await seqData.load_pcd(stream_lidar_id, frame_id=frame_lidar_id, to_cs=stream_lidar_id)
        img_orin: Image = await seqData.load_image(stream_cam_id, frame_id=frame_cam_id, undistort_conf=undistort_conf)
        img_orin = np.asarray(img_orin)

        final_img = self.do_plot_points_on_image(stream_cam_id, stream_lidar_id, img_orin, pc_in_lidar,
                                                 points_color_conf=points_color_conf,
                                                 plot_conf=plot_conf
                                                 )

        return final_img

    def do_plot_boxes_on_synced_image(self,
                                      img_orin: np.array,
                                      pc: PointCloud,
                                      psr_boxes: list,
                                      stream_cam_id: str = 'cam01',
                                      stream_lidar_id: str = 'lidar01',
                                      plot_conf=dict(
                                          image=True,
                                          lidar=True,
                                          box=True,
                                      ),
                                      crop_box_conf=dict(
                                          enabled=False,
                                          expand_ratio=1.2,
                                          target=None
                                      ),
                                      points_color_conf=None,
                                      to_html_img=False
                                      ):
        # if crop_box_conf is None:
        #     crop_box_conf = dict(
        #         enabled=False
        #     )
        # if crop_box_conf['enabled']:
        #     assert crop_box_conf['target_box'] is not None, '根据box做crop'

        seqData = self._seqData
        seqMeta = self._seqData.seq_meta_obj

        T_lidar_in_cam = self._seqData.get_transform(
            stream_lidar_id, stream_cam_id)
        arr = seqMeta.get_famera_intrisics(stream_cam_id)['camera_matrix']
        if len(arr) == 16:
            K = np.array(arr).reshape((4, 4))
        elif len(arr) == 9:
            K = np.array(arr).reshape((3, 3))
        else:
            raise ValueError('camera_matrix must be 9 or 16 elements')

        boxes_img_layer = None
        if plot_conf['target_box'] and len(psr_boxes) > 0:
            boxes_img_layer, ltrb = VsUtils.plot_boxes_on_image(img_orin, psr_boxes, T_lidar_in_cam, K,
                                                                plot_2daabb=plot_conf['box2d'])

        points_img_layer = None
        if plot_conf['lidar']:
            pts_in_lidar = np.vstack(
                [pc.pc_data['x'], pc.pc_data['y'], pc.pc_data['z'], pc.pc_data['intensity']]).T  # n,4
            points_img_layer = VsUtils.plot_points_on_image(img_orin,
                                                            pts_in_lidar, T_lidar_in_cam,
                                                            K, color_conf=points_color_conf)

        # merge image
        if plot_conf['image']:
            final_img = img_orin.copy()
        else:
            final_img = np.zeros(img_orin.shape, dtype=np.uint8)
        if points_img_layer is not None:
            mask = points_img_layer != 0
            final_img[mask] = 0.2 * final_img[mask]
            final_img = final_img + points_img_layer*0.8
        if boxes_img_layer is not None:
            mask = boxes_img_layer != 0
            final_img[mask] = 0.2 * final_img[mask]
            final_img = final_img + boxes_img_layer*0.8

        final_img = np.round(final_img, 0).astype(np.uint8)
        merged_img = Image.fromarray(final_img, mode="RGB")

        # crop image
        if crop_box_conf['enabled']:
            expand_px = crop_box_conf['expand_px']
            left, top, right, bottom = ltrb
            merged_img = ImageUtils.crop(merged_img, left - expand_px, top - expand_px,
                                         right + expand_px, bottom + expand_px)
        if to_html_img:
            return ImageUtils.Io.to_dom_img_src(merged_img)
        return merged_img

    async def plot_boxes_on_synced_image(self,
                                         psr_boxes: list,
                                         target_box: dict = None,
                                         frame_id: int = None,
                                         ts: float = None,
                                         stream_cam_id: str = 'cam01',
                                         stream_lidar_id: str = 'lidar01',
                                         plot_conf=dict(
                                             image=True,
                                             lidar=True,
                                             box=True,
                                         ),
                                         crop_box_conf=dict(
                                             enabled=False,
                                             expand_ratio=1.2,
                                             target=None
                                         ),
                                         points_color_conf=None,
                                         undistort_conf=None,
                                         to_html_img=False
                                         ):
        """_summary_

        Args:
            psr_boxes (list): 投影到图片上
            target_box (dict, optional): 用来查找对应的相机. Defaults to None.
            frame_id (int, optional): _description_. Defaults to None.
            ts (float, optional): _description_. Defaults to None.
            stream_cam_id (str, optional): 相机id. Defaults to 'cam01'.
            stream_lidar_id (str, optional): _description_. Defaults to 'lidar01'.
            plot_conf (_type_, optional): _description_. Defaults to dict( image=True, lidar=True, box=True, ).
            crop_box_conf (_type_, optional): _description_. Defaults to dict( enabled=False, expand_ratio=1.2 ).
            points_color_conf (_type_, optional): _description_. Defaults to None.
            undistort_conf (_type_, optional): _description_. Defaults to None.
            to_html_img (bool, optional): _description_. Defaults to False.

        Returns:
            _type_: _description_
        """
        assert frame_id is not None or ts is not None, '不能同时为None'
        assert target_box is not None or stream_cam_id is not None, '不能同时为None'
        seqData: SeqData = self._seqData
        if stream_cam_id is None:
            # 自动对应到相机
            stream_cam_id = seqData.find_best_camera_by_box(
                target_box, stream_lidar_id=stream_lidar_id)
        assert stream_cam_id is not None, '没有找到相机'

        if psr_boxes is None or len(psr_boxes) == 0:
            psr_boxes = [target_box]

        if crop_box_conf is None:
            crop_box_conf = dict(
                enabled=False
            )
        # if crop_box_conf['enabled']:
        #     assert crop_box_conf['target'] is not None, '根据target做crop'

        pil_img: Image = await seqData.load_image(stream_cam_id, frame_id=frame_id, ts=ts, undistort_conf=undistort_conf)
        img_orin = np.asarray(pil_img)
        pc = await seqData.load_pcd(stream_lidar_id, frame_id=frame_id, ts=ts, to_cs=stream_lidar_id)

        src = self.do_plot_boxes_on_synced_image(img_orin, pc, psr_boxes,
                                                 stream_cam_id=stream_cam_id,
                                                 stream_lidar_id=stream_lidar_id,
                                                 plot_conf=plot_conf,
                                                 crop_box_conf=crop_box_conf,
                                                 points_color_conf=points_color_conf,
                                                 to_html_img=to_html_img
                                                 )
        return {
            'src': src,
            'stream_id': stream_cam_id,
        }

    # async def plot_boxes_on_synced_uri_image(self,
    #         frame_id:int,
    #         psr_boxes:list,
    #         stream_cam_id:str='cam01',
    #         stream_lidar_id:str='lidar01',
    #         plot_conf = dict(
    #             image=True,
    #             lidar=True,
    #             box=True,
    #         ),
    #         crop_box_conf = dict(
    #             enabled=False,
    #             expand_ratio=1.2,
    #         ),
    #         points_color_conf = None,
    #         undistort_conf = None,
    #         to_html_img=False
    #     ):
    #     """把点云、框投影到图像
    #         run in pyodide
    #     """
    #     if crop_box_conf['enabled']:
    #         assert len(psr_boxes) == 1, '只能根据一个box做crop'

    #     seqMeta = self._seqData.seq_meta_obj

    #     image_uri = seqMeta.get_synced_stream_uri(stream_cam_id, frame_id)
    #     pcd_uri = seqMeta.get_pcd_uri(stream_lidar_id, frame_id)

    #     pil_img = await ImageUtils.Io.load_from_uri(image_uri)
    #     if undistort_conf is not None and undistort_conf['enabled']:
    #         # 去畸变
    #         K = np.array(seqMeta.get_famera_intrisics(stream_cam_id)['camera_matrix']).reshape((4, 4))
    #         D = np.array(seqMeta.get_famera_intrisics(stream_cam_id)['distortion_coeffs'])
    #         img_orin = ImageUtils.undistort(np.asarray(pil_img), K, D, undistort_conf['alpha'])
    #     else:
    #         img_orin = np.asarray(pil_img)
    #     pc = await PcUtils.Io.pyod_load_from_uri(pcd_uri)

    #     return self.do_plot_boxes_on_synced_image(img_orin, pc, psr_boxes,
    #         stream_cam_id=stream_cam_id,
    #         stream_lidar_id=stream_lidar_id,
    #         plot_conf=plot_conf,
    #         crop_box_conf=crop_box_conf,
    #         points_color_conf=points_color_conf,
    #         to_html_img=to_html_img
    #         )


class Annotation:
    def __init__(self, seqData) -> None:
        self._seqData = seqData

    async def select_by_rect(self, position_arr_in_liar: list, rect: dict, camera_conf: dict, frame_ts: float, stream_id: str):
        """框选点云中的点

        Args:
            position_arr_in_liar (list): _description_
            rect (dict): _description_
            label (str): _description_
            frame_ts (float): _description_
            stream_id (str): _description_
        """
        logging.debug(rect)
        logging.debug(camera_conf)
        assert 'x' in rect and 'y' in rect and 'width' in rect and 'height' in rect, 'rect must have x, y, width, height'
        assert 'matrixWorld' in camera_conf and 'projectionMatrix' in camera_conf

        arr_p = np.array(position_arr_in_liar).reshape(-1, 3)  # n,3
        arr = TransformUtils.cart2hom(arr_p)  # n,4
        pq = self._seqData.get_pose(frame_ts, to_cs=stream_id)
        # lidar_in_world = TransformUtils.transform_matrix_from_pose(qx, qy, qz, qw, x, y, z)
        lidar_in_world = pt.transform_from_pq(pq)
        arr = lidar_in_world @ arr.T  # 4,n
        cam_matrixWorld = np.array(camera_conf['matrixWorld']).reshape(4, 4).T
        cam_projectionMatrix = np.array(
            camera_conf['projectionMatrix']).reshape(4, 4).T
        # arr = np.dot(projectionMatrix, np.dot(matrixWorld, arr.T))
        arr = cam_matrixWorld @ arr

        arr = TransformUtils.view_points(
            arr[:3, :], cam_projectionMatrix, normalize=True)  # 3, n

        # arr = m  # 4,n
        # arr = arr.T # n, 4
        maskd = np.logical_and.reduce((
            arr[2, :] > 0,
            arr[0, :] >= rect['x'],
            arr[0, :] <= rect['x'] + rect['width'],
            arr[1, :] >= rect['y'],
            arr[1, :] <= rect['y'] + rect['height'],
        ))
        logging.debug(f'Point count {np.count_nonzero(maskd)}')
        indexes = np.argwhere(maskd).reshape(-1)
        selected_points = arr_p[indexes]
        max_z = np.max(selected_points[:, 2])
        min_z = np.min(selected_points[:, 2])
        return indexes, min_z, max_z

    async def calc_psr_box_from_Points(self, position_arr: list, points_indexes: list, rotation_z: float):
        """
        根据指定的点创建box
        """
        def translate_box_position(pos, theta, axis, delta):
            if axis == 'x':
                pos['x'] += delta * math.cos(theta)
                pos['y'] += delta * math.sin(theta)
            elif axis == 'y':
                pos['x'] += delta * math.cos(math.pi / 2 + theta)
                pos['y'] += delta * math.sin(math.pi / 2 + theta)
            elif axis == 'z':
                pos['z'] += delta
            else:
                pass
        arr = np.array(position_arr).reshape(-1, 3)  # n,3
        points_indexes = np.array(points_indexes)
        points_arr = arr[points_indexes]

        # remove ground z
        # z_thresh = 0.2 # 0.2米
        # z_min = np.min(points_arr[:,2])
        # mask = points_arr[:,2] > (z_min + z_thresh)
        # if (np.count_nonzero(mask) > 1): # 至少要有2个点
        #     points_arr = points_arr[mask]

        position = np.mean(points_arr, axis=0)

        tf = TransformUtils.euler_angle_to_rotate_matrix(
            [0, 0, rotation_z], np.zeros(3))
        to_center = points_arr - position  # n,3
        to_center_rotated = tf @ TransformUtils.cart2hom(to_center).T  # 4,n
        to_center_rotated = (to_center_rotated.T)[:, :3]  # n,3
        to_center_rotated_min = np.min(to_center_rotated, axis=0)
        scale = np.max(to_center_rotated, axis=0) - to_center_rotated_min
        # position[2] = z_min + scale[2]

        center = {'x': position[0], 'y': position[1], 'z': position[2]}
        translate_box_position(center, rotation_z, 'x',
                               to_center_rotated_min[0] + scale[0] / 2)
        translate_box_position(center, rotation_z, 'y',
                               to_center_rotated_min[1] + scale[1] / 2)
        translate_box_position(center, rotation_z, 'z',
                               to_center_rotated_min[2] + scale[2] / 2)

        scale += 0.02
        scale = {'x': scale[0], 'y': scale[1], 'z': scale[2]}
        rotation = {'x': .0,  'y': .0, 'z': rotation_z}
        return center, scale, rotation

    async def load_from_uri(self, stream_id: str = None, frame_id: int = None, ts: float = None, to_cs: str = None):
        pass

    def load_from_json(self, json_str: str):
        pass

    async def load(self, stream_id: str = None, ts: float = None, to_cs: str = None):
        # TODO
        return []

    async def load_all(self, stream_id: str = None, to_cs: str = None):
        # TODO
        return []

    def save(self):
        pass

    def create(self):
        pass

    def delete(self):
        pass

    def update(self):
        pass

    def get_all(self):
        pass
