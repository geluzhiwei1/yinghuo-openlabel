import glob
import logging
import sys
import asyncio
if sys.version_info >= (3, 11):
    from datetime import UTC
else:
    from datetime import timezone
    UTC = timezone.utc
import fire
import os
from bson import ObjectId
import json
from pydash import _
import uuid

from yinghuo_app.biz.db.collection import AnnoJob
from yinghuo_app.biz.services.job import job_service
from yinghuo_app.biz.services.anno import anno_service
from yinghuo_app.config import Conf
from yinghuo_conf.api_util.utils import wrap_json, mongo_json_encoder
from yinghuo_app.biz.services import job_meta
from openlabel.models import api_model, openlabel


def convert_to_openlable_objects(label_doc:dict):
    
    attr_annotator = openlabel.Text(name='annotator', val=str(_.get(label_doc, "authority.owner", "")))
    attr_annotator_update_time = openlabel.Text(name='annotator_update_time', val=label_doc['update_time'])
    
    objects = dict()
    for oid, obj in label_doc['frame_labels'].items():
        if obj is None: continue
        attr_uuid = openlabel.Text(name='uuid', val=oid)
        attr_objId = openlabel.Text(name='objId', val=_.get(obj, "objId", ""))
        attr_objType = openlabel.Text(name='objType', val=_.get(obj, "objType", ""))
        
        bbox = None
        poly2d = None
        image = None
        poly3d = None
        
        tp = obj['type']
        # Mask2dBase64
        if tp == 'Mask2dBase64':
            val = _.get(obj, 'val', None)
            if val is not None:
                image = [openlabel.Image(
                    attributes=openlabel.Attributes(
                        num=[
                            openlabel.Num(name='left', val=_.get(obj, 'attributes.left', None)),
                            openlabel.Num(name='top', val=_.get(obj, 'attributes.top', None)),
                            openlabel.Num(name='width', val=_.get(obj, 'attributes.width', None)),
                            openlabel.Num(name='height', val=_.get(obj, 'attributes.height', None))
                        ],
                        text=[
                            attr_uuid,
                            attr_annotator,
                            attr_annotator_update_time
                        ]
                    ),
                    name=None,
                    encoding='base64',
                    val=val,
                )]
        elif tp == 'Poly2d':
            val = _.get(obj, 'val', None)
            if val is not None:
                val = [e for e in val if e is not None]
                poly2d=[
                    openlabel.Poly2d(
                        attributes=openlabel.Attributes(
                            text=[
                                attr_uuid,
                                attr_annotator,
                                attr_annotator_update_time
                            ]
                        ),
                        name=None,
                        closed=_.get(obj, 'attributes.closed', None),
                        mode=_.get(obj, 'attributes.mode', None),
                        val=val
                    )
                ]
        else:
            raise ValueError('Unsupported label type')

        objects[str(oid)] = openlabel.Object(
            name=None,
            type=_.get(obj, "objType", ""),
            object_data=openlabel.ObjectData(
                attributes=openlabel.Attributes(
                    num=[openlabel.Num(name='score',val=0.0)],
                    text=[
                        attr_objId,
                        attr_objType
                    ]
                ),
                bbox=bbox,
                image=image,
                poly2d=poly2d,
                poly3d=poly3d,
            )
        )
    return objects
    
def convert_to_openlabel(label_doc:dict) -> openlabel.Doc:
    # convert to openlabel
    objects = convert_to_openlable_objects(label_doc)
    
    frame_id = str(label_doc['job_perform']['frame'])
    frames = {frame_id: openlabel.Frame(objects=objects)}
    doc = openlabel.Doc(openlabel=openlabel.Openlabel(
            metadata=openlabel.Metadata(),
            frames=frames
        )
    )
    return doc

