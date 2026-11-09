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

from ..config import Conf
from ..exceptions import BizException

FRAMES_MANIFEST = "_frames.json"
# manifest 帧条目拷入 frame_properties 的键: 显示名 + 患者/检查/序列元数据(T2 DataPanel 分组用)
NAME_KEYS = ("name", "patient", "patientName", "studyDate", "studyUid", "studyDesc",
             "seriesUid", "seriesDesc", "modality", "pairedModality")


def load_frames_manifest(root_dir: pathlib.Path):
    """seq 根下存在 _frames.json 时返回 frames 列表(全局有序,配对结构性保证),否则 None。

    校验: 每帧的 streams 键集合必须完全一致——融合 job 里 ct/pet 帧数错位不可能发生;
    畸形清单直接 400,不让静默错位的 job 落库。
    """
    mf = root_dir / FRAMES_MANIFEST
    if not mf.is_file():
        return None
    try:
        data = json.loads(mf.read_text("utf-8"))
        frames = data["frames"]
        if not isinstance(frames, list) or not frames:
            raise ValueError("frames 必须是非空列表")
        want = None
        for i, entry in enumerate(frames):
            keys = frozenset((entry.get("streams") or {}).keys())
            if not keys:
                raise ValueError(f"帧 {i} 的 streams 为空")
            if want is None:
                want = keys
            elif keys != want:
                raise ValueError(f"帧 {i} 的流集合 {sorted(keys)} 与帧 0 的 {sorted(want)} 不一致")
    except BizException:
        raise
    except Exception as e:
        raise BizException(status=400, statusText=f"帧清单 {mf} 畸形: {e}")
    return frames


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

        manifest = load_frames_manifest(self.root_dir)
        if manifest is not None:
            index = 0
            for entry in manifest:
                uri = (entry.get("streams") or {}).get(steam)
                if not uri:
                    continue
                props = {"timestamp": index, "uri": uri}
                for k in NAME_KEYS:
                    if entry.get(k) is not None:
                        props[k] = entry[k]
                _.set(meta_dict, f"openlabel.frames.{index}", {"frame_properties": props})
                index += 1
            return meta_dict

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
        manifest = load_frames_manifest(self.root_dir)
        if manifest is not None:
            # manifest 存在: 流 = 各帧 streams 键的有序并集,不再依赖目录扫描
            streams = []
            for entry in manifest:
                for s in (entry.get("streams") or {}).keys():
                    if s not in streams:
                        streams.append(s)
        else:
            stream_dirs = self.get_all_subdirectories(self.root_dir.as_posix())
            streams = [s.replace(str(self.root_dir), "").strip("/") for s in stream_dirs]
        
        filterd_streams = []
        # 根据self.streams 判断是否使用指定的流
        if self.streams is not None and len(self.streams) > 0:
            for s in self.streams:
                if s in streams:
                    filterd_streams.append(s)
            streams = filterd_streams

        if manifest is not None and len(streams) < 1:
            raise BizException(status=400,
                               statusText=f"帧清单 {self.root_dir / FRAMES_MANIFEST} 的流与声明的 streams {self.streams} 无交集")

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
        data = job_perform["label_spec"]["data"]
        if data.get("dicomLocal"):
            return cls._build_meta_from_dicom_local(data)
        streams = data["streams"]
        images = data["imageURLs"]

        if len(streams) > 1:
            # 多流(如 PET/CT):URL 按倒数第二段路径分组,如 .../ct/vol1.nrrd → stream "ct"
            grouped = {}
            for img in images:
                parts = img.replace("\\", "/").rstrip("/").split("/")
                if len(parts) < 2:
                    raise BizException(status=400, statusText=f"多流数据 URL 缺少流目录段: {img}")
                grouped.setdefault(parts[-2], []).append(img)

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
            used_streams = []
            for stream in streams:
                imgs = grouped.get(stream)
                if not imgs:
                    continue
                _.set(
                    meta_dict,
                    f"openlabel.streams.{stream}",
                    {
                        "type": "camera",
                        "description": "",
                    },
                )
                stream_meta_dict = {
                    "openlabel": {
                        "metadata": {
                            "schema_version": "1.0.0",
                            "data_format": "simple-directory",
                        },
                        "frames": {},
                    }
                }
                for index, img in enumerate(imgs):
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
                stream_meta_dicts.append(stream_meta_dict)
                used_streams.append(stream)

            unknown = set(grouped.keys()) - set(used_streams)
            if unknown:
                raise BizException(status=400, statusText=f"URL 中的流目录 {sorted(unknown)} 不在声明的 streams {streams} 里")
            return meta_dict, stream_meta_dicts, used_streams

        stream = streams[0]
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

    @classmethod
    def _build_meta_from_dicom_local(cls, data: dict):
        """本地 DICOM job(浏览器直读): 帧元数据全部来自 label_spec.data.dicomFrames,
        uri 用 dicom://<seriesUid> 占位(localImage 流从不调 file2/get,运行时重选目录装配)。"""
        streams = data["streams"]
        frames = data.get("dicomFrames") or []
        if not isinstance(frames, list) or not frames:
            raise BizException(status=400, statusText="dicomLocal 任务缺少 dicomFrames")
        used = set()
        for i, entry in enumerate(frames):
            keys = frozenset((entry.get("streams") or {}).keys())
            if not keys or any(not str(entry["streams"][s]).strip() for s in keys):
                raise BizException(status=400, statusText=f"dicomFrames 帧 {i} 的 streams 为空")
            extra = sorted(keys - set(streams))
            if extra:
                raise BizException(status=400,
                                   statusText=f"dicomFrames 帧 {i} 的流 {extra} 不在声明的 streams {streams} 里")
            used |= keys
        # 未配对帧只有 ct(合法);但声明的流必须至少出现在一帧里
        missing = [s for s in streams if s not in used]
        if missing:
            raise BizException(status=400,
                               statusText=f"声明的 streams {missing} 不在 dicomFrames 里")

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
            _.set(meta_dict, f"openlabel.streams.{stream}", {"type": "camera", "description": ""})
            stream_meta_dict = {
                "openlabel": {
                    "metadata": {
                        "schema_version": "1.0.0",
                        "data_format": "simple-directory",
                    },
                    "frames": {},
                }
            }
            for index, entry in enumerate(frames):
                uid = (entry.get("streams") or {}).get(stream)
                if not uid:
                    # 未配对帧没有 pet 等:按主数组索引稀疏对齐,保证两流帧 N 指向同一 dicomFrames 条目
                    continue
                props = {"timestamp": index, "uri": f"dicom://{uid}"}
                for k in NAME_KEYS:
                    if entry.get(k) is not None:
                        props[k] = entry[k]
                _.set(stream_meta_dict, f"openlabel.frames.{index}", {"frame_properties": props})
            stream_meta_dicts.append(stream_meta_dict)
        return meta_dict, stream_meta_dicts, list(streams)

    # def get_stream_meta(self, stream: str = None):
    #     data = json.load(open(f"{self.meta_dir}/{stream}.json", "rt"))
    #     for k, v in data["openlabel"]["frames"].items():
    #         uri = _.get(v, "frame_properties.uri")
    #         uri = uri.replace("file://.", f"{Conf.STATIC_FILE_SERVER}/{self.seq}/")
    #         _.set(v, "frame_properties.uri", uri)
    #     return data
