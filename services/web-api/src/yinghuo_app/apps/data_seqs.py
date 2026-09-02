"""Stage 8 数据序列新模型路由 /data-seqs。

挂载:main app,前缀 /api/v1/b/data-seqs。
权限:business:dataset:read。

老 /seq/dataSeq 保留兼容。此路由对接 Stage 7 Batch.spawn_units 用,
返回结构稳定:列表 [{uuid, seq, streams}],详情 [{stream, frame_count}]。
"""
import asyncio
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from ..apps.dependency import permission_required
from ..config import Conf

router = APIRouter()


def _to_uuid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail="非法 uuid")


@router.get(
    "",
    summary="数据序列列表(简化全租户视图)",
    dependencies=[permission_required("business:dataset:read")],
)
async def list_seqs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    skip = (page - 1) * page_size

    def _run():
        total = Conf.MG_DATA_SEQ_META.count_documents({})
        cur = (Conf.MG_DATA_SEQ_META.find(
            {}, {"job.seq": 1, "job.uuid": 1,
                 "datas.openlabel.streams": 1, "created_time": 1}
        ).sort("created_time", -1).skip(skip).limit(page_size))
        items = []
        for doc in cur:
            streams = (doc.get("datas", {}).get("openlabel", {}).get("streams", {}) or {})
            job = doc.get("job", {}) or {}
            uuid = job.get("uuid")
            items.append({
                "uuid": str(uuid) if uuid is not None else str(doc["_id"]),
                "seq": job.get("seq", ""),
                "stream_count": len(streams) if isinstance(streams, dict) else 0,
                "created_time": doc.get("created_time"),
            })
        return total, items

    total, items = await asyncio.to_thread(_run)
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get(
    "/{uuid}",
    summary="数据序列详情(streams 列表)",
    dependencies=[permission_required("business:dataset:read")],
)
async def get_seq(uuid: str):
    oid = _to_uuid(uuid)

    def _run():
        doc = Conf.MG_DATA_SEQ_META.find_one(
            {"job.uuid": oid},
            {"job.seq": 1, "datas.openlabel.streams": 1, "created_time": 1},
        )
        if not doc:
            return None
        streams = (doc.get("datas", {}).get("openlabel", {}).get("streams", {}) or {})
        stream_names = list(streams.keys()) if isinstance(streams, dict) else []
        # 对每个 stream 拉 frame_count
        stream_infos = []
        for s in stream_names:
            smeta = Conf.MG_DATA_STREAM_META.find_one(
                {"job.uuid": oid, "job.stream": s},
                {"datas.openlabel.frames": 1},
            )
            frames = (smeta or {}).get("datas", {}).get("openlabel", {}).get("frames", {}) or {}
            stream_infos.append({
                "name": s,
                "frame_count": len(frames) if isinstance(frames, dict) else 0,
            })
        return {
            "uuid": uuid,
            "seq": (doc.get("job", {}) or {}).get("seq", ""),
            "created_time": doc.get("created_time"),
            "streams": stream_infos,
        }

    result = await asyncio.to_thread(_run)
    if result is None:
        raise HTTPException(status_code=404, detail="数据序列不存在")
    return result


@router.get(
    "/{uuid}/streams/{stream}/frames",
    summary="stream 的 frame 列表(分页)",
    dependencies=[permission_required("business:dataset:read")],
)
async def list_frames(
    uuid: str,
    stream: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    oid = _to_uuid(uuid)
    skip = (page - 1) * page_size

    def _run():
        doc = Conf.MG_DATA_STREAM_META.find_one(
            {"job.uuid": oid, "job.stream": stream},
            {"datas.openlabel.frames": 1},
        )
        if not doc:
            return None
        frames = (doc.get("datas", {}).get("openlabel", {}).get("frames", {}) or {})
        if not isinstance(frames, dict):
            return {"total": 0, "page": page, "page_size": page_size, "items": []}
        keys = sorted(frames.keys(), key=lambda k: int(k) if k.isdigit() else 0)
        total = len(keys)
        slice_keys = keys[skip:skip + page_size]
        items = []
        for k in slice_keys:
            f = frames[k] or {}
            props = f.get("frame_properties", {}) if isinstance(f, dict) else {}
            items.append({
                "frame_idx": int(k) if k.isdigit() else k,
                "uri": props.get("uri") or props.get("name"),
                "name": props.get("name"),
                "timestamp": props.get("timestamp"),
            })
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    result = await asyncio.to_thread(_run)
    if result is None:
        raise HTTPException(status_code=404, detail="stream 不存在")
    return result