async def export(user_id:int, mission:str, output_dir:str, job_uuid:str=None, admin_group:str=None, no_raw_anno=True):
    """从mongodb导出数据到本地json文件
    """
    assert user_id > 0, "user_id must be greater than 0"
    assert mission in Conf.MG_COLLECTION.keys(), "mission not corrent"
    assert os.path.exists(output_dir), "output_dir must exist"
    
    # 找到这个用户的job
    query1 = {"authority.owners": user_id}
    if job_uuid is not None:
        query1["_id"] = ObjectId(job_uuid)
    # elif admin_group is not None:
    #     query["admin_group"] = admin_group
    collection = Conf.MG_ANNO_JOB_PERFORM
    _rows = collection.find(query1)
    jobs = list(_rows)
    if len(jobs) == 0:
        print("No jobs found for user {}".format(user_id))
        return
    
    for job in jobs:
        query = {
            # "authority.owner": [user_id]},
            "jobConfig.uuid": str(job["_id"]),
        }
        
        # 查询对应的mission数据
        _rtn = Conf.MG_COLLECTION[mission].find(query)
        datas = mongo_json_encoder(list(_rtn))
        print('total {} records'.format(len(datas)))
        
        have_data = False
        for d in datas:
            if len(d['frame_labels']) < 1:
                continue
            
            for k, v in d['frame_labels'].items():
                if v.get("is_removed", False):
                    d['frame_labels'][k] = None
            job_perform = d['job_perform']
            seq = job_perform["seq"]
            stream = job_perform["stream"]
            frame = job_perform["frame"]
            annotater = d["authority"]['owner']
            
            to_dir = f'{output_dir}/{mission}/{seq}/{stream}'
            if not os.path.exists(to_dir):
                os.makedirs(to_dir)
            
            if not no_raw_anno:
                to_file = f'{to_dir}/{frame}-{annotater}.json'
                with open(to_file, "w") as f:
                    print(f"writing raw anno file: {to_file}")
                    json.dump(d, f, indent=2, ensure_ascii=False)
            
            to_file = f'{to_dir}/{frame}.json'
            with open(to_file, "w") as f:
                ol_doc = convert_to_openlabel(d)
                json.dump(ol_doc.model_dump(mode='json', exclude_none=True), f, indent=2, ensure_ascii=False)
                
                have_data = True
                
        if have_data:
            job_uuid = str(job["_id"])
            seq = job["label_spec"]['data']["seq"]
            
            # 导出job
            job_meta_file = f'{output_dir}/{mission}/{seq}/job.json'
            with open(job_meta_file, "w") as f:
                json.dump(mongo_json_encoder(job), f, indent=2, ensure_ascii=False)
                
            # seq meta
            d = job_meta.find_seq_meta(job_uuid)
            if d:
                meta_seq = f'{output_dir}/{mission}/{seq}/meta.json'
                with open(meta_seq, "w") as f:
                    json.dump(d, f, indent=2, ensure_ascii=False)

            # stream meta
            job_uuid = str(job["_id"])
            seq = job["label_spec"]['data']["seq"]
            streams = job["label_spec"]['data']["streams"]
            data_source = _.get(job, "label_spec.data.data_source", None) # job[""]['data']["data_source"]
            meta_dir = f'{output_dir}/{mission}/{seq}/meta'
            os.makedirs(meta_dir, exist_ok=True)
            for stream in streams:
                d = job_meta.find_stream_meta(job_uuid, stream, data_source, seq=seq)
                if d:
                    meta_s = f'{meta_dir}/{stream}.json'
                    with open(meta_s, "w") as f:
                        json.dump(d, f, indent=2, ensure_ascii=False)

