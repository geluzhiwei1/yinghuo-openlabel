"""体数据模型预标注管线(B3)。

任务创建时勾选了模型 → 逐帧调 med-seg 推理(split_structures)→ 以 job owner
身份落 mask 文件 + label_volume_segment3d 文档(attributes.origin='model'),
前端 load 不改即见,审核(Accept/Reject)走既有保存/墓碑流。
设计: docs/internals/nrrd-auto-segmentation.md B3。
"""
import asyncio
import gzip
import os
import re
import time
from datetime import datetime, timezone

import httpx
import numpy as np
from bson.objectid import ObjectId

from ...config import Conf
from ...log import logger

PALETTE = ['#e64a19', '#fdd835', '#7cb342', '#26a69a', '#42a5f5',
           '#7e57c2', '#ec407a', '#ff7043', '#9ccc65', '#8d6e63']

# 结构名 → taxonomy 叶节点(medical-volume body-organ-v1)
_TAXONOMY_MAP = {
    'liver': 'liver',
    'lung': 'other',
    'bone': 'other',
    'PET Lesion': 'tumor',
}


def _parse_seg_nrrd_gz(path: str):
    """读回我们写出的 .seg.nrrd.gz → (labels, dims, spacing, origin)。"""
    raw = gzip.decompress(open(path, 'rb').read())
    head = raw[:raw.find(b'\n\n')].decode('ascii')
    body = raw[raw.find(b'\n\n') + 2:]
    fields = {}
    for line in head.split('\n'):
        if not line or line.startswith('#'):
            continue
        i = line.find(':')
        if i > 0:
            fields[line[:i].strip()] = line[i + 1:].lstrip('=:').strip()
    dims = tuple(int(v) for v in fields['sizes'].replace(',', ' ').split())

    # space directions: 9 个数(行主序 3 向量, 轴对齐时对角线=spacing)
    dirs = re.findall(r'-?[\d.]+(?:[eE][-+]?\d+)?', fields.get('space directions', ''))
    spacing = [abs(float(dirs[i * 4])) if len(dirs) >= 9 else 1.0 for i in range(3)]
    org = re.findall(r'-?[\d.]+(?:[eE][-+]?\d+)?', fields.get('space origin', ''))
    origin = [float(v) for v in org[:3]] or [0.0, 0.0, 0.0]
    labels = np.frombuffer(body, dtype='<u2')
    return labels, dims, spacing, origin


def _set_job_pre_annotate(uuid: str, **kw) -> None:
    Conf.MG_ANNO_JOB_PERFORM.update_one(
        {"_id": ObjectId(uuid)}, {"$set": {f"pre_annotate.{k}": v for k, v in kw.items()}})


