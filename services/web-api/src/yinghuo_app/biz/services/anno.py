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


anno_service = AnnoService()
