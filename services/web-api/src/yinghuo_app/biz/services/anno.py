import json
import sys
from typing import List
from bson import ObjectId
from datetime import datetime, timezone

import numpy as np
if sys.version_info >= (3, 11):
    from datetime import UTC
else:
    from datetime import timezone
    UTC = timezone.utc
import os
from pydash import _
import openlabel.models.utils as ol_utils
from ...config import Conf, settings
from ...exceptions import BizException
from .job import job_service
from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from yinghuo_app.biz.services import job_meta
from .user import user_service
from openlabel import OpenLabel

class AnnoService(object):
    def __init__(self):
        pass
    
    def anno_val_to_file(self, anno:dict, user_id:int = -1, seq=''):
        if 'val' not in anno:
            return
        
        if 'label_uuid' not in anno:
            anno['label_uuid'] = str(ObjectId())
        
        label_uuid = anno['label_uuid']
        full_file_path = f"{settings.YH_USER_DATA_ROOT}/{user_id}/{seq}/_yh_output/anno_vals/{label_uuid}.json"
        if not os.path.exists(os.path.dirname(full_file_path)):
            os.makedirs(os.path.dirname(full_file_path), exist_ok=True)
        with open(full_file_path, 'w') as fp:
            json.dump(anno['val'], fp)
            
        anno['val'] = []
        anno['val_ref'] = label_uuid
    
    def load_val(self, user_id:int, job_seq, label_uuid:str):
        full_file_path = f"{settings.YH_USER_DATA_ROOT}/{user_id}/{job_seq}/_yh_output/anno_vals/{label_uuid}.json"
        if not os.path.exists(full_file_path):
            return None
        return json.loads(open(full_file_path, mode="r", encoding='utf8').read())
    
    async def import_annos(self, user_id=0, mission='', seq='', stream='', frame_ts=0, 
                      job_uuid='', frame_objects = [], clear=False):
        """
        从本地json文件导入到mongodb
        """
        assert user_id > 0, "user_id must be greater than 0"
        assert mission in Conf.MG_COLLECTION.keys(), "mission not corrent"
        assert len(frame_objects) > 0, "frame_objects must be not empty"
        
        if not ObjectId.is_valid(job_uuid):
            raise BizException(statusText="job uuid error")
        
        job_doc = job_service.can_user_see_job(user_id, job_uuid)
        if job_doc is None:
            raise BizException(statusText="没有权限")
        
        collection = Conf.MG_COLLECTION[mission]
        query = {
            "jobConfig.uuid": job_uuid,# job id
            "jobConfig.seq": seq,
            "jobConfig.stream": stream,
            "jobConfig.frame": frame_ts,
            # "authority.owner": user_id,
        }
        if clear:
            result = collection.delete_many(query)
            if not result.acknowledged:
                raise BizException(statusText="clear frame anno failed", status=500)
        
        # 如果collection中没有这个frame的数据，则创建一个新的
        frame_anno_id = None
        frame_anno_doc = collection.find_one(query)
        if frame_anno_doc is None:
            res = collection.insert_one({
                "jobConfig": {
                    "seq": seq,
                    "stream": stream,
                    "uuid": job_uuid,
                    "frame": frame_ts,
                },
                "frame_labels": {},
                "update_time": datetime.now(UTC),
                "authority": {'owner': user_id},
            })
            if not res.acknowledged:
                raise BizException(statusText="save frame anno failed", status=500)
            # frame_anno_id = res.inserted_id
            frame_anno_doc = collection.find_one(query)
            
        frame_anno_id = frame_anno_doc['_id']
        
        # 开始更新 数据
        update_query = {
            "_id": frame_anno_id,
        }
        
        updates = {}
        for o in frame_objects:
            if 'label_uuid' not in o or o['label_uuid'].strip() == '':
                o['label_uuid'] = str(ObjectId())
            
            if mission in Conf.TO_FILE_ANNO:
                self.anno_val_to_file(o, user_id, seq)
            
            label_uuid = o['label_uuid']
            if label_uuid in frame_anno_doc['frame_labels']:
                old_ann = frame_anno_doc['frame_labels'][f'{label_uuid}']
                o['op_log'] = old_ann.get('op_log', []) + [{
                    'user': user_id,
                    'time': datetime.now(UTC),
                    'action': 'import',
                }]
            else:
                o['op_log'] = [{
                    'user': user_id,
                    'time': datetime.now(UTC),
                    'action': 'import',
                }]
            updates[f'frame_labels.{label_uuid}'] = o    
            
        result = collection.update_one(update_query, {
            "$set": updates
        })
        
        if not result.acknowledged:
            raise BizException(statusText="save frame anno failed", status=500)
        
        return

    def coco_build_images(self, stream_labels:dict):
        """
        "images": [{
            "id": 397133,
            "file_name": "000000397133.jpg",
            "height": 480,
            "width": 640,
        }]
        """
        start_id = 10000
        stream_index = 0
        
        images = []
        for stream, v in stream_labels.items():
            stream_meta = v["stream_meta"]
            stream_label_docs = v["stream_labels"]
            
            image_info_from_anno = {}
            for doc in stream_label_docs:
                img_id = doc["jobConfig"]['frame']
                image_info = doc.get("frame_properties", {})
                image_info_from_anno[img_id] = image_info
            
            for img_k, img_info in stream_meta["openlabel"]["frames"].items():
                img = {}
                img_id = int(img_k)
                img["id"] = start_id + img_id
                img["file_name"] = img_info["frame_properties"]["uri"]
                img["timestamp"] = img_info["frame_properties"]["timestamp"]
                img["width"] = 1
                img["height"] = 1
                
                if img_id in image_info_from_anno:
                    img["height"] = image_info_from_anno[img_id].get("height", -1)
                    img["width"] = image_info_from_anno[img_id].get("width", -1)
                
                images.append(img)
            
            stream_index += 1
            start_id = start_id * stream_index
        
        return images
    
    def coco_build_anno(self, anno, ol_anno:dict):
        if ol_anno is None:
            return anno
        
        anno["attributes"].update(
            {
                "ol_type_": ol_anno['ol_type_'],
                "label_uuid": ol_anno['label_uuid'],
                "object_type": ol_anno['object_type'],
                "object_uuid": ol_anno.get('object_uuid', ''),
                "label_id": ol_anno.get('label_id', ''),
            }
        )
        
        if ol_anno['ol_type_'] == 'BBox':
            cx, cy, w, h = ol_anno['val']
            x1, y1 = cx - w / 2, cy - h / 2
            anno["bbox"] = [x1, y1, w, h]
        elif ol_anno['ol_type_'] == 'RBBox':
            anno["segmentation"] = ol_anno['val']
        elif ol_anno['ol_type_'] == 'Poly2d':
            anno["iscrowd"] = 0
            # 从poly2d找到bbox
            arr = np.array(ol_anno['val']).astype(np.int32).reshape(-1, 2)
            anno["segmentation"] = [ol_anno['val']]
            xmin, xmax = np.min(arr[:, 0]), np.max(arr[:, 0])
            ymin, ymax = np.min(arr[:, 1]), np.max(arr[:, 1])
            bbox = [int(e) for e in [xmin, ymin, xmax - xmin, ymax - ymin]]
            anno["bbox"] = bbox
        elif ol_anno['ol_type_'] == 'Mask2dBase64':
            mask, bbox = ol_utils.ol_mask2dbase64_to_mask(ol_anno)
            anno["iscrowd"] = 1
            anno["segmentation"] = ol_utils.mask_to_rle(mask)
            anno["attributes"].update(ol_anno['attributes'])
            anno["attributes"]["ol_type_"] = "Mask2dRle"
            bbox = [int(e) for e in bbox]
            anno["bbox"] = bbox
        elif ol_anno['ol_type_'] == 'Mask2dRle':
            anno["iscrowd"] = 1
            anno["segmentation"] = {
                "size": ol_anno['attributes']['image_shape'],
                "counts": ol_anno['val'],
            }
            anno["attributes"].update(ol_anno['attributes'])
        return anno
    
    def coco_build_annotations(self, job, stream_labels:dict, categories_map:dict):
        """
        "annotations": [
            {
                "segmentation": [[510.66,423.01,511.72]],
                "area": 702.1057499999998,
                "iscrowd": 0,
                "image_id": 289343,
                "bbox": [473.07,395.93,38.65,28.67],
                "category_id": 18,
                "id": 1768
            }
        ]
        """
        job_owner_id = job['authority']['owners'][0]
        job_seq = job["label_spec"]["data"]["seq"]
        
        start_id = 10000
        stream_index = 0
        
        anno_id = 1
        annotations = []
        for stream, v in stream_labels.items():
            stream_label_docs = v["stream_labels"]
            
            for doc in stream_label_docs:
                frame_id = doc["jobConfig"]['frame']
                frame_labels = doc["frame_labels"]
                for k, ol_anno in frame_labels.items():
                    
                    if ol_anno.get("val_ref", None) is not None:
                        val_ref = ol_anno["val_ref"]
                        ol_anno['val'] = self.load_val(job_owner_id, job_seq, val_ref)
                    anno = {
                        "id": anno_id,
                        "image_id": start_id + frame_id,
                        "category_id": categories_map.get(ol_anno['object_type'], -1),
                        
                        "segmentation": [],
                        "bbox": [],
                        "iscrowd": 0,
                        "attributes": {},
                    }
                    self.coco_build_anno(anno, ol_anno)
                    annotations.append(anno)
                    
                    anno_id = anno_id + 1
            
            stream_index += 1
            start_id = start_id * stream_index
            
        return annotations
    
    def coco_build_info(self):
        info = {
            "url": "https://www.geluzhiwei.com/",
            "version": "1.0",
            "contributor": "",
            "date_created": datetime.now().isoformat(),
            "description": "COCO格式导出的标注结果",
        }
        return info
    
    async def export_collection_to_coco(self, job, seq_meta, stream_labels:dict=None):
        anno_coco_format = {
            "licence": [],
        }
        is_user_spec = job["label_spec"]["taxonomy"].get("type", None) == 'user'
        if is_user_spec:
            spec_key = job["label_spec"]["taxonomy"]["key"]
            query = {"_id": ObjectId(spec_key)}
            rows = Conf.MG_DATA_ANNO_SPEC.find(query)
            rows = list(rows)
            j = OpenLabel.from_json(json.loads(rows[0]["spec"]))
        else:
            spec_key = job["label_spec"]["taxonomy"]["key"]
            spec_domain = job["label_spec"]["taxonomy"]["domain"]
            j = OpenLabel.from_taxonomy_key(spec_key, spec_domain)
        categories, class_name_id_map = j.get_class_tree()
        class_id_map  = {}
        for k, v in class_name_id_map.items():
            class_id_map[v] = k
        categories = [{"id": p['id'], "name": p["name"], "supercategory": class_id_map[p["parent"]] if p["parent"] is not None else None} for p in categories]
        categories.insert(0, {"id": -1, "name": "ignore", "supercategory": None})
        
        anno_coco_format["info"] = self.coco_build_info()
        anno_coco_format["categories"] = categories
        anno_coco_format["images"] = self.coco_build_images(stream_labels)
        anno_coco_format["annotations"] = self.coco_build_annotations(job, stream_labels, class_name_id_map)
        
        return anno_coco_format
        
    async def export_to_coco(self, job_uuid:str = None):
        
        assert job_uuid is not None
        
        query1 = {}
        query1["_id"] = ObjectId(job_uuid)

        collection = Conf.MG_ANNO_JOB_PERFORM
        _rows = collection.find(query1)
        jobs = list(_rows)
        if len(jobs) == 0:
            return None
        
        job = jobs[0]
        
        seq_meta = job_meta.find_seq_meta(job_uuid)
        if seq_meta is None:
            return None
        
        mission = job["label_spec"]["mission"]["key"]
        streams = job["label_spec"]['data']["streams"]
        data_source = _.get(job, "label_spec.data.data_source", None) # job[""]['data']["data_source"]
        job_seq = job["label_spec"]["data"]["seq"]
        
        stream_labels = {}
        for stream in streams:
            stream_meta = job_meta.find_stream_meta(job_uuid, stream, data_source, seq=job_seq)
            
            # 一个job,多个stream
            query = {
                "jobConfig.uuid": str(job["_id"]),
                "jobConfig.stream": stream,
            }
            print(mission, query)
            _rtn = Conf.MG_COLLECTION[mission].find(query)
            datas = mongo_json_encoder(list(_rtn))
            
            stream_labels[stream] = {
                "stream_labels": datas,
                "stream_meta": stream_meta
            }
            
        return await self.export_collection_to_coco(job, seq_meta, stream_labels)

    def _load_job(self, job_uuid: str):
        if not ObjectId.is_valid(job_uuid):
            raise BizException(statusText="job uuid 错误")
        job = Conf.MG_ANNO_JOB_PERFORM.find_one({"_id": ObjectId(job_uuid)})
        if job is None:
            raise BizException(statusText="任务不存在")
        return mongo_json_encoder(job)

    def _resolve_categories(self, job: dict):
        """从 job.label_spec.taxonomy 解析出 categories 列表与 class_name_id_map"""
        taxonomy = _.get(job, "label_spec.taxonomy", {})
        spec_key = taxonomy.get("key")
        if not spec_key:
            return [], {}
        if taxonomy.get("type") == "user":
            rows = list(Conf.MG_DATA_ANNO_SPEC.find({"_id": ObjectId(spec_key)}))
            if not rows:
                return [], {}
            j = OpenLabel.from_json(json.loads(rows[0]["spec"]))
        else:
            spec_domain = taxonomy.get("domain")
            j = OpenLabel.from_taxonomy_key(spec_key, spec_domain)
        categories_tree, class_name_id_map = j.get_class_tree()
        class_id_map = {v: k for k, v in class_name_id_map.items()}
        categories = [
            {
                "id": p["id"],
                "name": p["name"],
                "supercategory": class_id_map.get(p["parent"]) if p.get("parent") is not None else None,
            }
            for p in categories_tree
        ]
        return categories, class_name_id_map

    def _collect_anno_rows(self, job_uuid: str, mission: str, scope: str,
                           seq: str = "", stream: str = "", frame=None):
        if mission not in Conf.MG_COLLECTION:
            raise BizException(statusText="不支持的任务类型")
        collection = Conf.MG_COLLECTION[mission]
        query = {"jobConfig.uuid": job_uuid}
        if scope == "currentFrame":
            if not seq or not stream or frame is None:
                raise BizException(statusText="参数错误")
            query["jobConfig.seq"] = seq
            query["jobConfig.stream"] = stream
            query["jobConfig.frame"] = frame
        else:  # currentTask
            if seq:
                query["jobConfig.seq"] = seq
            if stream:
                query["jobConfig.stream"] = stream
        rows = list(collection.find(query))
        return mongo_json_encoder(rows)

    def _row_image_size(self, row: dict):
        """从 anno doc 里尝试拿到 (width, height)"""
        fp = row.get("frame_properties", {}) or {}
        w = fp.get("width")
        h = fp.get("height")
        if w and h:
            return int(w), int(h)
        for v in (row.get("frame_labels", {}) or {}).values():
            shape = _.get(v, "attributes.image_shape")
            if isinstance(shape, list) and len(shape) == 2 and shape[0] and shape[1]:
                return int(shape[0]), int(shape[1])
        return None, None

    def export_to_coco_v2(self, job_uuid: str, mission: str, scope: str,
                          seq: str = "", stream: str = "", frame=None):
        """按 scope 导出 COCO 字典"""
        job = self._load_job(job_uuid)
        rows = self._collect_anno_rows(job_uuid, mission, scope, seq, stream, frame)
        categories, class_name_id_map = self._resolve_categories(job)

        images, image_id_set = [], set()
        annotations = []
        anno_id = 1
        for row in rows:
            frame_id = _.get(row, "jobConfig.frame")
            try:
                frame_id_int = int(frame_id)
            except (TypeError, ValueError):
                frame_id_int = frame_id
            w, h = self._row_image_size(row)
            image_info = row.get("frame_properties", {}) or {}
            image = {
                "id": frame_id_int,
                "file_name": os.path.basename(image_info.get("uri") or "") or f"{frame_id}.jpg",
                "width": w if w else -1,
                "height": h if h else -1,
            }
            if frame_id_int not in image_id_set:
                images.append(image)
                image_id_set.add(frame_id_int)

            for _, ol_anno in (row.get("frame_labels", {}) or {}).items():
                if ol_anno is None or ol_anno.get("is_removed"):
                    continue
                if ol_anno.get("val_ref") is not None and "val" not in ol_anno:
                    val_ref = ol_anno["val_ref"]
                    job_owner_id = job["authority"]["owners"][0]
                    job_seq = job["label_spec"]["data"]["seq"]
                    ol_anno = dict(ol_anno)
                    ol_anno["val"] = self.load_val(job_owner_id, job_seq, val_ref)
                anno = {
                    "id": anno_id,
                    "image_id": frame_id_int,
                    "category_id": class_name_id_map.get(ol_anno.get("object_type", ""), -1),
                    "segmentation": [],
                    "bbox": [],
                    "iscrowd": 0,
                    "attributes": {},
                }
                self.coco_build_anno(anno, ol_anno)
                annotations.append(anno)
                anno_id += 1

        return {
            "info": self.coco_build_info(),
            "licenses": [],
            "categories": categories,
            "images": images,
            "annotations": annotations,
        }

    def export_to_yolo(self, job_uuid: str, mission: str, scope: str,
                       seq: str = "", stream: str = "", frame=None):
        """按 scope 导出 YOLO zip 字节流。

        Returns:
            (zip_bytes, file_name)
        """
        import zipfile
        from io import BytesIO

        job = self._load_job(job_uuid)
        rows = self._collect_anno_rows(job_uuid, mission, scope, seq, stream, frame)
        categories, class_name_id_map = self._resolve_categories(job)
        id_name_map = {cid: name for name, cid in class_name_id_map.items()}

        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            yaml_lines = [
                f"path: ./{scope}",
                "train: images",
                "val: images",
                f"nc: {len(class_name_id_map)}",
                "names:",
            ]
            for cid in sorted(id_name_map.keys()):
                yaml_lines.append(f"  {cid}: {id_name_map[cid]}")
            zf.writestr("data.yaml", "\n".join(yaml_lines) + "\n")

            seen_frames = set()
            for row in rows:
                frame_id = _.get(row, "jobConfig.frame")
                try:
                    frame_id_int = int(frame_id)
                except (TypeError, ValueError):
                    continue
                w, h = self._row_image_size(row)
                if not w or not h:
                    continue
                lines = []
                for _, ol_anno in (row.get("frame_labels", {}) or {}).items():
                    if ol_anno is None or ol_anno.get("is_removed"):
                        continue
                    if ol_anno.get("ol_type_") != "BBox":
                        continue
                    val = ol_anno.get("val") or []
                    if len(val) != 4:
                        continue
                    cx, cy, bw, bh = val
                    cid = class_name_id_map.get(ol_anno.get("object_type", ""))
                    if cid is None:
                        continue
                    lines.append(
                        f"{cid} {cx / w:.6f} {cy / h:.6f} {bw / w:.6f} {bh / h:.6f}"
                    )
                fname = f"labels/{frame_id_int}.txt"
                if fname in seen_frames:
                    continue
                seen_frames.add(fname)
                zf.writestr(fname, "\n".join(lines) + ("\n" if lines else ""))

        tail = f"{job_uuid}"
        if scope == "currentFrame":
            try:
                tail = f"{int(frame)}"
            except (TypeError, ValueError):
                pass
        return buf.getvalue(), f"yolo_{scope}_{tail}.zip"

    def export_volume_seg(self, job_uuid: str, mission: str, scope: str, fmt: str,
                          seq: str = "", stream: str = "", frame=None):
        """体数据分割导出。

        SegNrrd: zip(series/*.nii.gz 每序列全部 segment 合并为一个多标签
                  NIfTI + contours.json manifest, 3D Slicer 可直接载入),
                  ZIP_STORED(内容已 gzip)
        VolumeJSON: 仅 contours manifest(dict)

        Returns:
            fmt == 'VolumeJSON' → dict;否则 (zip_bytes, file_name)
        """
        if mission != "volumeSegment3d":
            raise BizException(statusText="仅支持 volumeSegment3d 任务")

        job = self._load_job(job_uuid)
        rows = self._collect_anno_rows(job_uuid, mission, scope, seq, stream, frame)
        job_owner_id = job["authority"]["owners"][0]
        job_seq = job["label_spec"]["data"]["seq"].strip("/")
        mask_dir = f"{settings.YH_USER_DATA_ROOT}/{job_owner_id}/{job_seq}/_yh_output/anno_masks"

        manifest = {
            "schema": "yinghuo.volumeSeg/1",
            "job": {"uuid": job_uuid, "seq": job_seq, "mission": mission},
            "frames": [],
        }
        series_files = []  # [(zip 内路径, nii.gz bytes)] — 每序列一份多标签 NIfTI
        frames_meta = _.get(job, "label_spec.data.dicomFrames") or []
        for row in rows:
            frame_entry = {
                "stream": _.get(row, "jobConfig.stream"),
                "frame": _.get(row, "jobConfig.frame"),
                "frame_properties": row.get("frame_properties") or {},
                "segments": [],
            }
            series_masks = []  # [(磁盘路径, segment 名)] — 该序列参与合并的段
            for label_uuid, ol_anno in (row.get("frame_labels", {}) or {}).items():
                if ol_anno is None or ol_anno.get("is_removed"):
                    continue
                seg_entry = {
                    "label_uuid": label_uuid,
                    "object_type": ol_anno.get("object_type"),
                    "object_id": ol_anno.get("object_id"),
                    "attributes": ol_anno.get("attributes"),
                    "val": ol_anno.get("val"),
                }
                val_ref = ol_anno.get("val_ref")
                if val_ref:
                    seg_entry["val_ref"] = val_ref
                    if fmt == "SegNrrd":
                        p = f"{mask_dir}/{val_ref}.seg.nrrd.gz"
                        if os.path.exists(p):
                            series_masks.append((p, _.get(ol_anno, "attributes.name")))
                            seg_entry["label_value"] = len(series_masks)
                        else:
                            seg_entry["mask_missing"] = True
                frame_entry["segments"].append(seg_entry)
            if fmt == "SegNrrd" and series_masks:
                frame_val = _.get(row, "jobConfig.frame")
                zip_name = _series_zip_name(frames_meta, frame_val)
                uid_meta = _series_uid_meta(frames_meta, frame_val)
                try:
                    blob = merge_series_nifti(
                        [p for p, _n in series_masks],
                        list(range(1, len(series_masks) + 1)),
                    )
                    series_files.append((zip_name, blob))
                    frame_entry["series_file"] = zip_name
                    frame_entry.update(uid_meta)
                except (OSError, ValueError):
                    pass  # mask 损坏/网格不一致 → 该序列只保留 masks/ 单段文件
            manifest["frames"].append(frame_entry)

        if fmt == "VolumeJSON":
            return manifest

        import zipfile
        from io import BytesIO
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
            zf.writestr("contours.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            for zip_name, blob in series_files:
                zf.writestr(zip_name, blob)

        tail = f"{job_uuid}"
        if scope == "currentFrame":
            try:
                tail = f"{int(frame)}"
            except (TypeError, ValueError):
                pass
        return buf.getvalue(), f"volume_seg_{scope}_{tail}.zip"

    def import_volume_seg(self, job_uuid: str, mission: str, zip_bytes: bytes,
                          mode: str = "skip", stream: str = "ct"):
        """体数据分割批量导入(export SegNrrd zip 回导 / NIfTI labelmap)。

        zip 内 series/*.seg.nrrd(.gz) 或 *.nii(.gz)(根级 nii 也可)逐文件路由:
        series_uid(NRRD 头)→ manifest 帧号 → 文件名患者 ID 唯一命中(nii)→
        几何(帧文件头比对, LPS/RAS 按帧 space 约定, 唯一命中才收)。
        patient 不一致 / 网格不一致 → 跳过不写。命中帧按 B3 预标注同款落盘
        (mask 文件 + label 文档, contours 留空 mask 为准)。
        mode: skip(帧已有标注 → skipped_existing)/ overwrite(整帧替换, 删旧 mask)。

        Returns: {"results": [{file, frame, patient, matched_by, segments, voxels, action}...],
                  "imported": n, "skipped": m}
        """
        import zipfile, tempfile, gzip, io
        from datetime import datetime, timezone as _tz
        from .volume_pre_annotate import PALETTE
        from ...apps.label_app import _volume_frame_file

        if mission != "volumeSegment3d":
            raise BizException(statusText="仅支持 volumeSegment3d 任务")
        if mode not in ("skip", "overwrite"):
            raise BizException(statusText="mode 必须是 skip 或 overwrite")

        job = self._load_job(job_uuid)
        owner_id = job["authority"]["owners"][0]
        job_seq = job["label_spec"]["data"]["seq"].strip("/")
        data = job["label_spec"]["data"]
        collection = Conf.MG_COLLECTION[mission]

        frames_meta = data.get("dicomFrames") or []
        stream_meta = job_meta.find_stream_meta(
            job_uuid, stream, data.get("dataSource", ""), seq=job["label_spec"]["data"]["seq"])
        frames = []
        for k in ((stream_meta or {}).get("openlabel", {}).get("frames", {}) or {}).keys():
            try:
                frames.append(int(k))
            except (TypeError, ValueError):
                continue
        frames.sort()
        if not frames and frames_meta:
            frames = list(range(len(frames_meta)))  # dicomLocal: 服务端无 stream meta

        results, imported, skipped = [], 0, 0
        written_frames = set()

        with tempfile.TemporaryDirectory(prefix="yh_import_") as tmp:
            try:
                zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
                zf.extractall(tmp)
            except zipfile.BadZipFile:
                raise BizException(statusText="不是有效的 zip 文件")
            names = zf.namelist()

            manifest = {}  # series_file → {frame, patient, study_uid, series_uid, seg_attrs{label_value→attrs}}
            if "contours.json" in names:
                try:
                    mf = json.loads(open(f"{tmp}/contours.json", encoding="utf-8").read())
                    for fr in mf.get("frames", []):
                        if not fr.get("series_file"):
                            continue
                        seg_attrs = {}
                        for s in fr.get("segments", []):
                            lv = s.get("label_value")
                            seg_attrs[lv] = {"name": _.get(s, "attributes.name"),
                                             "color": _.get(s, "attributes.color"),
                                             "object_type": s.get("object_type")}
                        manifest[fr["series_file"]] = {
                            "frame": fr.get("frame"), "patient": fr.get("patient"),
                            "study_uid": fr.get("study_uid"), "series_uid": fr.get("series_uid"),
                            "seg_attrs": seg_attrs,
                        }
                except (OSError, ValueError):
                    manifest = {}

            def _is_import_series(n: str) -> bool:
                low = n.lower()
                if low.endswith((".nii", ".nii.gz")):
                    return n.startswith("series/") or "/" not in n
                return n.startswith("series/") and low.endswith((".seg.nrrd.gz", ".seg.nrrd"))

            series_names = sorted(n for n in names if _is_import_series(n))
            if not series_names:
                raise BizException(
                    statusText="zip 内无 series/*.seg.nrrd(.gz) 或 NIfTI .nii(.gz) 分割文件")

            grid_cache = {}  # frame → grid or None

            def frame_grid(f):
                if f not in grid_cache:
                    grid_cache[f] = read_frame_grid(_volume_frame_file(job, job_uuid, stream, f) or "")
                return grid_cache[f]

            for fname in series_names:
                base = {"file": fname, "frame": None, "patient": "",
                        "matched_by": None, "segments": 0, "voxels": 0}
                low = fname.lower()
                is_nii = low.endswith(".nii") or low.endswith(".nii.gz")
                try:
                    parsed = (parse_series_nifti(f"{tmp}/{fname}") if is_nii
                              else parse_series_nrrd(f"{tmp}/{fname}"))
                except (OSError, ValueError, KeyError) as e:
                    results.append({**base, "action": "parse_error", "detail": str(e)[:120]})
                    skipped += 1
                    continue
                mf = manifest.get(fname) or {}
                base["patient"] = str(parsed["fields"].get("patient") or mf.get("patient") or "")

                # ── 路由: series_uid → manifest 帧号 → 几何唯一命中 ──
                uid = str(parsed["fields"].get("series_uid") or mf.get("series_uid") or "").strip()
                frame_idx, how = None, None
                if uid:
                    for i, e in enumerate(frames_meta):
                        if str((e or {}).get("seriesUid") or "") == uid:
                            frame_idx, how = i, "series_uid"
                            break
                if frame_idx is None:
                    try:
                        mf_frame = int(mf.get("frame"))
                    except (TypeError, ValueError):
                        mf_frame = None
                    if mf_frame is not None and mf_frame in frames:
                        frame_idx, how = mf_frame, "manifest"
                if frame_idx is None and is_nii:
                    # NIfTI 无内嵌 uid; 文件名患者 ID(如 P001041285.nii.gz)唯一命中时路由
                    stem = os.path.basename(fname)
                    for suf in (".nii.gz", ".nii"):
                        if stem.lower().endswith(suf):
                            stem = stem[: -len(suf)]
                            break
                    stem = stem.strip()
                    base["patient"] = stem
                    p_hits = [i for i, e in enumerate(frames_meta)
                              if stem and str((e or {}).get("patient") or "") == stem]
                    stem_known = bool(p_hits)
                    if len(p_hits) == 1:
                        frame_idx, how = p_hits[0], "patient"
                    elif len(p_hits) > 1:
                        # dicomLocal 等无服务端帧几何的 job, 同名患者多帧时
                        # 用导入流的切片数(instanceCounts)消歧, 唯一命中才路由
                        z = parsed["sizes"][2]
                        c_hits = [i for i in p_hits
                                  if frame_grid(i) is None
                                  and int(((frames_meta[i] or {}).get("instanceCounts") or {}).get(stream) or -1) == z]
                        if len(c_hits) == 1:
                            frame_idx, how = c_hits[0], "patient+slices"
                else:
                    stem_known = False

                if frame_idx is None:
                    if is_nii:
                        hits = []
                        for f in frames:
                            fg = frame_grid(f)
                            if fg is None:
                                continue
                            fspace = str(fg[3] or "")
                            cands = ([c for c in parsed["candidates"]
                                      if c[0].startswith(fspace[:5])]
                                     if fspace.startswith(("left", "right"))
                                     else parsed["candidates"])
                            if any(grids_equal(fg, (parsed["sizes"], parsed["spacing"], c[1]))
                                   for c in cands):
                                hits.append(f)
                    else:
                        src_grid = (parsed["sizes"], parsed["spacing"], parsed["origin"])
                        hits = [f for f in frames
                                if grids_equal(frame_grid(f), src_grid)]
                    if len(hits) == 1:
                        frame_idx, how = hits[0], "geometry"
                    elif len(hits) > 1:
                        results.append({**base, "action": "skipped", "detail": f"几何命中 {len(hits)} 帧,无法唯一路由"})
                        skipped += 1
                        continue
                if frame_idx is None:
                    results.append({**base, "action": "skipped", "detail": "未匹配到帧(uid/manifest/几何均无命中)"})
                    skipped += 1
                    continue
                base["frame"], base["matched_by"] = frame_idx, how

                # ── patient 校验: 源患者 ≠ 目标帧患者 → 拒绝 ──
                # (NIfTI 文件名 stem 仅在确为本 job 已知患者 ID 时才作准)
                tgt_patient = ""
                if 0 <= frame_idx < len(frames_meta):
                    tgt_patient = str((frames_meta[frame_idx] or {}).get("patient") or "")
                if not (is_nii and not stem_known) and \
                        base["patient"] and tgt_patient and base["patient"] != tgt_patient:
                    results.append({**base, "action": "skipped",
                                    "detail": f"患者不一致: 文件 {base['patient']} vs 帧 {tgt_patient}"})
                    skipped += 1
                    continue

                # ── 网格校验(服务端有帧文件时; NIfTI 按帧 space 约定选候选) ──
                fg = frame_grid(frame_idx)
                if fg is not None:
                    if is_nii:
                        fspace = str(fg[3] or "")
                        cands = ([c for c in parsed["candidates"] if c[0].startswith(fspace[:5])]
                                 if fspace.startswith(("left", "right")) else parsed["candidates"])
                        grid_ok = any(grids_equal(fg, (parsed["sizes"], parsed["spacing"], c[1]))
                                      for c in cands)
                    else:
                        grid_ok = grids_equal(fg, (parsed["sizes"], parsed["spacing"], parsed["origin"]))
                    if not grid_ok:
                        results.append({**base, "action": "skipped", "detail": "网格与目标帧不一致"})
                        skipped += 1
                        continue

                if frame_idx in written_frames:
                    results.append({**base, "action": "skipped", "detail": "本批次已有文件写入该帧"})
                    skipped += 1
                    continue

                # ── 既有标注处理 ──
                query = {"jobConfig.uuid": job_uuid, "jobConfig.stream": stream,
                         "jobConfig.frame": str(frame_idx), "authority.owner": owner_id}
                existing = collection.find_one(query)
                if existing and mode == "skip":
                    results.append({**base, "action": "skipped_existing"})
                    skipped += 1
                    continue

                if not parsed["segments"]:
                    results.append({**base, "action": "skipped", "detail": "文件不含任何 segment"})
                    skipped += 1
                    continue

                # ── 落盘: 每段一个 mask + frame_labels ──
                seg_attrs = mf.get("seg_attrs") or {}
                if is_nii:
                    # mask 恒按前端约定写: RAS 正对角 + raw uint16
                    sx, sy, sz = (float(v) for v in parsed["spacing"])
                    ox, oy, oz = (float(v) for v in parsed["origin"])
                    geo_lines = [
                        "type: uint16", "dimension: 3",
                        f"sizes: {parsed['sizes'][0]} {parsed['sizes'][1]} {parsed['sizes'][2]}",
                        f"space directions: ({sx},0,0) (0,{sy},0) (0,0,{sz})",
                        "kinds: domain domain domain",
                        f"space origin: ({ox},{oy},{oz})",
                        "endian: little", "encoding: raw",
                        "space: right-anterior-superior",
                    ]
                else:
                    geo_lines = parsed["geo"]
                mask_dir = f"{settings.YH_USER_DATA_ROOT}/{owner_id}/{job_seq}/_yh_output/anno_masks"
                os.makedirs(mask_dir, exist_ok=True)
                labels = parsed["labels"]
                now = datetime.now(_tz.utc)
                frame_labels = {}
                for i, (val, name) in enumerate(parsed["segments"]):
                    attr = seg_attrs.get(val) or (list(seg_attrs.values())[i]
                                                  if i < len(seg_attrs) else {})
                    name = attr.get("name") or name
                    object_id = i + 1
                    label_uuid = str(ObjectId())
                    mask = np.zeros(labels.shape, dtype="<u2")
                    mask[labels == val] = object_id
                    header = "\n".join(["NRRD0005", *geo_lines,
                                        f'labels: "{object_id}={name}"']) + "\n\n"
                    mask_path = f"{mask_dir}/{label_uuid}.seg.nrrd.gz"
                    with open(f"{mask_path}.tmp", "wb") as f:
                        f.write(gzip.compress(header.encode("utf-8") + mask.tobytes(), mtime=0))
                    os.replace(f"{mask_path}.tmp", mask_path)
                    frame_labels[label_uuid] = {
                        "label_uuid": label_uuid,
                        "object_type": attr.get("object_type") or "other",
                        "object_id": object_id,
                        "ol_type_": "SegmentVolume",
                        "attributes": {
                            "name": name,
                            "color": attr.get("color") or PALETTE[(object_id - 1) % len(PALETTE)],
                            "representations": ["labelmap", "contour"],
                            "voxelCount": int(np.count_nonzero(mask)),
                        },
                        "val": {
                            "schema": "yinghuo.volumeContours/1",
                            "grid": {"dims": list(parsed["sizes"]),
                                     "spacing": parsed["spacing"], "origin": parsed["origin"]},
                            "contours": [],   # mask 为准, 前端保存时惰性提取
                        },
                        "val_ref": label_uuid,
                        "op_log": [{"user": owner_id, "time": now, "action": "create"}],
                    }

                fp = {"width": parsed["sizes"][0], "height": parsed["sizes"][1],
                      "slices": parsed["sizes"][2], "spacing": parsed["spacing"]}
                if existing:
                    for old in (existing.get("frame_labels") or {}).values():
                        ref = old.get("val_ref")
                        if ref:
                            try:
                                os.remove(f"{mask_dir}/{ref}.seg.nrrd.gz")
                            except OSError:
                                pass
                    collection.update_one({"_id": existing["_id"]}, {"$set": {
                        "frame_labels": frame_labels, "frame_properties": fp,
                        "update_time": now}})
                else:
                    collection.insert_one({
                        "jobConfig": {"uuid": job_uuid, "seq": job["label_spec"]["data"]["seq"],
                                      "stream": stream, "frame": str(frame_idx),
                                      "mission": mission},
                        "frame_labels": frame_labels,
                        "frame_properties": fp,
                        "update_time": now,
                        "authority": {"owner": owner_id},
                    })
                written_frames.add(frame_idx)
                base.update({"segments": len(frame_labels),
                             "voxels": sum(v["attributes"]["voxelCount"] for v in frame_labels.values()),
                             "action": "imported"})
                results.append(base)
                imported += 1

        return {"results": results, "imported": imported, "skipped": skipped}


# ── 体数据序列合并导出辅助 ────────────────────────────────────────────

_NRRD_GEOMETRY_KEYS = (
    "type", "dimension", "space", "sizes", "space directions", "kinds",
    "space origin", "endian", "encoding", "spacing", "centers",
    "space units", "sample units", "oldmin", "oldmax",
)


def _parse_nrrd(raw: bytes):
    """切出 (几何属性行, data 字节); 非 raw-NRRD 抛 ValueError。"""
    sep = raw.find(b"\n\n")
    if sep < 0 or not raw.startswith(b"NRRD"):
        raise ValueError("not a raw NRRD file")
    geo = []
    for line in raw[:sep].decode("utf-8", "replace").split("\n"):
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key = line.split(":", 1)[0].strip()
        if key in _NRRD_GEOMETRY_KEYS:
            geo.append(line)
    return geo, raw[sep + 2:]


def merge_series_nifti(mask_paths: List[str], labels: List[int]) -> bytes:
    """同一序列的多个单标签 mask → 一份多标签 .nii.gz(sform = RAS 正对角)。

    .seg.nrrd.gz 容器 3D Slicer 加载不稳(ITK 系读取器按扩展名路由),导出
    直接用 NIfTI。网格取第一个 mask 的 NRRD 头(RAS 正对角 uint16),写入时
    RAS→LPS(sitk 内部约定),读出的 sform 即原 RAS 网格,与 parse_series_nifti
    的 RAS 候选按构造对合。体素重叠时后一段覆盖前一段;网格或类型不一致抛
    ValueError(调用方跳过该序列)。
    """
    import gzip
    import tempfile
    import SimpleITK as sitk
    grid_ref, data_len, merged = None, -1, None
    for path, label in zip(mask_paths, labels):
        with open(path, "rb") as f:
            geo, data = _parse_nrrd(gzip.decompress(f.read()))
        if merged is None:
            if not any(l in ("type: uint16", "type: ushort", "type: unsigned short") for l in geo):
                raise ValueError(f"unsupported NRRD type: {path}")
            grid_ref = _nrrd_grid_of(_nrrd_head_fields("\n".join(geo)))
            data_len = len(data)
            merged = np.zeros(data_len // 2, dtype="<u2")
        elif _nrrd_grid_of(_nrrd_head_fields("\n".join(geo))) != grid_ref or len(data) != data_len:
            raise ValueError(f"grid mismatch: {path}")
        merged[np.frombuffer(data, dtype="<u2") != 0] = label

    sizes, spacing, origin = grid_ref
    arr = np.ascontiguousarray(merged.reshape(sizes[2], sizes[1], sizes[0]))
    img = sitk.GetImageFromArray(arr)
    img.SetSpacing(tuple(float(v) for v in spacing))
    img.SetOrigin((-origin[0], -origin[1], origin[2]))  # RAS → LPS
    img.SetDirection((-1, 0, 0, 0, -1, 0, 0, 0, 1))
    fd, tmp = tempfile.mkstemp(suffix=".nii.gz")
    os.close(fd)
    try:
        sitk.WriteImage(img, tmp)
        with open(tmp, "rb") as f:
            return f.read()
    finally:
        os.remove(tmp)


def _series_zip_name(frames_meta, frame_val) -> str:
    """series/ 内序列文件名: {帧号}_{dicomFrames 帧名 sanitized}.nii.gz。"""
    import re
    idx = None
    try:
        idx = int(frame_val)
    except (TypeError, ValueError):
        pass
    name = ""
    if idx is not None and 0 <= idx < len(frames_meta or []):
        name = str(frames_meta[idx].get("name") or "")
    prefix = f"{idx:03d}" if idx is not None else re.sub(r"[^0-9A-Za-z_-]+", "_", str(frame_val))[:20]
    safe = re.sub(r"[^0-9A-Za-z一-龥_.+-]+", "_", name).strip("._- ")[:80]
    stem = f"{prefix}_{safe}" if safe else f"series_{frame_val}"
    return f"series/{stem}.nii.gz"


def _series_uid_meta(frames_meta, frame_val) -> dict:
    """dicomFrames[frame] 的患者/检查/序列标识(snake 键, 无则空 dict)。

    manifest 与 series NRRD 头共用;批量导入按 series_uid 路由、patient 校验。
    """
    try:
        idx = int(frame_val)
    except (TypeError, ValueError):
        return {}
    if not (0 <= idx < len(frames_meta or [])):
        return {}
    e = frames_meta[idx] or {}
    out = {}
    for src, dst in (("patient", "patient"), ("studyUid", "study_uid"), ("seriesUid", "series_uid")):
        v = str(e.get(src) or "").strip()
        if v:
            out[dst] = v
    return out


# ── 体数据批量导入辅助(export SegNrrd zip 回导) ─────────────────────

def _nrrd_head_fields(head_text: str) -> dict:
    """NRRD 头 → 字段 dict(兼容 ':' 与 ':=' 两种分隔)。"""
    fields = {}
    for line in head_text.split("\n"):
        if not line or line.startswith("#"):
            continue
        i = line.find(":")
        if i <= 0:
            continue
        fields[line[:i].strip()] = line[i + 1:].lstrip().lstrip("=").strip()
    return fields


def _nrrd_floats(s: str) -> list:
    import re
    return [float(v) for v in re.findall(r"-?[\d.]+(?:[eE][-+]?\d+)?", s or "")]


def _nrrd_grid_of(fields: dict):
    """字段 → (sizes, spacing, origin);缺 sizes → None。"""
    try:
        sizes = tuple(int(v) for v in fields["sizes"].replace(",", " ").split())
    except (KeyError, ValueError):
        return None
    dirs = _nrrd_floats(fields.get("space directions", ""))
    spacing = [abs(dirs[i * 4]) if len(dirs) >= 9 else 1.0 for i in range(3)]
    origin = _nrrd_floats(fields.get("space origin", ""))[:3] or [0.0, 0.0, 0.0]
    return sizes, spacing, origin


def parse_series_nrrd(path: str) -> dict:
    """解析 series .seg.nrrd.gz → 网格/labels/Segment 段/uid 头字段(导入用)。"""
    import gzip
    with open(path, "rb") as f:
        raw = f.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    sep = raw.find(b"\n\n")
    if sep < 0 or not raw.startswith(b"NRRD"):
        raise ValueError("not a raw NRRD file")
    fields = _nrrd_head_fields(raw[:sep].decode("utf-8", "replace"))
    grid = _nrrd_grid_of(fields)
    if grid is None:
        raise ValueError("missing sizes")
    sizes, spacing, origin = grid
    if len(raw) - sep - 2 != sizes[0] * sizes[1] * sizes[2] * 2:
        raise ValueError("data length mismatch")
    segments = []
    for k, v in fields.items():
        import re
        m = re.match(r"^Segment(\d+)_LabelValue$", k)
        if not m:
            continue
        try:
            val = int(v)
        except ValueError:
            continue
        name = fields.get(f"Segment{m.group(1)}_Name", "").strip("\"' ") or f"Segment {m.group(1)}"
        segments.append((val, name))
    segments.sort()
    geo = [line.strip() for line in raw[:sep].decode("utf-8", "replace").split("\n")
           if line.strip() and not line.startswith("#")
           and line.split(":", 1)[0].strip() in _NRRD_GEOMETRY_KEYS]
    return {
        "fields": fields,
        "sizes": sizes, "spacing": spacing, "origin": origin,
        "labels": np.frombuffer(raw[sep + 2:], dtype="<u2"),
        "segments": segments,
        "geo": geo,
    }


def parse_series_nifti(path: str) -> dict:
    """解析 NIfTI .nii(.gz) 多标签分割 → 与 parse_series_nrrd 同构(导入用)。

    SimpleITK 读出为 LPS;这里轴对齐校验(斜置拒绝)后给出 RAS/LPS 两个
    候选(网格数字 + 对应索引序 labels),调用方按目标帧 space 选候选,
    落盘恒用 RAS 候选(与前端 mask 约定一致)。NIfTI 无内嵌段名 →
    "Label {v}"。4D / 非整数标签 / 标签值超 uint16 / 方向斜置抛 ValueError。
    """
    import SimpleITK as sitk
    try:
        img = sitk.ReadImage(path)
    except RuntimeError as e:
        raise ValueError(f"无法解析 NIfTI: {str(e)[:80]}")
    if img.GetDimension() != 3:
        raise ValueError(f"仅支持 3D 分割, 文件为 {img.GetDimension()}D")
    arr = sitk.GetArrayFromImage(img)  # [z, y, x]
    if arr.ndim != 3:
        raise ValueError("vector 像素/4D 分割不支持, 请导出 3D 多标签 labelmap")
    if arr.size == 0:
        raise ValueError("空体数据")
    if np.issubdtype(arr.dtype, np.floating):
        if not np.allclose(arr, np.rint(arr)):
            raise ValueError("标签值非整数(概率图不支持), 请导出为多标签 labelmap")
        arr = np.rint(arr)
    vals = [int(v) for v in np.unique(arr) if v != 0]
    if not vals:
        raise ValueError("分割文件不含任何非零标签")
    if vals[0] < 1 or vals[-1] > 65535:
        raise ValueError(f"标签值超出 uint16 范围: [{vals[0]}, {vals[-1]}]")

    direction = img.GetDirection()  # row-major, LPS
    signs = []
    for i in range(3):
        col = [abs(direction[r * 3 + i]) for r in range(3)]
        if abs(col[i] - 1.0) > 1e-3 or sum(col) > 1.0 + 1e-3:
            raise ValueError("分割方向斜置(非轴对齐), 无法安全匹配")
        signs.append(1.0 if direction[i * 3 + i] > 0 else -1.0)

    sizes = tuple(int(v) for v in img.GetSize())      # (x, y, z)
    spacing = [float(v) for v in img.GetSpacing()]
    origin = list(img.GetOrigin())                    # LPS
    for i, s in enumerate(signs):                     # 翻到 LPS 正对角
        if s < 0:
            arr = np.flip(arr, axis=2 - i)
            origin[i] += s * spacing[i] * (sizes[i] - 1)
    labels_lps = np.ascontiguousarray(arr.astype("<u2"))
    labels_ras = np.ascontiguousarray(np.flip(labels_lps, axis=(1, 2)))
    # LPS→RAS 翻轴后起点角要重锚到对端(同前端 detectPermutation 的 corner 补偿)
    origin_ras = [-origin[0] - spacing[0] * (sizes[0] - 1),
                  -origin[1] - spacing[1] * (sizes[1] - 1),
                  origin[2]]
    return {
        "fields": {},
        "sizes": sizes, "spacing": spacing, "origin": origin_ras,
        "labels": labels_ras,     # 写入用(前端 mask 恒 RAS)
        "segments": [(v, f"Label {v}") for v in vals],
        "candidates": [
            ("right-anterior-superior", origin_ras, labels_ras),
            ("left-posterior-superior", origin, labels_lps),
        ],
        "nifti": True,
    }


def read_frame_grid(path: str):
    """只读帧体数据文件头 → (sizes, spacing, origin, space)(round 4 供比对);失败 → None。"""
    import gzip
    try:
        with open(path, "rb") as f:
            magic = f.read(2)
        opener = gzip.open if magic == b"\x1f\x8b" else open
        with opener(path, "rb") as f:
            head = f.read(4096)
        sep = head.find(b"\n\n")
        if sep < 0:
            return None
        fields = _nrrd_head_fields(head[:sep].decode("utf-8", "replace"))
        grid = _nrrd_grid_of(fields)
        if grid is None:
            return None
        return (*grid, fields.get("space", ""))
    except (OSError, EOFError, ValueError, KeyError):
        return None


def grids_equal(a, b) -> bool:
    """两个 (sizes, spacing, origin) 网格等值比对。

    spacing/origin 用 1e-3 mm 绝对容差: NIfTI 头几何是 float32,与帧头
    (NRRD 明文 float64)比对必有半个 ulp 漂移(原点 |o|~1300mm 时 ~6e-5),
    round-4 精确相等会偶发把同一网格判不等。
    """
    if not a or not b:
        return False
    if tuple(a[0]) != tuple(b[0]):
        return False
    for va, vb in zip(a[1], b[1]):
        if abs(va - vb) > 1e-3:
            return False
    for va, vb in zip(a[2], b[2]):
        if abs(va - vb) > 1e-3:
            return False
    return True


anno_service = AnnoService()
