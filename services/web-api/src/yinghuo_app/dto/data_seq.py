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
import os
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
import json
import logging
from glob import glob
import pathlib
from pydash import _
from pathlib import Path
from datetime import datetime, timezone

from yinghuo_conf import Conf

class SimpleDataSeq:
    def __init__(self, data_root, seq, streams=[], file_exts=[]):
        """_summary_

        Args:
            data_root (_type_): 本地数据集路径
            seq (_type_): 序列路径
            streams (list, optional): seq下的文件夹. Defaults to [].
        """
        seq = seq.strip("/")
        self.seq = seq
        self.root_dir = pathlib.Path(data_root) / seq
        self.meta_dir = self.root_dir / "_yh_meta"
        self.streams = streams
        
        self.file_exts = file_exts
        logging.info(self.meta_dir)

    def build_stream_meta(self, steam):
        # meta_path = os.path.join(self.meta_dir, f"{steam}.json")
        meta_dict = {
            "openlabel": {
                "metadata": {
                    "schema_version": "1.0.0",
                    "data_format": "simple-directory",
                },
                "frames": {},
            }
        }

        base_d = self.root_dir / (steam.strip("/"))
        images = []
        for ext in self.file_exts:
            images += list(base_d.rglob(f"*{ext}"))
        images.sort()
        for index, img in enumerate(images):
            imgp = str(img)
            _.set(
                meta_dict,
                f"openlabel.frames.{index}",
                {
                    "frame_properties": {
                        "timestamp": index,
                        # "uri": "file://.ring_front_center/data/000000.jpg"
                        "uri": imgp.replace(str(self.root_dir), "").strip("/"),
                    }
                },
            )
        # with open(meta_path, "w") as f:
        #     f.write(json.dumps(meta_dict))
        return meta_dict

    def get_all_subdirectories(self, root_dir):
        """
        递归获取指定目录及其所有子目录的列表

        :param root_dir: 根目录路径
        :return: 所有子目录的列表
        """
        subdirectories = []
        for dirpath, dirnames, filenames in os.walk(root_dir):
            for name in dirnames:
                if not name.startswith("_"):
                    subdirectories.append(os.path.join(dirpath, name))
        return subdirectories

    def build_seq_meta(self):
        stream_dirs = self.get_all_subdirectories(self.root_dir.as_posix())
        streams = [s.replace(str(self.root_dir), "").strip("/") for s in stream_dirs]
        
        filterd_streams = []
        # 根据self.streams 判断是否使用指定的流
        if self.streams is not None and len(self.streams) > 0:
            for s in self.streams:
                if s in streams:
                    filterd_streams.append(s)
            streams = filterd_streams

        # meta_path = os.path.join(self.meta_dir, "meta.json")
        meta_dict = {
            "openlabel": {
                "metadata": {
                    "schema_version": "1.0.0",
                    "data_format": "simple-directory",
                },
                "streams": {},
            }
        }

        stream_meta_dicts = []
        for stream in streams:
            logging.info(f"building meta for stream {stream}")
            _.set(
                meta_dict,
                f"openlabel.streams.{stream}",
                {
                    "type": "camera",
                    "description": "",
                },
            )

            t = self.build_stream_meta(stream)
            stream_meta_dicts.append(t)

        return meta_dict, stream_meta_dicts, streams

        # with open(meta_path, "w") as f:
        #     f.write(json.dumps(meta_dict))

    # async def build_meta(self, redo=False):
    #     os.makedirs(self.meta_dir, exist_ok=True)

    #     if os.path.exists(f"{self.meta_dir}/meta.json"):
    #         if redo:
    #             # 生成meta
    #             self.build_seq_meta()
    #     else:
    #         # 生成meta
    #         self.build_seq_meta()

    @classmethod
    def build_meta_from(cls, job_perform: dict):
        """
        根据给定的 job_perform 字典构建元数据

        Args:
            job_perform (dict): 包含标签规范、数据流和图片 URL 的字典。

        Returns:
            None

        """
        # os.makedirs(self.meta_dir, exist_ok=True)
        # if not os.path.exists(f"{self.meta_dir}/meta.json"):
        stream = job_perform["label_spec"]["data"]["streams"][0]
        # seq meta
        # meta_path = os.path.join(self.meta_dir, "meta.json")
        meta_dict = {
            "openlabel": {
                "metadata": {
                    "schema_version": "1.0.0",
                    "data_format": "simple-directory",
                },
                "streams": {},
            }
        }
        _.set(
            meta_dict,
            f"openlabel.streams.{stream}",
            {
                "type": "camera",
                "description": "",
            },
        )
        # with open(meta_path, "w") as f:
        #     f.write(json.dumps(meta_dict))

        # stream meta
        # meta_path = os.path.join(self.meta_dir, f"{stream}.json")
        stream_meta_dict = {
            "openlabel": {
                "metadata": {
                    "schema_version": "1.0.0",
                    "data_format": "simple-directory",
                },
                "frames": {},
            }
        }

        images = job_perform["label_spec"]["data"]["imageURLs"]
        for index, img in enumerate(images):
            _.set(
                stream_meta_dict,
                f"openlabel.frames.{index}",
                {
                    "frame_properties": {
                        "timestamp": index,
                        "uri": img,
                        "imageName": os.path.basename(img),
                    }
                },
            )
        # with open(meta_path, "w") as f:
        #     f.write(json.dumps(meta_dict))
        return meta_dict, [stream_meta_dict], [stream]

    def get_seq_meta(self):
        return json.load(open(f"{self.meta_dir}/meta.json", "rt"))

    # def get_stream_meta(self, stream: str = None):
    #     data = json.load(open(f"{self.meta_dir}/{stream}.json", "rt"))
    #     for k, v in data["openlabel"]["frames"].items():
    #         uri = _.get(v, "frame_properties.uri")
    #         uri = uri.replace("file://.", f"{Conf.STATIC_FILE_SERVER}/{self.seq}/")
    #         _.set(v, "frame_properties.uri", uri)
    #     return data
