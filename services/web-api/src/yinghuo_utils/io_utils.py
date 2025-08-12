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
utils
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-14"

import os
from datetime import datetime
import pandas as pd
import numpy as np
import json
from scipy.spatial.transform import Rotation as R
from PIL import Image


def encode_pil_img_to_base64(img: Image = None):
    """
    encode image to base64
    """
    import base64
    from io import BytesIO
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    encoded_string = base64.b64encode(buffered.getvalue())
    base64_str = str(encoded_string, "utf-8")
    mimetype = 'image/jpeg'
    return (
        "data:"
        + (mimetype if mimetype is not None else "")
        + ";base64,"
        + base64_str
    )


def load_time_file(fpn: str = None) -> list:
    """
    """
    assert fpn is not None
    dts = []
    if fpn.endswith(".txt") and 'datetime' in fpn:
        with open(fpn, "rt") as f:
            for line in f.readlines():
                dt = datetime.strptime(line[:-4], "%Y-%m-%d %H:%M:%S.%f")
                dts.append(dt)
    elif fpn.endswith(".txt"):
        with open(fpn, "rt") as f:
            for line in f.readlines():
                dt = datetime.fromtimestamp(float(line))
                dts.append(dt)
    elif fpn.endswith(".csv"):
        #       - columns: timestamp pcd_file_name
        df_ = pd.read_csv(fpn)
        for d in df_['timestamp']:
            dts.append(datetime.fromtimestamp(float(d)))
    else:
        return None

    return dts


def load_pose_to_SE3(pose_fpn: str = None) -> list:
    """
    return: list of 4x4 matrix
    """
    assert pose_fpn is not None

    poses = []
    if pose_fpn.endswith(".txt"):
        with open(pose_fpn) as f:
            while True:
                line = f.readline()
                if not line:
                    break
                pose_SE3 = np.asarray([float(i) for i in line.split(" ")])
                pose_SE3 = np.vstack(
                    (np.reshape(pose_SE3, (3, 4)), np.asarray([0, 0, 0, 1])))
                poses.append(pose_SE3)
    elif pose_fpn.endswith(".tum"):
        # tum pose format: timestamp x y z q_x q_y q_z q_w
        with open(pose_fpn) as f:
            while True:
                line = f.readline()
                if not line:
                    break

                pose_SE3 = np.eye(4, dtype=np.float32)
                fields = np.asarray([float(i) for i in line.split(" ")])
                r = R.from_quat(fields[4:])  # x, y, z, w
                pose_SE3[:3, :3] = r.as_matrix()
                pose_SE3[:3, 3] = fields[1:4]
                poses.append(pose_SE3)
    else:
        poses = None

    return poses


def save_to_json(json_fpn: str = None, data_dict: dict = None):
    class RoundingFloat(float):
        __repr__ = staticmethod(lambda x: format(x, '.3f'))

    json.encoder.c_make_encoder = None
    json.encoder.float = RoundingFloat

    class JEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                                np.int16, np.int32, np.int64, np.uint8,
                                np.uint16, np.uint32, np.uint64)):
                return int(obj)
            elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
                return float(obj)
            elif isinstance(obj, (np.ndarray,)):
                return obj.tolist()
            return json.JSONEncoder.default(self, obj)
    # json.dump(data_dict, open(json_fpn, mode="wt"), cls=NumpyEncoder)
    json_str = json.dumps(data_dict, ensure_ascii=False, cls=JEncoder)
    with open(json_fpn, 'w', encoding='utf-8') as json_file:
        json_file.write(json_str)


def download_http_file(url: str = None, fpn: str = None, overwrite: bool = False):
    """文件下载
    当文件不存在时，下载文件
    当文件大小不一致，下载文件
    Args:
        url (str, optional): _description_. Defaults to None.
        fpn (str, optional): _description_. Defaults to None.
        overwrite (bool, optional): _description_. Defaults to False.
    """
    import httpx
    import rich.progress
    
    if os.path.exists(fpn) and not overwrite:
        # get file size
        file_size = os.path.getsize(fpn)
        with httpx.stream("GET", url, follow_redirects=True) as response:
            total = int(response.headers["Content-Length"])
            
            if total == file_size:
                print(f"{fpn} already exists. Skip downloading.")
                return

    with open(fpn, 'wb') as download_file:
        with httpx.stream("GET", url) as response:
            total = int(response.headers["Content-Length"])

            with rich.progress.Progress(
                "[progress.percentage]{task.percentage:>3.0f}%",
                rich.progress.BarColumn(bar_width=None),
                rich.progress.DownloadColumn(),
                rich.progress.TransferSpeedColumn(),
            ) as progress:
                download_task = progress.add_task("Download", total=total)
                for chunk in response.iter_bytes():
                    download_file.write(chunk)
                    progress.update(download_task, completed=response.num_bytes_downloaded)