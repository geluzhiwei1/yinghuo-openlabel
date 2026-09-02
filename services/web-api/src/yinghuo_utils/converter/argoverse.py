"""
convert argovers dataset to openlb format
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-14"

import os
import click
import json
from collections import namedtuple
from datetime import datetime
import shutil
import numpy as np
import pandas as pd
import yaml
import json
import csv
import glob
import pyquaternion
# import transformations as tfs
import pytransform3d as pt
import pytransform3d.rotations as ptr
# from av2.utils import io as av2io
# import feather
from pathlib import Path
import bisect
import pydash

from ..logging import init_logger

from ..pointcloud_utils import PC
from ..transform_utils import Projector
from .. import io_utils as IO
# from openglb import openglb as OL

logging = None


def dump_time_file(to_dir, img_dts):
    os.makedirs(to_dir, exist_ok=True)
    with open(os.path.join(to_dir, "datetimes.txt"), "wt") as f:
        for i, t_ in enumerate(img_dts):
            f.write(t_.strftime("%Y-%m-%d %H:%M:%S.%f"))
            f.write("\n")
    with open(os.path.join(to_dir, "timestamps.txt"), "wt") as f:
        for i, t_ in enumerate(img_dts):
            f.write("{:.6f}".format(t_.timestamp()))
            f.write("\n")


def read_calib_file(filepath):
    """Read in a calibration file and parse into a dictionary."""
    data = {}

    with open(filepath, 'r') as f:
        for line in f.readlines():
            key, value = line.split(':', 1)
            # The only non-float values in these files are dates, which
            # we don't care about anyway
            try:
                data[key] = np.array([float(x) for x in value.split()])
            except ValueError:
                pass
    return data


def inverse_rigid_trans(Tr):
    """ Inverse a rigid body transform matrix (3x4 as [R|t])
        [R'|-R't; 0|1] 
    """
    inv_Tr = np.zeros_like(Tr)  # 4x4
    inv_Tr[0:3, 0:3] = np.transpose(Tr[0:3, 0:3])
    inv_Tr[0:3, 3] = np.dot(-np.transpose(Tr[0:3, 0:3]), Tr[0:3, 3])
    inv_Tr[3, 3] = 1.0
    return inv_Tr


def transform_from_rot_trans(R, t):
    """Transforation matrix from rotation matrix and translation vector."""
    R = R.reshape(3, 3)
    t = t.reshape(3, 1)
    return np.vstack((np.hstack([R, t]), [0, 0, 0, 1]))


def dump_file(v_dict, calib_to_dir, file_name):
    os.makedirs(calib_to_dir, exist_ok=True)
    yaml.dump(v_dict, open(os.path.join(
        calib_to_dir, f"{file_name}.yaml"), 'wt'))
    json.dump(v_dict, open(os.path.join(
        calib_to_dir, f"{file_name}.json"), 'wt'))


def dump_env_file(cam_intrinsic, env_to_dir):
    env_content = "#!/usr/bin/env bash\n" \
        + "set -e\n" \
        + "# env\n" \
        + "CURRENT_CAM_ID={frame_id}\n" \
        + "FPS={fps}\n" \
        + "IMG_WIDTH={width}\n" \
        + "IMG_HEIGHT={height}\n"
    os.makedirs(env_to_dir, exist_ok=True)
    env_content = env_content.format_map({
        "frame_id": cam_intrinsic["frame_id"],
        "fps": cam_intrinsic["fps"],
        "width": cam_intrinsic["width"],
        "height": cam_intrinsic["height"],
    })
    fn = os.path.join(env_to_dir, "{}.json".format(cam_intrinsic['frame_id']))
    with open(fn, 'wt') as f:
        f.write(env_content)


def lidar_data(SEQ_META, args, sensor_id='up_lidar'):
    
    # sensor_in_ego = load_extrinsic(SEQ_META, args)
    # lidar_in_ego = sensor_in_ego[sensor_id]
    # ego_in_lidar = TransformUtils.inverse_rigid_trans(lidar_in_ego)
    
    fpn_pcds = glob.glob(
        f'{args.data_root}/{SEQ_META["seq"]}/sensors/lidar/*.feather')
    fpn_pcds.sort()

    # pcd file and time file
    pcd_to_dir = f'{SEQ_META["seq_out_root"]}/{sensor_id}/'
    to_dir = f'{pcd_to_dir}/pcds/'
    os.makedirs(to_dir, exist_ok=True)
    pcd_dts = []
    for i, fp in enumerate(fpn_pcds):
        df = pd.read_feather(Path(fp))
        xyz_points = df[['x', 'y', 'z']].to_numpy().astype(np.float32)
        other_points = {
            "intensity": df[['intensity']].to_numpy().astype(np.int16),
            "laser_id": df[['laser_number']].to_numpy().astype(np.int16),
            "offset_ns": df[['offset_ns']].to_numpy().astype(np.int32),
        }
        # xyz_points_in_lidar = ego_in_lidar @ (TransformUtils.cart2hom(xyz_points).T)
        # xyz_points_in_lidar = xyz_points_in_lidar.T[:, :3]
        PC.save_pc(f'{to_dir}/{i:06d}.pcd', xyz_points,
                   fields_dict=other_points, write_ascii=False)

        file_t = float(os.path.basename(fp).split('.')[0])
        dt = datetime.fromtimestamp(file_t / 1e9)
        pcd_dts.append(dt)
    dump_time_file(f'{pcd_to_dir}', pcd_dts)
    # os.system(f'rm -fr {SEQ_META["seq_out_root"]}/{sensor_id}/data && ln -s {SEQ_META["seq_out_root"]}/{sensor_id}/pcds {SEQ_META["seq_out_root"]}/{sensor_id}/data')

    # env file
    env_content = "#!/usr/bin/env bash\n" \
        + "set -e\n" \
        + "# env\n" \
        + f"FRAME_ID={sensor_id}\n" \
        + "FPS=10\n"
    with open(f'{SEQ_META["seq_out_root"]}/meta/{sensor_id}.env', 'wt') as f:
        f.write(env_content)


def cameras(SEQ_META, args):
    for cam_info in SEQ_META['camera']:
        sensor_id = cam_info['sensor_id']

        to_dir = f'{SEQ_META["seq_out_root"]}/{sensor_id}/'
        os.makedirs(to_dir + "/images", exist_ok=True)

        fns = glob.glob(
            f'{args.data_root}/{SEQ_META["seq"]}/sensors/cameras/{sensor_id}/*{args.image_format}')
        fns.sort()

        all_img_dts = []
        for i, fp in enumerate(fns):
            file_t = float(os.path.basename(fp).split('.')[0])
            dt = datetime.fromtimestamp(file_t / 1e9)
            all_img_dts.append(dt)
        assert len(all_img_dts) == len(fns)

        # TODO all images
        selected_indices = range(len(fns))

        img_dts = []
        for i, im_idx in enumerate(selected_indices):
            shutil.copy2(fns[im_idx], to_dir +
                         f"/images/{i:06d}{args.image_format}")
            file_t = float(os.path.basename(fns[im_idx]).split('.')[0])
            dt = datetime.fromtimestamp(file_t / 1e9)
            img_dts.append(dt)
        dump_time_file(f'{to_dir}', img_dts)

        os.system(
            f'rm -fr {SEQ_META["seq_out_root"]}/{sensor_id}/data && cd {SEQ_META["seq_out_root"]}/{sensor_id} && ln -s images/ data')


def camera_intrinsics(SEQ_META, args):
    df_intrinsic = pd.read_feather(
        Path(f'{args.data_root}/{SEQ_META["seq"]}/calibration/intrinsics.feather'))
    CAM_INTRINSICS = {}
    calib_to_dir = f'{SEQ_META["seq_out_root"]}/calib'
    for cam_dict in SEQ_META['camera']:
        cam_id = cam_dict['sensor_id']
        intrin_dict = df_intrinsic[df_intrinsic['sensor_name']
                                   == cam_id].iloc[0].to_dict()
        k = [
            intrin_dict['fx_px'], 0.0, intrin_dict['cx_px'],
            0.0, intrin_dict['fy_px'], intrin_dict['cy_px'],
            0.0, 0.0, 1.0
        ]
        d = [intrin_dict['k1'], intrin_dict['k2'], .0, .0, intrin_dict['k3']]

        cam_intrinsic = {"frame_id": f"{cam_id}", "fps": 20,
                         "width": intrin_dict['width_px'], "height": intrin_dict['height_px'],
                         "camera_height": 0.0,
                         "D": d,
                         "K": k}
        dump_file(cam_intrinsic, calib_to_dir, f"{cam_id}_intrinsics")
        dump_env_file(cam_intrinsic, f'{SEQ_META["seq_out_root"]}/meta')

        CAM_INTRINSICS[cam_id] = cam_intrinsic
    return CAM_INTRINSICS


def load_extrinsic(SEQ_META, args):
    df_extrinics = pd.read_feather(
        Path(f'{args.data_root}/{SEQ_META["seq"]}/calibration/egovehicle_SE3_sensor.feather'))
    EXTRINSICS_sensor_in_ego = {}
    sensor_ids = [cam_dict['sensor_id']
                  for cam_dict in SEQ_META['camera']] + ['up_lidar']
    for sensor_id in sensor_ids:
        extrin_dict = df_extrinics[df_extrinics['sensor_name']
                                   == sensor_id].iloc[0].to_dict()
        q = pyquaternion.Quaternion(
            extrin_dict['qw'], extrin_dict['qx'], extrin_dict['qy'], extrin_dict['qz'])
        extrinsic = q.transformation_matrix
        extrinsic[:3, 3] = [extrin_dict['tx_m'],
                            extrin_dict['ty_m'], extrin_dict['tz_m']]

        EXTRINSICS_sensor_in_ego[sensor_id] = extrinsic
        
    return EXTRINSICS_sensor_in_ego

def extrinsics(SEQ_META, args, CAM_INTRINSICS):
    # ego T sensor:the sensor’s pose in the egovehicle coordinate system
    EXTRINSICS_sensor_in_ego = load_extrinsic(SEQ_META, args)

    calib_to_dir = f'{SEQ_META["seq_out_root"]}/calib'

    T_ego_lidar = EXTRINSICS_sensor_in_ego['up_lidar']
    dump_file({"extrinsic": T_ego_lidar.flatten().tolist()},
              calib_to_dir, "T_imu_up_lidar")
    T_lidar_ego = Projector.inverse_rigid_trans(T_ego_lidar)
    dump_file({"extrinsic": T_lidar_ego.flatten().tolist()},
              calib_to_dir, "T_up_lidar_imu")

    T_base_link_to_imu = np.eye(4, 4)  # imu 和 ego重合
    dump_file({"extrinsic": T_base_link_to_imu.flatten().tolist()},
              calib_to_dir, "T_base_link_imu")
    dump_file({"extrinsic": Projector.inverse_rigid_trans(
        T_base_link_to_imu).flatten().tolist()}, calib_to_dir, "T_imu_base_link")

    for cam_dict in SEQ_META['camera']:
        cam_id = cam_dict['sensor_id']
        # cam extrinsic to lidar
        T_ego_sensor = EXTRINSICS_sensor_in_ego[cam_id]
        T_sensor_ego = Projector.inverse_rigid_trans(T_ego_sensor)

        T_lidar_sensor = T_lidar_ego @ T_ego_sensor

        dump_file({"extrinsic": T_lidar_sensor.flatten().tolist()},
                  calib_to_dir, f"T_up_lidar_{cam_id}")
        dump_file({"extrinsic": Projector.inverse_rigid_trans(
            T_lidar_sensor).flatten().tolist()}, calib_to_dir, f"T_{cam_id}_up_lidar")

        # cam extrinsic to imu
        dump_file({"extrinsic": T_sensor_ego.flatten().tolist()},
                  calib_to_dir, f"T_{cam_id}_imu")
        dump_file({"extrinsic": T_ego_sensor.flatten().tolist()},
                  calib_to_dir, f"T_imu_{cam_id}")

        # for DAP calib format
        dap_cam = {
            # "extrinsic_": T_lidar_sensor.flatten().tolist(),
            "extrinsic": Projector.inverse_rigid_trans(T_lidar_sensor).flatten().tolist(),
            # "extrinsic_imu": T_ego_sensor.flatten().tolist(),
            # "extrinsic": T_sensor_ego.flatten().tolist(),
            "intrinsic": CAM_INTRINSICS[cam_id]["K"]
        }
        with open(os.path.join(calib_to_dir, f"{cam_id}.json"), 'wt') as f:
            f.write(json.dumps(dap_cam))


def lidar_again(SEQ_META):
    """由imu坐标，转为lidar坐标"""
    sensor_id = 'up_lidar'
    pcd_to_dir = f'{SEQ_META["seq_out_root"]}/{sensor_id}/'
    to_dir = f'{pcd_to_dir}/pcds_lidar_axis/'
    os.makedirs(to_dir, exist_ok=True)

    T_lidar_ego = np.array(yaml.unsafe_load(
        open(f'{SEQ_META["seq_out_root"]}/calib/T_{sensor_id}_imu.yaml', 'rt'))['extrinsic']).reshape((4, 4))

    fpn_pcds = glob.glob(f'{SEQ_META["seq_out_root"]}/{sensor_id}/pcds/*.pcd')
    fpn_pcds.sort()

    for i, fp in enumerate(fpn_pcds):
        t_df, _ = PC.read_to_df(fp)
        pts = t_df[['x', 'y', 'z', 'intensity',
                    'laser_id', 'offset_ns']].to_numpy()
        arr_ego_lidar = Projector.cart2hom(pts[:, :3])  # n,4；ego下的坐标
        pts_lidar = np.matmul(T_lidar_ego, arr_ego_lidar.T).T  # n,4;lidar下的坐标
        other_points = {
            "intensity": t_df[['intensity']].to_numpy().astype(np.int16),
            "laser_id": t_df[['laser_id']].to_numpy().astype(np.int16),
            "offset_ns": t_df[['offset_ns']].to_numpy().astype(np.int32),
        }
        PC.save_pc(f'{to_dir}/{i:06d}.pcd',
                   pts_lidar[:, :3], fields_dict=other_points, write_ascii=False)

    os.system(f'rm -fr {SEQ_META["seq_out_root"]}/{sensor_id}/data')
    os.system(f'cd {SEQ_META["seq_out_root"]}/{sensor_id}/ && ln -sf pcds_lidar_axis/ data')


def interpolate_poses(pose_timestamps, abs_poses, requested_timestamps, origin_timestamp):
    """Interpolate between absolute poses.
    Args:
        pose_timestamps (list[int]): ns Must be in ascending order.
        abs_poses: x,y,z,qx,qy,qz,qw
        requested_timestamps (list[int]): Timestamps for which interpolated timestamps are required.
        origin_timestamp (int): ns. Poses will be reported relative to this frame.
    Returns:
        list: t,x,y,z,qx,qy,qz,qw
    Raises:
        ValueError: if pose_timestamps and abs_poses are not the same length
        ValueError: if pose_timestamps is not in ascending order
    """
    requested_timestamps = requested_timestamps.copy()
    requested_timestamps.insert(0, origin_timestamp)
    requested_timestamps = np.array(requested_timestamps)
    pose_timestamps = np.array(pose_timestamps)
    if len(pose_timestamps) != len(abs_poses):
        raise ValueError('Must supply same number of timestamps as poses')

    abs_quaternions = np.zeros((4, len(abs_poses)))
    abs_positions = np.zeros((3, len(abs_poses)))
    for i, pose in enumerate(abs_poses):
        if i > 0 and pose_timestamps[i - 1] > pose_timestamps[i]:
            raise ValueError('Pose timestamps must be in ascending order pose_timestamps[{}]={}'.format(
                i, pose_timestamps[i]))

        abs_quaternions[:, i] = pose[
            3:]  # np.roll(pose[3:], -1) uncomment this if the quaternion is saved as [w, x, y, z]
        abs_positions[:, i] = pose[:3]

    upper_indices = [bisect.bisect(pose_timestamps, pt)
                     for pt in requested_timestamps]
    lower_indices = [u - 1 for u in upper_indices]

    if max(upper_indices) >= len(pose_timestamps):
        upper_indices = [min(i, len(pose_timestamps) - 1)
                         for i in upper_indices]

    fractions = (requested_timestamps - pose_timestamps[lower_indices]) // \
                (pose_timestamps[upper_indices] -
                 pose_timestamps[lower_indices])

    quaternions_lower = abs_quaternions[:, lower_indices]
    quaternions_upper = abs_quaternions[:, upper_indices]

    d_array = (quaternions_lower * quaternions_upper).sum(0)

    linear_interp_indices = np.nonzero(d_array >= 1)
    sin_interp_indices = np.nonzero(d_array < 1)

    scale0_array = np.zeros(d_array.shape)
    scale1_array = np.zeros(d_array.shape)

    scale0_array[linear_interp_indices] = 1 - fractions[linear_interp_indices]
    scale1_array[linear_interp_indices] = fractions[linear_interp_indices]

    theta_array = np.arccos(np.abs(d_array[sin_interp_indices]))

    scale0_array[sin_interp_indices] = \
        np.sin((1 - fractions[sin_interp_indices])
               * theta_array) / np.sin(theta_array)
    scale1_array[sin_interp_indices] = \
        np.sin(fractions[sin_interp_indices] *
               theta_array) / np.sin(theta_array)

    negative_d_indices = np.nonzero(d_array < 0)
    scale1_array[negative_d_indices] = -scale1_array[negative_d_indices]

    quaternions_interp = np.tile(scale0_array, (4, 1)) * quaternions_lower \
        + np.tile(scale1_array, (4, 1)) * quaternions_upper

    positions_lower = abs_positions[:, lower_indices]
    positions_upper = abs_positions[:, upper_indices]

    positions_interp = np.multiply(np.tile((1 - fractions), (3, 1)), positions_lower) \
        + np.multiply(np.tile(fractions, (3, 1)), positions_upper)

    poses_mat = np.zeros((4, 4 * len(requested_timestamps)))

    poses_mat[0, 0::4] = 1 - 2 * np.square(quaternions_interp[2, :]) - \
        2 * np.square(quaternions_interp[3, :])
    poses_mat[0, 1::4] = 2 * np.multiply(quaternions_interp[1, :], quaternions_interp[2, :]) - \
        2 * np.multiply(quaternions_interp[3, :], quaternions_interp[0, :])
    poses_mat[0, 2::4] = 2 * np.multiply(quaternions_interp[1, :], quaternions_interp[3, :]) + \
        2 * np.multiply(quaternions_interp[2, :], quaternions_interp[0, :])

    poses_mat[1, 0::4] = 2 * np.multiply(quaternions_interp[1, :], quaternions_interp[2, :]) \
        + 2 * np.multiply(quaternions_interp[3, :], quaternions_interp[0, :])
    poses_mat[1, 1::4] = 1 - 2 * np.square(quaternions_interp[1, :]) \
        - 2 * np.square(quaternions_interp[3, :])
    poses_mat[1, 2::4] = 2 * np.multiply(quaternions_interp[2, :], quaternions_interp[3, :]) - \
        2 * np.multiply(quaternions_interp[1, :], quaternions_interp[0, :])

    poses_mat[2, 0::4] = 2 * np.multiply(quaternions_interp[1, :], quaternions_interp[3, :]) - \
        2 * np.multiply(quaternions_interp[2, :], quaternions_interp[0, :])
    poses_mat[2, 1::4] = 2 * np.multiply(quaternions_interp[2, :], quaternions_interp[3, :]) + \
        2 * np.multiply(quaternions_interp[1, :], quaternions_interp[0, :])
    poses_mat[2, 2::4] = 1 - 2 * np.square(quaternions_interp[1, :]) - \
        2 * np.square(quaternions_interp[2, :])

    poses_mat[0:3, 3::4] = positions_interp
    poses_mat[3, 3::4] = 1

    poses_mat = np.linalg.solve(poses_mat[0:4, 0:4], poses_mat)

    poses_out = [0] * (len(requested_timestamps) - 1)
    for i in range(1, len(requested_timestamps)):
        pose_mat = poses_mat[0:4, i * 4:(i + 1) * 4]
        pose_rot = pose_mat.copy()
        pose_rot[:3, -1] = 0
        pose_rot[-1, :3] = 0
        pose_position = pose_mat[:3, -1]
        # pose_quaternion = tfs.quaternion_from_matrix(
        #     pose_rot, isprecise=True)  # [w x y z]
        pose_quaternion = ptr.quaternion_from_matrix(pose_rot[:3, :3]) # (w, x, y, z)
        poses_out[i - 1] = [requested_timestamps[i] / 1e9, -pose_position[0], -pose_position[1], pose_position[2],
                            -pose_quaternion[3], -pose_quaternion[2], pose_quaternion[1], pose_quaternion[0]]
        # poses_out[i - 1] = poses_mat[0:4, i * 4:(i + 1) * 4]

    return poses_out

def find_poses(pose_timestamps, abs_poses, requested_timestamps):
    """
    Args:
        pose_timestamps (list[int]): ns Must be in ascending order.
        abs_poses: x,y,z,qx,qy,qz,qw
        requested_timestamps (list[int]): Timestamps for which interpolated timestamps are required.
    Returns:
        list: t,x,y,z,qx,qy,qz,qw
    Raises:
        ValueError: if pose_timestamps and abs_poses are not the same length
        ValueError: if pose_timestamps is not in ascending order
    """
    requested_timestamps = requested_timestamps.copy()
    requested_timestamps = np.array(requested_timestamps)
    pose_timestamps = np.array(pose_timestamps)
    if len(pose_timestamps) != len(abs_poses):
        raise ValueError('Must supply same number of timestamps as poses')
    
    upper_indices = [bisect.bisect(pose_timestamps, pt)
                     for pt in requested_timestamps]
    lower_indices = [u - 1 for u in upper_indices]

    pose_count = len(pose_timestamps)
    if max(upper_indices) >= pose_count:
        logging.warning(f"{max(upper_indices)} exceeds {pose_count}")
        upper_indices = np.where(np.array(upper_indices) >= pose_count, pose_count - 1, np.array(upper_indices))
        upper_indices = upper_indices.tolist()
                
    d_array1 = pose_timestamps[upper_indices] - requested_timestamps
    # assert np.all(d_array1 >= 0)
    d_array2 = requested_timestamps - pose_timestamps[lower_indices]
    # assert np.all(d_array2 >= 0)
    
    indices = np.where(d_array1 < d_array2, upper_indices, lower_indices)

    return np.hstack([requested_timestamps.reshape(-1, 1) / 1e9, abs_poses[indices, ...]])


def pose_data(SEQ_META, args):
    df_pose = pd.read_feather(
        Path(f'{args.data_root}/{SEQ_META["seq"]}/city_SE3_egovehicle.feather'))

    seconds = (df_pose.loc[len(df_pose) - 1, 'timestamp_ns'] -
               df_pose.loc[0, 'timestamp_ns']) / 1e9
    print("总秒数={}，FPS={}".format(seconds, len(df_pose) / seconds))

    # tum format ego
    os.makedirs(f"{SEQ_META['seq_out_root']}/base/", exist_ok=True)
    df_pose.to_csv(f"{SEQ_META['seq_out_root']}/base/pose.csv", sep=' ', index=False, header=False,
                   columns=['timestamp_ns', 'tx_m', 'ty_m', 'tz_m', 'qx', 'qy', 'qz', 'qw'])

    ego_pose_t_list = df_pose['timestamp_ns'].to_list()
    ego_pose_list = []
    for r in range(len(df_pose)):
        t = [df_pose.loc[r, k]
             for k in ['tx_m', 'ty_m', 'tz_m', 'qx', 'qy', 'qz', 'qw']]
        ego_pose_list.append(np.array(t))
    assert len(ego_pose_t_list) == len(ego_pose_list)

    # 转为lidar坐标系
    CALIB_DIR = f'{SEQ_META["seq_out_root"]}/calib'
    # T_lidar_ego = np.array(yaml.unsafe_load(
    #     open(f'{CALIB_DIR}/T_{sensor_id}_imu.yaml', 'rt'))['extrinsic']).reshape((4, 4))
    # lidar_poses = []
    # for tx_m, ty_m, tz_m, qx, qy, qz, qw in ego_pose_list:
    #     _t = Projector.transform_matrix_from_pose(
    #         qx, qy, qz, qw, tx_m, ty_m, tz_m)
    #     _p = np.matmul(T_lidar_ego, _t)
    #     _p = Projector.transform_matrix_to_pose(_p)  # qx, qy, qz, qw, x, y, z
    #     lidar_poses.append(_p)
    # df_poses_in_lidar = pd.DataFrame(
    #     lidar_poses, columns=['qx', 'qy', 'qz', 'qw', 'tx_m', 'ty_m', 'tz_m'])
    # df_poses_in_lidar['timestamp'] = df_pose[['timestamp_ns']].copy() / 1e9
    # df_poses_in_lidar.to_csv(f"{SEQ_META['seq_out_root']}/up_lidar/pose_from_ego.tum", sep=' ', index=False, header=False,
    #                          columns=['timestamp', 'tx_m', 'ty_m', 'tz_m', 'qx', 'qy', 'qz', 'qw'])
    
    sensor_ids = ['up_lidar']
    for cam_dict in SEQ_META['camera']:
        sensor_id = cam_dict['sensor_id']
        sensor_ids.append(sensor_id)
    # 坐标系
    for sensor_id in sensor_ids:
        
        logging.info(f"{sensor_id} resample pose")
        
        T_ego_sensor = np.array(yaml.unsafe_load(
            open(f'{CALIB_DIR}/T_imu_{sensor_id}.yaml', 'rt'))['extrinsic']).reshape((4, 4))
            
        sensor_poses = []
        for tx_m, ty_m, tz_m, qx, qy, qz, qw in ego_pose_list:
            _t_world_ego = Projector.transform_matrix_from_pose(
                qx, qy, qz, qw, tx_m, ty_m, tz_m)
            # _p = np.matmul(T_sensor_ego, _t)
            _p = _t_world_ego @ T_ego_sensor
            _p = Projector.transform_matrix_to_pose(_p)  # qx, qy, qz, qw, x, y, z
            sensor_poses.append(_p)
        df_poses_in_ = pd.DataFrame(
            sensor_poses, columns=['qx', 'qy', 'qz', 'qw', 'tx_m', 'ty_m', 'tz_m'])
        df_poses_in_['timestamp'] = df_pose[['timestamp_ns']].copy() / 1e9
        df_poses_in_.to_csv(f"{SEQ_META['seq_out_root']}/{sensor_id}/pose_from_ego.csv", sep=' ', index=False, header=False,
                                columns=['timestamp', 'tx_m', 'ty_m', 'tz_m', 'qx', 'qy', 'qz', 'qw'])

        # 根据时间重采样
        _all_t = df_poses_in_['timestamp'] * 1e9
        _all_t = _all_t.to_list()
        _all_pose = df_poses_in_[[
            'tx_m', 'ty_m', 'tz_m', 'qx', 'qy', 'qz', 'qw']].to_numpy()

        pcd_dts = IO.load_time_file(
            f"{SEQ_META['seq_out_root']}/{sensor_id}/timestamps.txt")
        pcd_times = [t.timestamp() * 1e9 for t in pcd_dts]
        _poses = find_poses(_all_t, _all_pose, pcd_times)
        # _poses = interpolate_poses(_all_t, _all_pose, pcd_times, pcd_times[0])
        assert len(_poses) == len(pcd_times)
        df_ = pd.DataFrame(
            _poses, columns=['timestamp_ns', 'tx_m', 'ty_m', 'tz_m', 'qx', 'qy', 'qz', 'qw'])
        df_.to_csv(f"{SEQ_META['seq_out_root']}/{sensor_id}/pose.csv", sep=' ', index=False, header=False,
                            columns=['timestamp_ns', 'tx_m', 'ty_m', 'tz_m', 'qx', 'qy', 'qz', 'qw'])


class MainJob(object):
    def __init__(self, args):
        self.args = args

    def generate_meta_json(self):
        """
        write to json file
        """
        a = self.args
        output_dir = os.path.join(a.output_root, a.seq)

        SEQ_META = {
            "seq": a.seq,
            "camera": [
                {
                    "sensor_id": "ring_front_center"
                },
                {
                    "sensor_id": "ring_front_left"
                },
                {
                    "sensor_id": "ring_front_right"
                },
                {
                    "sensor_id": "ring_rear_left"
                },
                {
                    "sensor_id": "ring_rear_right"
                },
                {
                    "sensor_id": "ring_side_left"
                },
                {
                    "sensor_id": "ring_side_right"
                },
                {
                    "sensor_id": "stereo_front_left"
                },
                {
                    "sensor_id": "stereo_front_right"
                }
            ],
            "camera_groups": [
                {
                    "name": "monocular",
                    "value": ["ring_front_center", "ring_front_left", "ring_front_right", "ring_rear_left", "ring_rear_right", "ring_side_left", "ring_side_right"]
                },
                {
                    "name": "stereo",
                    "value": [
                        {
                            "left": "stereo_front_left",
                            "right": "stereo_front_right"
                        }
                    ]
                },
                {
                    "name": "fisheye",
                    "value": []
                },
            ],
            "lidar": [
                {"sensor_id": "up_lidar"}],
            "lidar_groups": {
                "main": {},
                "auxiliary": {},
                "virtual": {},
                "combined": {}
            },
            "imu": [],
            "gps": [],
            "ins": [],
            "radar": [],
            "ultrasonic radar": [],
            "seq_out_root": output_dir
        }
        self.SEQ_META = SEQ_META
        os.makedirs(output_dir, exist_ok=True)
        json.dump(SEQ_META, open(f"{output_dir}/meta1.json", 'wt'))

    def convert_to_ol(self):
        # 填充stream字段
        self.OL_SEQ_META = {
            "openlabel": {
                "metadata": {
                    "schema_version": "1.0.0"
                },
                "coordinate_systems": {
                    "world": {
                        "type": "world_cs",
                        "parent": "",
                    },
                    "base": {
                        "type": "local_cs",
                        "parent": "world",
                    }
                },
                "streams": {
                },
                "frames": {
                },
            }
        }
        for cam_info in self.SEQ_META['camera']:
            sensor_id = cam_info['sensor_id']
            intrinsic = json.load(
                open(f'{self.SEQ_META["seq_out_root"]}/calib/{sensor_id}_intrinsics.json', 'tr'))
            camera_matrix_3x4 = np.eye(4)
            camera_matrix_3x4[:3, :3] = np.array(intrinsic['K']).reshape(3, 3)
            pydash.set_(self.OL_SEQ_META, f'openlabel.streams.{sensor_id}', {
                "type": "camera",
                "description": "camera",
                "stream_properties": {
                    "intrinsics_pinhole": {
                        "camera_matrix": camera_matrix_3x4.flatten().tolist(),
                        "distortion_coeffs": intrinsic['D'],
                        "height_px": intrinsic['height'],
                        "width_px": intrinsic['width']
                    },
                    "group": {"name": "monocular"}
                },
            })
        # set stereo camera
        pydash.set_(self.OL_SEQ_META, 'openlabel.streams.stereo_front_left.stream_properties.group', {
            "name": "stereo",
            "value": "left",
        })
        pydash.set_(self.OL_SEQ_META, 'openlabel.streams.stereo_front_right.stream_properties.group', {
            "name": "stereo",
            "value": "right",
        })
        
        # lidar
        sensor_id='up_lidar'
        pydash.set_(self.OL_SEQ_META, f'openlabel.streams.{sensor_id}', {
            "type": "lidar",
            "description": "Two roof-mounted VLP-32C lidar sensors (64 beams total)",
            "stream_properties": {
                "group": {"name": "combined"},
                "data_cs": sensor_id
            },
        })
        
        # ego T sensor:the sensor’s pose in the egovehicle coordinate system
        # pt_egovehicle = egovehicle_SE3_sensor * pt_sensor
        df_extrinics = pd.read_feather(
            Path(f'{self.args.data_root}/{self.SEQ_META["seq"]}/calibration/egovehicle_SE3_sensor.feather'))
        sensor_ids = [cam_dict['sensor_id']
                    for cam_dict in self.SEQ_META['camera']] + ['up_lidar']
        for sensor_id in sensor_ids:
            extrin_dict = df_extrinics[df_extrinics['sensor_name']
                                    == sensor_id].iloc[0].to_dict()
            q = pyquaternion.Quaternion(
                extrin_dict['qw'], extrin_dict['qx'], extrin_dict['qy'], extrin_dict['qz'])
            extrinsic = q.transformation_matrix
            extrinsic[:3, 3] = [extrin_dict['tx_m'],
                                extrin_dict['ty_m'], extrin_dict['tz_m']]

            pydash.set_(self.OL_SEQ_META, f'openlabel.coordinate_systems.{sensor_id}', {
                "type": "sensor_cs",
                "parent": "base",
                "pose_wrt_parent": {
                    "matrix4x4": extrinsic.flatten().tolist()
                }
            })
            
            # 生成sensor meta
            sensor_meta = {
                "openlabel": {
                    "metadata": {
                        "schema_version": "1.0.0"
                    },
                    "frames": {
                    },
                }
            }
            fpn = f'{self.SEQ_META["seq_out_root"]}/{sensor_id}/timestamps.txt'
            dts = IO.load_time_file(fpn)
            for frame_idx, t in enumerate(dts):
                img_fns = glob.glob(
                    f'{self.SEQ_META["seq_out_root"]}/{sensor_id}/data/*.*')
                img_fns.sort()
                pydash.set_(sensor_meta, f'openlabel.frames.{frame_idx}.frame_properties.timestamp', t.timestamp())
                pydash.set_(sensor_meta, f'openlabel.frames.{frame_idx}.frame_properties.uri', 
                            f"file://.{sensor_id}/data/{os.path.basename(img_fns[frame_idx])}")
            json_file = f'{self.SEQ_META["seq_out_root"]}/meta/{sensor_id}.json'
            logging.info(json_file)
            json.dump(sensor_meta, open(json_file, 'w'))
        
        # #
        # # camera按时间与lidar对齐；设置timestamp\transform
        # #
        
        # # columns=['timestamp_ns', 'tx_m', 'ty_m', 'tz_m', 'qx', 'qy', 'qz', 'qw']
        # df_pose = pd.read_feather(Path(f'{self.args.data_root}/{self.SEQ_META["seq"]}/city_SE3_egovehicle.feather'))
        # fpn = f'{self.SEQ_META["seq_out_root"]}/up_lidar/timestamps.txt'
        # pcd_dts = IO.load_time_file(fpn)
        # for frame_idx, t in enumerate(pcd_dts):
        #     pydash.set_(self.OL_SEQ_META, f'openlabel.frames.{frame_idx}.frame_properties.timestamp', t.timestamp())
        #     # 直接使用ego pose
        #     df_pose['temp'] = (df_pose['timestamp_ns'] - t.timestamp() * 1e9).abs()
        #     idx = df_pose['temp'].argmin()
        #     pydash.set_(self.OL_SEQ_META, f'openlabel.frames.{frame_idx}.frame_properties.transforms.base_to_world', 
        #     {
        #         "src": "base",
        #         "dst": "world",
        #         "transform_src_to_dst": {
        #             "quaternion": [
        #                 df_pose.loc[idx, 'qx'],
        #                 df_pose.loc[idx, 'qy'],
        #                 df_pose.loc[idx, 'qz'],
        #                 df_pose.loc[idx, 'qw']
        #             ],
        #             "translation": [
        #                 df_pose.loc[idx, 'tx_m'],
        #                 df_pose.loc[idx, 'ty_m'],
        #                 df_pose.loc[idx, 'tz_m']
        #             ]
        #         }
        #     })
        # for cam_info in self.SEQ_META['camera']:
        #     sensor_id = cam_info['sensor_id']
        #     all_img_dts = IO.load_time_file(f'{self.SEQ_META["seq_out_root"]}/{sensor_id}/timestamps.txt')
        #     selected_indices = [bisect.bisect_left(
        #         all_img_dts, pt, lo=0, hi=(len(all_img_dts) - 1)) for pt in pcd_dts]
        #     assert len(selected_indices) == len(pcd_dts)
            
        #     for frame_idx, selected_ind in enumerate(selected_indices):
        #         pydash.set_(self.OL_SEQ_META, \
        #             f'openlabel.frames.{frame_idx}.frame_properties.streams.{sensor_id}.stream_properties.sync.frame_stream', selected_ind)
                
        json.dump(self.OL_SEQ_META, open(f'{self.SEQ_META["seq_out_root"]}/meta.json', 'w'))


    def run(self):
        """
        """
        self.generate_meta_json()
        lidar_data(self.SEQ_META, self.args, sensor_id='up_lidar')
        cameras(self.SEQ_META, self.args)
        CAM_INTRINSICS = camera_intrinsics(self.SEQ_META, self.args)
        extrinsics(self.SEQ_META, self.args, CAM_INTRINSICS)
        lidar_again(self.SEQ_META)
        pose_data(self.SEQ_META, self.args)

        # 转为openlabel格式
        self.convert_to_ol()


@click.command()
@click.option('--data_root', default=None, required=True, help='Data root dir')
@click.option('--seq', required=True, help='Sequence id, like 2b443c95-d55f-3cc4-a2a1-ae4af293d8d9')
@click.option('--output_root', required=True, help='Output dir')
# @click.option('--quiet', is_flag=True)
@click.option('--image_format', default='.jpg')
def main(*args, **kwargs):
    
    Args = namedtuple("Args", kwargs.keys())
    args = Args(**kwargs)
    _main(args)


def run(args:dict):
    Args = namedtuple("Args", args.keys())
    args = Args(**args)
    _main(args)


def _main(args):
    out_dir = os.path.join(args.output_root, args.seq)
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(os.path.join(out_dir, 'meta'), exist_ok=True)
    log_dir = os.path.join(out_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    global logging
    logging = init_logger(f'{log_dir}/data_format_convert.log')
    logging.info(args)

    MainJob(args).run()


if __name__ == "__main__":
    main()