async def _wait_service_task(client: httpx.AsyncClient, base: str, task_id: str,
                             timeout: float = 900.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = await client.get(f"{base}/segment/{task_id}")
        if r.status_code == 200:
            st = r.json()
            if st.get('status') in ('done', 'failed'):
                return st
        await asyncio.sleep(1.5)
    raise TimeoutError(f'infer task {task_id} timeout')


async def _annotate_frame(client, base, uuid, job_doc, frame: int, models: list) -> int:
    """单帧推理 + 落盘。返回写入的 structure 数。"""
    # 延迟导入避免 biz ↔ apps 循环
    from ...apps.label_app import (_volume_frame_file, _volume_mask_path,
                                  _infer_service_segment)

    data = job_doc["label_spec"]["data"]
    streams = data.get("streams") or []
    ct_stream = 'ct' if 'ct' in streams else (streams[0] if streams else 'ct')
    pet_stream = 'pet' if 'pet' in streams else None
    owner_id = job_doc['authority']['owners'][0]
    seq = data["seq"]

    ct_path = _volume_frame_file(job_doc, uuid, ct_stream, frame)
    pet_path = _volume_frame_file(job_doc, uuid, pet_stream, frame) if pet_stream else None
    if not ct_path or not os.path.exists(ct_path):
        raise FileNotFoundError(f'ct 文件不存在: frame={frame}')

    service_task = await _infer_service_segment(
        ct_path, pet_path, owner_id, seq, frame, models, split_structures=True)
    st = await _wait_service_task(client, base, service_task)
    if st.get('status') != 'done':
        raise RuntimeError(f"infer failed: {st.get('error')}")
    structures = st.get('structures') or []
    if not structures:
        raise RuntimeError('infer returned no structures')

    collection = Conf.MG_COLLECTION['volumeSegment3d']
    job_config = {
        'uuid': uuid, 'seq': seq, 'stream': ct_stream,
        'frame': str(frame), 'mission': 'volumeSegment3d',
    }
    query = {"jobConfig.uuid": uuid, "jobConfig.stream": ct_stream,
             "jobConfig.frame": str(frame), "authority.owner": owner_id}
    if collection.find_one(query) is not None:
        logger.info(f"pre_annotate skip frame {frame}: label doc already exists")
        return 0

    # 先落全部 mask 文件, 全部落成功才写 label 文档(半写状态对读端不可见)
    written = []
    for i, s in enumerate(structures):
        label_uuid = str(ObjectId())
        r = await client.get(s['url'])
        if r.status_code != 200:
            raise RuntimeError(f"mask 下载失败: {s['name']} HTTP {r.status_code}")
        mask_path = _volume_mask_path(job_doc, label_uuid)
        os.makedirs(os.path.dirname(mask_path), exist_ok=True)
        tmp = f"{mask_path}.tmp"
        with open(tmp, 'wb') as f:
            f.write(r.content)
        os.replace(tmp, mask_path)
        written.append((label_uuid, s, i + 1, mask_path))

    labels0, dims, spacing, origin = _parse_seg_nrrd_gz(written[0][3])
    frame_properties = {
        'width': dims[0], 'height': dims[1], 'slices': dims[2],
        'spacing': spacing,
    }
    frame_labels = {}
    for label_uuid, s, object_id, mask_path in written:
        labels, d2, _, _ = _parse_seg_nrrd_gz(mask_path)
        if d2 != dims:
            raise RuntimeError(f'{s["name"]} 网格与基网格不一致')
        name = s['name']
        frame_labels[label_uuid] = {
            'label_uuid': label_uuid,
            'object_type': _TAXONOMY_MAP.get(name, 'other'),
            'object_id': object_id,
            'ol_type_': 'SegmentVolume',
            'attributes': {
                'name': name,
                'color': PALETTE[(object_id - 1) % len(PALETTE)],
                'representations': ['labelmap', 'contour'],
                'voxelCount': int(np.count_nonzero(labels)),
                'origin': 'model',
            },
            'val': {
                'schema': 'yinghuo.volumeContours/1',
                'grid': {'dims': list(dims), 'spacing': spacing, 'origin': origin},
                'contours': [],   # mask 为准, 保存时前端惰性提取
            },
            'val_ref': label_uuid,
            # label/load 读端点无条件遍历 op_log, 缺失会 500
            'op_log': [{'user': owner_id, 'time': datetime.now(timezone.utc),
                        'action': 'create'}],
        }
    collection.insert_one({
        'jobConfig': job_config,
        'frame_labels': frame_labels,
        'frame_properties': frame_properties,
        'update_time': datetime.now(timezone.utc),
        'authority': {'owner': owner_id},
    })
    return len(frame_labels)


async def run_pre_annotate(uuid: str, models: list) -> None:
    """逐帧预标注入口(asyncio.create_task 拉起, 异常只落日志/状态)。"""
    from ...apps.label_app import _med_seg_base
    base = _med_seg_base()
    if not base:
        _set_job_pre_annotate(uuid, status='failed', error='infer 服务未配置')
        return

    job_doc = Conf.MG_ANNO_JOB_PERFORM.find_one({"_id": ObjectId(uuid)})
    if job_doc is None:
        logger.error(f"pre_annotate: job {uuid} not found")
        return
    data = job_doc["label_spec"]["data"]
    streams = data.get("streams") or []
    ct_stream = 'ct' if 'ct' in streams else (streams[0] if streams else 'ct')

    # 帧数来自 ct stream meta
    from .job_meta import find_stream_meta
    stream_meta = find_stream_meta(uuid, ct_stream, data.get("dataSource", ""), seq=data["seq"])
    frames = []
    for k in ((stream_meta or {}).get('openlabel', {}).get('frames', {}) or {}).keys():
        try:
            frames.append(int(k))
        except (TypeError, ValueError):
            continue
    frames.sort()
    if not frames:
        _set_job_pre_annotate(uuid, status='failed', error='无帧可预标注')
        return

    _set_job_pre_annotate(uuid, models=models, status='running', done=0, total=len(frames))
    done = failed = 0
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        for frame in frames:
            try:
                n = await _annotate_frame(client, base, uuid, job_doc, frame, models)
                done += 1
                logger.info(f"pre_annotate {uuid} frame {frame}: {n} structures")
            except Exception as e:  # noqa: BLE001 — 单帧失败不阻断管线
                failed += 1
                logger.warning(f"pre_annotate {uuid} frame {frame} failed: {e}")
            _set_job_pre_annotate(uuid, done=done, failed=failed)
    _set_job_pre_annotate(
        uuid, status='failed' if done == 0 else ('partial' if failed else 'done'))
    logger.info(f"pre_annotate {uuid} finished: done={done} failed={failed}")
