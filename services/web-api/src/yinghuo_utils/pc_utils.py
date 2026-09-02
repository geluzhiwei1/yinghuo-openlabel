"""
点云工具
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-01-03"

import numpy as np
import matplotlib as mpl
import matplotlib.pyplot as plt
from datetime import datetime
import logging
from pypcd4 import PointCloud
from io import BytesIO

from yinghuo_utils.http_utils import HTTPUtils
from .transform_utils import TransformUtils

class PcUtils:
    
    class Io:
        @staticmethod
        async def load_from_uri(uri:str)->PointCloud:
            """
            从uri加载点云
            """
            bytes = await HTTPUtils.bytes(uri, method='GET')
            pc = PointCloud.from_fileobj(BytesIO(bytes))
            return pc
    
        @staticmethod
        def load_pcd_file(pcd_file):
            pc: PointCloud = PointCloud.from_path(pcd_file)
            return pc
        
        @staticmethod
        async def load_pcd(pcd_file):
            if pcd_file.startswith('http'):
                return await PcUtils.Io.load_from_uri(pcd_file)
            else:
                return PcUtils.Io.load_pcd_file(pcd_file)
    
    @staticmethod
    def transform_pcd(pc:PointCloud, Tr:np.array):
        """变换点云的坐标系

        Args:
            pc (PointCloud): 目标点云
            Tr (np.array): 4, 4
        """
        arr = np.vstack([pc.pc_data['x'], pc.pc_data['y'], pc.pc_data['z']]).T # n,3
        arr = TransformUtils.cart2hom(arr) # n,4
        pts_in_lidar = (Tr @ arr.T).T # n,4
        pc.pc_data['x'] = pts_in_lidar[:, 0]
        pc.pc_data['y'] = pts_in_lidar[:, 1]
        pc.pc_data['z'] = pts_in_lidar[:, 2]
        return pc
    
    @staticmethod
    def color_pc_points(pcd, pcdMesh_color_arr, color_field="mono", color_map_name='rainbow'):
        """
        """
        print('color_pc_points:', datetime.now())
        if color_field == "mono":
            pass
        elif color_field == 'intensity':
            pass
        return pcd

    # @staticmethod
    # def calc_color(arr:list, range_min:float=.0, range_max:float=1.0, color_map_name='rainbow'):
    #     """根据arr计算颜色

    #     Args:
    #         arr (list): 输入，如点云反射值
    #         range_min (float, optional): 最小值. Defaults to .0.
    #         range_max (float, optional): 最大值. Defaults to 1.0.
    #         color_map_name (str, optional): _description_. Defaults to 'rainbow'.

    #     Returns:
    #         _type_: _description_
    #     """
    #     print('calc_color:', datetime.now())
    #     rtn = PcUtils.calc_color_rgb(arr, range_min=range_min, range_max=range_max, color_map_name=color_map_name).flatten()
    #     print('calc_color.', datetime.now())
    #     return rtn
    
    # @staticmethod
    # def calc_color_rgb(arr:list, range_min:float=.0, range_max:float=1.0, color_map_name='rainbow'):
    #     """根据arr计算颜色

    #     Args:
    #         arr (list): 输入，如点云反射值
    #         range_min (float, optional): 最小值. Defaults to .0.
    #         range_max (float, optional): 最大值. Defaults to 1.0.
    #         color_map_name (str, optional): _description_. Defaults to 'rainbow'.

    #     Returns:
    #         _type_: _description_
    #     """
    #     if isinstance(arr, list):
    #         arr = np.array(arr)
    #     mi = np.min(arr)
    #     ma = np.max(arr)
    #     norm_arr = (arr - mi) / (ma - mi) # convert to [0, 1.0]
        
    #     # scale color range
    #     norm_arr[norm_arr < range_min] = range_min
    #     norm_arr[norm_arr > range_max] = range_max
        
    #     # norm again
    #     new_arr = (norm_arr - range_min) / (range_max - range_min)
        
    #     cmap = mpl.colormaps[color_map_name]
    #     new_color = plt.get_cmap(cmap)(new_arr)
    #     rtn = new_color[:, :3].astype(np.float32)
    #     return rtn

    @staticmethod
    def points_batch_transform(points:list, t:list):
        """
        """
        a = np.array(points).reshape(-1, 3)
        b = np.array(t).reshape(1, 3)
        t = a + b
        rtn = t.flatten()
        return rtn
    
    