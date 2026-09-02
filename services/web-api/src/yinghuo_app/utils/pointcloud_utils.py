"""
utils
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-14"

from datetime import datetime
import os
import open3d as o3d
import seaborn as sns
import numpy as np
import pandas as pd
# from nptyping import NDArray, Shape


class PC(object):

    def __init__(self):
        pass

    @staticmethod
    def read_pcd(pcd_fpn, min_bound = None, max_bound = None):
        """
        : NDArray[Shape["3, 1"], np.float32]
        : NDArray[Shape["3, 1"], np.float32]
        """
        assert os.path.exists(pcd_fpn), f"pcd file {pcd_fpn} not exist"

        pcd = o3d.io.read_point_cloud(pcd_fpn)
        if min_bound is not None and max_bound is not None:
            bbox = o3d.geometry.AxisAlignedBoundingBox(
                min_bound=min_bound, max_bound=max_bound)
            pcd = pcd.crop(bbox)
        return pcd

    @staticmethod
    def read_to_df(pcd_fpn, min_bound = None, max_bound = None):
        """
        : NDArray[Shape["3, 1"], np.float32]
        : NDArray[Shape["3, 1"], np.float32]
        """
        assert os.path.exists(pcd_fpn), f"pcd file {pcd_fpn} not exist"

        pcd = o3d.t.io.read_point_cloud(pcd_fpn)
        if min_bound is not None and max_bound is not None:
            bbox = o3d.t.geometry.AxisAlignedBoundingBox(
                min_bound=min_bound, max_bound=max_bound)
            pcd = pcd.crop(bbox)
            
        xyz = pcd.point['positions'].numpy()
        df = pd.DataFrame(xyz, columns=['x', 'y', 'z'])
        for k, v in pcd.point.items():
            if k == 'colors':
                colors = v.numpy()
                df['r'] = colors[:, 0]
                df['g'] = colors[:, 1]
                df['b'] = colors[:, 2]
            elif k == 'normals':
                pass
            elif k == 'positions':
                pass
            else:
                df[k] = v.numpy()
        df.dropna(axis=0, inplace=True)
        return df, pcd

    @staticmethod
    def save_pcd(pcd_fpn, pcd):
        if isinstance(pcd, o3d.t.geometry.PointCloud):
            o3d.t.io.write_point_cloud(
                pcd_fpn, pcd, write_ascii=False, compressed=True)
        else:
            o3d.io.write_point_cloud(
                pcd_fpn, pcd, write_ascii=False, compressed=True)

    @staticmethod
    def save_pc(pcd_fpn, xyz_arr: np.array,
                color_arr: np.array = None,
                voxel_size: float = None,
                fields_dict: dict = None,
                fields_df: dict = None,
                write_ascii=False, device="CPU:0"):
        """
        color_arr: array of rgb color
        fields_df: other fields in df
        """
        assert pcd_fpn is not None
        assert xyz_arr.shape[1] == 3
        assert fields_dict is None or fields_df is None, "只能使用其中一个"

        device = o3d.core.Device(device)
        pcd = o3d.t.geometry.PointCloud(device)
        dtype = o3d.core.float32
        pcd.point["positions"] = o3d.core.Tensor(xyz_arr[:, :3], dtype, device)
        if color_arr is not None:
            assert color_arr.shape[0] == xyz_arr.shape[0]
            assert color_arr.shape[1] == 3
            if np.any(color_arr > 1.0):
                color_arr = color_arr / 255.0
            pcd.point["colors"] = o3d.core.Tensor(color_arr, dtype, device)
        if fields_dict is not None:
            for field, values in fields_dict.items():
                assert len(values) == xyz_arr.shape[0]
                pcd.point[field] = o3d.core.Tensor(
                    values.reshape(-1, 1), dtype, device)
        if fields_df is not None:
            assert len(fields_df) == xyz_arr.shape[0], "行数必须相等"
            other_cols = set(fields_df.columns) - set(['x', 'y', 'z'])
            for f in other_cols:
                pcd.point[f] = o3d.core.Tensor(
                    fields_df[[f]].to_numpy(), dtype, device)
        if voxel_size is not None:
            pcd = pcd.voxel_down_sample(voxel_size)

        o3d.t.io.write_point_cloud(
            pcd_fpn, pcd, write_ascii=False, compressed=True)

    @staticmethod
    def show_pcs(pts, window_name="Open3d", args=None, colors_map=None):
        """
        colors_map: list of rgb [[r,g,b],...]
        """
        if args is not None:
            if not args.show and not args.vis:
                return
        if not isinstance(pts, list):
            pts_lst = [np.asarray(pts)]
        else:
            pts_lst = pts

        if colors_map is None:
            colors_map = sns.color_palette("husl", len(pts_lst))
        pcds = []
        pts_list = []
        color_list = []
        for i, pts in enumerate(pts_lst):
            if pts is None:
                continue
            pts = np.asarray(pts)
            pcd = o3d.geometry.PointCloud()
            pts_list.append(pts[:, :3])
            pcd.points = o3d.utility.Vector3dVector(pts[:, :3])
            colors = np.zeros((pts.shape[0], 3))
            colors[:, :3] = colors_map[i]
            color_list.append(colors)
            pcd.colors = o3d.utility.Vector3dVector(colors)
            pcds.append(pcd)
        if args is None or args.show:
            o3d.visualization.draw_geometries(pcds, window_name=window_name)
        if args is None or args.vis:
            pcds = o3d.geometry.PointCloud()
            pcds.points = o3d.utility.Vector3dVector(np.vstack(pts_list))
            pcds.colors = o3d.utility.Vector3dVector(np.vstack(color_list))
        return pcds

    @staticmethod
    def show_pc_colored(pts: np.array, colors: np.array = None, window_name="Open3d"):
        """
            pts: a numpy array of x,y,z
            colors: a numpy array of r,g,b, which is between [0, 1] 
        """

        assert pts is not None
        assert colors is not None
        assert len(pts) == len(colors)

        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(pts)
        pcd.colors = o3d.utility.Vector3dVector(colors)
        o3d.visualization.draw_geometries([pcd], window_name=window_name)
        
    @staticmethod
    def calc_color(arr:list, range_min:float=.0, range_max:float=1.0, color_map_name='rainbow'):
        """根据arr计算颜色

        Args:
            arr (list): 输入，如点云反射值
            range_min (float, optional): 最小值. Defaults to .0.
            range_max (float, optional): 最大值. Defaults to 1.0.
            color_map_name (str, optional): _description_. Defaults to 'rainbow'.

        Returns:
            _type_: _description_
        """
        print('calc_color:', datetime.now())
        rtn = PC.calc_color_rgb(arr, range_min=range_min, range_max=range_max, color_map_name=color_map_name).flatten()
        print('calc_color.', datetime.now())
        return rtn
    
    @staticmethod
    def calc_color_rgb(arr:list, range_min:float=.0, range_max:float=1.0, color_map_name='rainbow'):
        """根据arr计算颜色

        Args:
            arr (list): 输入，如点云反射值
            range_min (float, optional): 最小值. Defaults to .0.
            range_max (float, optional): 最大值. Defaults to 1.0.
            color_map_name (str, optional): _description_. Defaults to 'rainbow'.

        Returns:
            _type_: _description_
        """
        import matplotlib as mpl
        import matplotlib.pyplot as plt
        if isinstance(arr, list):
            arr = np.array(arr)
        mi = np.min(arr)
        ma = np.max(arr)
        norm_arr = (arr - mi) / (ma - mi) # convert to [0, 1.0]
        
        # scale color range
        norm_arr[norm_arr < range_min] = range_min
        norm_arr[norm_arr > range_max] = range_max
        
        # norm again
        new_arr = (norm_arr - range_min) / (range_max - range_min)
        
        cmap = mpl.colormaps[color_map_name]
        new_color = plt.get_cmap(cmap)(new_arr)
        rtn = new_color[:, :3].astype(np.float32)
        return rtn
