# -*- coding: utf-8 -*-
# by Zhang Lizhi, 2022-05-01

import numpy as np
import math
from enum import Enum
from scipy.spatial.transform import Rotation

class Projector(object):
    """
    """
    class Coloring(Enum):
        DEPTH = 1
        INTENSITY = 2

    def __init__(self):
        pass

    @staticmethod
    def get_quaternion_from_euler(roll, pitch, yaw):
        """
        Convert an Euler angle to a quaternion.

        Input
            :param roll: The roll (rotation around x-axis) angle in radians.
            :param pitch: The pitch (rotation around y-axis) angle in radians.
            :param yaw: The yaw (rotation around z-axis) angle in radians.

        Output
            :return qx, qy, qz, qw: The orientation in quaternion [x,y,z,w] format
        """
        qx = np.sin(roll/2) * np.cos(pitch/2) * np.cos(yaw/2) - \
            np.cos(roll/2) * np.sin(pitch/2) * np.sin(yaw/2)
        qy = np.cos(roll/2) * np.sin(pitch/2) * np.cos(yaw/2) + \
            np.sin(roll/2) * np.cos(pitch/2) * np.sin(yaw/2)
        qz = np.cos(roll/2) * np.cos(pitch/2) * np.sin(yaw/2) - \
            np.sin(roll/2) * np.sin(pitch/2) * np.cos(yaw/2)
        qw = np.cos(roll/2) * np.cos(pitch/2) * np.cos(yaw/2) + \
            np.sin(roll/2) * np.sin(pitch/2) * np.sin(yaw/2)

        return [qx, qy, qz, qw]

    @staticmethod
    def euler_from_quaternion(x, y, z, w):
        """
        Convert a quaternion into euler angles (roll, pitch, yaw)
        roll is rotation around x in radians (counterclockwise)
        pitch is rotation around y in radians (counterclockwise)
        yaw is rotation around z in radians (counterclockwise)
        """
        t0 = +2.0 * (w * x + y * z)
        t1 = +1.0 - 2.0 * (x * x + y * y)
        roll_x = math.atan2(t0, t1)

        t2 = +2.0 * (w * y - z * x)
        t2 = +1.0 if t2 > +1.0 else t2
        t2 = -1.0 if t2 < -1.0 else t2
        pitch_y = math.asin(t2)

        t3 = +2.0 * (w * z + x * y)
        t4 = +1.0 - 2.0 * (y * y + z * z)
        yaw_z = math.atan2(t3, t4)

        return roll_x, pitch_y, yaw_z  # in radians
    
    @staticmethod
    def rotation_matrix_from_quaternion(x, y, z, w):
        """
        """
        r = Rotation.from_quat([x, y, z, w])
        return r.as_matrix()
    
    @staticmethod
    def transform_matrix_from_pose(qx, qy, qz, qw, x, y, z):
        """
        return 4x4
        """
        t = np.eye(4, dtype=float)
        r = Rotation.from_quat([qx, qy, qz, qw])
        t[:3, :3] = r.as_matrix()
        t[:3, 3] = [x, y, z]
        return t
    
    @staticmethod
    def transform_matrix_to_pose(t: np.array):
        """
        t: 4x4 se3
        return qx, qy, qz, qw, x, y, z
        """
        assert t.shape == (4, 4)
        r = Rotation.from_matrix(t[:3, :3])
        qx, qy, qz, qw = r.as_quat()
        x, y, z = t[:3, 3]
        return [qx, qy, qz, qw, x, y, z]

    @staticmethod
    def euler_angle_to_rotate_matrix(eu, t):
        theta = eu
        # Calculate rotation about x axis
        R_x = np.array([
            [1,       0,              0],
            [0,       math.cos(theta[0]),   -math.sin(theta[0])],
            [0,       math.sin(theta[0]),   math.cos(theta[0])]
        ])

        # Calculate rotation about y axis
        R_y = np.array([
            [math.cos(theta[1]),      0,      math.sin(theta[1])],
            [0,                       1,      0],
            [-math.sin(theta[1]),     0,      math.cos(theta[1])]
        ])

        # Calculate rotation about z axis
        R_z = np.array([
            [math.cos(theta[2]),    -math.sin(theta[2]),      0],
            [math.sin(theta[2]),    math.cos(theta[2]),       0],
            [0,               0,                  1]])

        R = np.matmul(R_x, np.matmul(R_y, R_z))

        t = t.reshape([-1, 1])
        R = np.concatenate([R, t], axis=-1)
        R = np.concatenate(
            [R, np.array([0, 0, 0, 1]).reshape([1, -1])], axis=0)
        return R

    @staticmethod
    def psr_to_xyz(p, s, r):
        trans_matrix = Projector.euler_angle_to_rotate_matrix(r, p)

        x = s[0]/2
        y = s[1]/2
        z = s[2]/2

        local_coord = np.array([
            x, y, -z, 1,   x, -y, -z, 1,  # front-left-bottom, front-right-bottom
            x, -y, z, 1,   x, y, z, 1,  # front-right-top,   front-left-top

            -x, y, -z, 1,   -x, -y, -z, 1,  # rear-left-bottom, rear-right-bottom
            -x, -y, z, 1,   -x, y, z, 1,  # rear-right-top,   rear-left-top

            # middle plane
            # 0, y, -z, 1,   0, -y, -z, 1,  #rear-left-bottom, rear-right-bottom
            # 0, -y, z, 1,   0, y, z, 1,    #rear-right-top,   rear-left-top
        ]).reshape((-1, 4))

        world_coord = np.matmul(trans_matrix, np.transpose(local_coord))

        return world_coord

    @staticmethod
    def proj_pts3d_to_img(pts, extrinsic_matrix, intrinsic_matrix):
        """
        """
        imgpos = np.matmul(extrinsic_matrix, pts)

        # rect matrix shall be applied here, for kitti
        imgpos3 = imgpos[:3, :]

        if np.any(imgpos3[2] < 0):
            return None

        imgpos2 = np.matmul(intrinsic_matrix, imgpos3)

        imgfinal = imgpos2[0:2, :]/imgpos2[2:, :]
        return imgfinal

    @staticmethod
    def box_to_2d_points(box, extrinsic, intrinsic):
        ""
        box3d = Projector.psr_to_xyz(box[0], box[1], box[2])  # in lidar
        # imgpos = np.matmul(args.extrinsic_matrix, pts) # in camera

        box3d_corners_on_img = Projector.proj_pts3d_to_img(
            box3d, extrinsic, intrinsic)

        if box3d_corners_on_img is not None:

            u1 = np.max(box3d_corners_on_img[0, :])
            u2 = np.min(box3d_corners_on_img[0, :])
            v1 = np.max(box3d_corners_on_img[1, :])
            v2 = np.min(box3d_corners_on_img[1, :])
            aabb = np.array([[u2, v2], [u2, v1], [u1, v1], [u1, v2]])
            return box3d_corners_on_img, aabb

        return None, None

    @staticmethod
    def cart2hom(pts_3d):
        """ Input: nx3 points in Cartesian
            Oupput: nx4 points in Homogeneous by pending 1
        """
        n = pts_3d.shape[0]
        pts_3d_hom = np.hstack((pts_3d, np.ones((n, 1))))
        return pts_3d_hom

    @staticmethod
    def inverse_rigid_trans(Tr):
        """ Inverse a rigid body transform matrix (3x4 as [R|t])
            [R'|-R't; 0|1]
        """
        inv_Tr = np.zeros_like(Tr)  # 3x4
        inv_Tr[0:3, 0:3] = np.transpose(Tr[0:3, 0:3])
        inv_Tr[0:3, 3] = np.dot(-np.transpose(Tr[0:3, 0:3]), Tr[0:3, 3])
        return inv_Tr

    @staticmethod
    def view_points(points: np.ndarray, view: np.ndarray, normalize: bool) -> np.ndarray:
        """
        This is a helper class that maps 3d points to a 2d plane. It can be used to implement both perspective and
        orthographic projections. It first applies the dot product between the points and the view. By convention,
        the view should be such that the data is projected onto the first 2 axis. It then optionally applies a
        normalization along the third dimension.

        For a perspective projection the view should be a 3x3 camera matrix, and normalize=True
        For an orthographic projection with translation the view is a 3x4 matrix and normalize=False
        For an orthographic projection without translation the view is a 3x3 matrix (optionally 3x4 with last columns
        all zeros) and normalize=False

        :param points: <np.float32: 3, n> Matrix of points, where each point (x, y, z) is along each column.
        :param view: <np.float32: n, n>. Defines an arbitrary projection (n <= 4).
            The projection should be such that the corners are projected onto the first 2 axis.
        :param normalize: Whether to normalize the remaining coordinate (along the third axis).
        :return: <np.float32: 3, n>. Mapped point. If normalize=False, the third coordinate is the height.
        """

        assert view.shape[0] <= 4
        assert view.shape[1] <= 4
        assert points.shape[0] == 3

        viewpad = np.eye(4)
        viewpad[:view.shape[0], :view.shape[1]] = view

        nbr_points = points.shape[1]

        # Do operation in homogenous coordinates.
        points = np.concatenate((points, np.ones((1, nbr_points))))
        points = np.dot(viewpad, points)
        points = points[:3, :]

        if normalize:
            points = points / points[2:3,
                                     :].repeat(3, 0).reshape(3, nbr_points)
            # points[:2] /= points[2,:]

        return points

    @staticmethod
    def map_pointcloud_to_image(img, pc_points, extrinsic, intrinsic, min_dist=0.0, coloring=Coloring.DEPTH, intensity_vis_range=[20, 120]):
        """
            im: PIL image object
            points: (?, 4), fields: x,y,z,intensity
                   or (?, 3), fields: x,y,z
        """
        if pc_points.shape[1] == 3:
            coloring = Projector.Coloring.DEPTH
        pcd_arr = Projector.cart2hom(pc_points[:, :3])  # n,4
        pts_in_cam = np.matmul(extrinsic, pcd_arr.T).T  # n,4
        depths = pts_in_cam[:, 2]

        # Take the actual picture (matrix multiplication with camera-matrix + renormalization).
        points = Projector.view_points(
            pts_in_cam.T[:3, :], intrinsic, normalize=True)  # 3, n

        mask = np.ones(depths.shape[0], dtype=bool)
        mask = np.logical_and(mask, depths > min_dist)
        mask = np.logical_and(mask, points[0, :] > 1)
        mask = np.logical_and(mask, points[0, :] < img.size[0] - 1)
        mask = np.logical_and(mask, points[1, :] > 1)
        mask = np.logical_and(mask, points[1, :] < img.size[1] - 1)
        points = points[:, mask]

        if coloring == Projector.Coloring.DEPTH:
            coloring = depths[mask]
        else:
            # Retrieve the color from the intensities.
            # Performs arbitary scaling to achieve more visually pleasing results.
            
            intensities = pc_points[:, 3]  # intensity field
            intensities = np.clip(intensities, intensity_vis_range[0], intensity_vis_range[1])
            intensities = (intensities - np.min(intensities)) / \
                (np.max(intensities) - np.min(intensities))
            # intensities = intensities ** 0.1
            # intensities = np.maximum(0, intensities - 0.5)
            coloring = intensities[mask]

        return points, coloring, mask

    @staticmethod
    def map_points_to_image(points: np.array,
                            extrinsic: np.array,
                            intrinsic: np.array):
        """
            points: (?, 3), fields: x,y,z
        """
        pcd_arr = Projector.cart2hom(points[:, :3])  # n,4
        pts_in_cam = np.matmul(pcd_arr, extrinsic)
        points = Projector.view_points(
            pts_in_cam.T[:3, :], intrinsic, normalize=True)
        return points.T

    @staticmethod
    def xyz_to_uv(xyz: np.array, min_p, max_p, pixel_unit=1.0):
        """
        """
        (x_min, y_min), (x_max, y_max) = min_p, max_p
        mask1 = np.logical_and(xyz[:, 0] >= x_min, xyz[:, 0] <= x_max)
        mask2 = np.logical_and(xyz[:, 1] >= y_min, xyz[:, 1] <= y_max)
        mask = np.logical_and(mask1, mask2)

        arr = xyz[mask]
        arr[:, 0] = arr[:, 0] - x_min
        arr[:, 1] = arr[:, 1] - y_min

        arr[:, 0] = arr[:, 0] * 1000 / pixel_unit
        arr[:, 1] = arr[:, 1] * 1000 / pixel_unit

        arr = np.round(arr).astype(np.int64)

        return mask, arr