async def export_job_to_coco(job_uuid:str, output_dir:str):
    """从mongodb导出数据到本地json文件
    """
    assert job_uuid is not None, "job_uuid must be specified"
    assert os.path.exists(output_dir), "output_dir must exist"
    
    d = await anno_service.export_to_coco(job_uuid)
    out_f = f'{output_dir}/{job_uuid}.json'
    with open(out_f, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    print(f"Exported to {out_f}")
    
async def import_anno_file(job_uuid:str=None, frame_id=0, stream='', anno_file:str = None,clear=False):
    """从本地json文件导入到mongodb
    """
    assert anno_file is not None, "anno_file must be specified"
    assert os.path.exists(anno_file), "anno_file must exist"
    
    logging.info(f"Starting Import from {anno_file}")
    
    doc = job_service.get_job(job_uuid)
    if not doc:
        raise ValueError("job not found")
    else:
        mission = doc['label_spec']['mission']['key']
        user_id = doc['authority']['owners'][0]
        seq = doc['label_spec']['data']['seq']
        print(f"mission: {mission}")
        print(f"stream: {stream}")
        print(f"user_id: {user_id}")
        print(f"seq: {seq}")
    
    j_obj = json.load(open(anno_file, 'r', encoding='utf-8'))
    
    # 设置frame_id
    frame_id = str(frame_id)
    frame = j_obj['openlabel']['frames'].get(frame_id)
    if not frame:
        j_obj['openlabel']['frames'][str(frame_id)] = j_obj['openlabel']['frames']['0']
        del j_obj['openlabel']['frames']['0']
        
    ol_doc:openlabel.Doc = openlabel.Doc.model_validate(j_obj, strict=False)
    assert frame_id in ol_doc.openlabel.frames.keys(), "frame_id must be in ol_doc.openlabel.frames.keys()"
    
    # 解析对象
    frame_objects = []
    for oid, o in ol_doc.openlabel.frames[frame_id].objects.items():
        if o.object_data.bbox and mission == 'objectBBox2d':
            frame_objects += o.object_data.bbox
        if o.object_data.rbbox and mission == 'objectRBBox2d':
            frame_objects += o.object_data.rbbox
        if o.object_data.bbox3d:
            frame_objects += o.object_data.bbox3d
        if o.object_data.bbox3d:
            frame_objects += o.object_data.bbox3d
        if o.object_data.point3d:
            frame_objects += o.object_data.point3d
        if o.object_data.mask and mission == 'semantic2d':
            frame_objects += o.object_data.mask
        if o.object_data.poly2d and mission == 'semantic2d':
            frame_objects += o.object_data.poly2d
        if o.object_data.poly3d:
            frame_objects += o.object_data.poly3d
            
    if len(frame_objects) == 0:
        logging.warning("No objects found")
        return
    # 导入
    frame_objects = [o.model_dump(exclude_unset=True) for o in frame_objects]
    await anno_service.import_annos(user_id=user_id, mission=mission, seq=seq, stream=stream,frame_ts=int(frame_id), \
        job_uuid=job_uuid, frame_objects=frame_objects, clear=clear)
    print("Done.")
    
async def import_anno_from_dir(job_uuid:str=None, stream='', json_file_dir=None, clear=False):
    """从本地json文件夹导入到mongodb

    Args:
        job_uuid (str, optional): _description_. Defaults to None.
        stream (str, optional): _description_. Defaults to ''.
        json_file_dir (_type_, optional): _description_. Defaults to None.
        clear (bool, optional): _description_. Defaults to False.
    """
    assert json_file_dir is not None, "json_file_dir must be specified"
    assert os.path.exists(json_file_dir), "json_file_dir must exist"
    
    anno_files = glob.glob(f"{json_file_dir}/*.json")
    anno_files.sort()
    for anno_file in anno_files:
        print(f"importing {anno_file}")
        frame_id = int(anno_file.split('/')[-1].split('.')[0])
        await import_anno_file(job_uuid=job_uuid, frame_id=frame_id, stream=stream, anno_file=anno_file, clear=clear)


def sync_export(user_id:int, mission:str, output_dir:str, job_uuid:str=None, admin_group:str=None, no_raw_anno=True):
    asyncio.run(export(user_id, mission, output_dir, job_uuid, admin_group, no_raw_anno))

def sync_export_job_to_coco(job_uuid:str, output_dir:str):
    asyncio.run(export_job_to_coco(job_uuid, output_dir))

def sync_import_anno_file(job_uuid:str=None, frame_id=0, stream='', anno_file:str=None, clear=False):
    asyncio.run(import_anno_file(job_uuid, frame_id, stream, anno_file, clear))

def sync_import_anno_from_dir(job_uuid:str=None, stream='', json_file_dir=None, clear=False):
    asyncio.run(import_anno_from_dir(job_uuid, stream, json_file_dir, clear))

if __name__ == "__main__":
    fire.Fire({
        'export': sync_export,
        'export_coco': sync_export_job_to_coco,
        'import_file': sync_import_anno_file,
        'import_dir': sync_import_anno_from_dir,
    })