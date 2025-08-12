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
from yinghuo_conf import Conf, settings
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
            result = await collection.delete_many(query)
            if not result.acknowledged:
                raise BizException(statusText="clear frame anno failed", status=500)
        
        # 如果collection中没有这个frame的数据，则创建一个新的
        frame_anno_id = None
        frame_anno_doc = await collection.find_one(query)
        if frame_anno_doc is None:
            res = await collection.insert_one({
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
            frame_anno_doc = await collection.find_one(query)
            
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
            
        result = await collection.update_one(update_query, {
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
        _rows = await collection.find(query1)
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


anno_service = AnnoService()
