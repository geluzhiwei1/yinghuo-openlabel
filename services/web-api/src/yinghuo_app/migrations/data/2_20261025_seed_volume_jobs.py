"""医学体数据演示 seed: phantom CT/PET 体数据 + 3 个 volumeSegment3d 任务。

数据写 shared-datas/demo-med-volume/{ct,pet}(NRRD)与
shared-datas/demo-med-volume-nifti/ct(.nii.gz),几何 RAS 轴对齐:
- CT 256×256×120, spacing (1,1,1.5)mm, int16 HU
- PET 128×128×60, spacing (2,2,3)mm, float32 SUV(低分辨率, 融合时重采样到 CT 网格)
- NIfTI demo 用小网格 CT(128×128×60)
任务: 单流 CT / CT+PET 融合 / NIfTI, owners=全量用户。幂等: 文件与 job 均存在即跳过。
"""
import gzip
import struct
from pathlib import Path

import numpy as np

from openlabel import OpenLabel
from yinghuo_conf.config import gConf

from yinghuo_app.biz.data_paths import shared_data_root
from yinghuo_app.biz.db.collection import AnnoJob
from yinghuo_app.biz.db.models import User
from yinghuo_app.biz.services.job import job_service
from yinghuo_app.biz.services.user import user_service
from yinghuo_app.config import Conf
from yinghuo_app.log import logger

CT_DIMS = (256, 256, 120)
CT_SPACING = (1.0, 1.0, 1.5)
CT_ORIGIN = (-127.5, -127.5, -89.25)
PET_DIMS = (128, 128, 60)
PET_SPACING = (2.0, 2.0, 3.0)

# (中心 mm, 半径 mm, CT HU, PET SUV) — 病灶设计: 2 个 CT/PET 双阳, 1 个 PET 阴性,
# 1 个 CT 阴性 PET 阳(体现融合互补)
LESIONS = [
    ((60, -10, 5), 12, 900, 6.5),     # L1 钙化亮点, PET 高摄取
    ((45, 30, -15), 9, 30, 4.0),      # L2 CT 与肝等密度, PET 明亮
    ((-30, -25, 10), 7, -200, 0.9),   # L3 磨玻璃, PET 冷
    ((-55, 20, -20), 8, 40, 3.2),     # L4 CT 隐形(软组织密度), PET 明亮
]

LUNGS = [((-38, -20, 0), (26, 30, 44)), ((38, -20, 0), (26, 30, 44))]
LIVER = ((35, 25, -10), (38, 30, 25))
BODY_AXES = (105, 88, 58)


def _world_axes(dims, spacing, origin):
    xs = origin[0] + np.arange(dims[0]) * spacing[0]
    ys = origin[1] + np.arange(dims[1]) * spacing[1]
    zs = origin[2] + np.arange(dims[2]) * spacing[2]
    return np.meshgrid(xs, ys, zs, indexing="ij")


def _ellipsoid_dist(x, y, z, center, axes):
    return np.sqrt(
        ((x - center[0]) / axes[0]) ** 2
        + ((y - center[1]) / axes[1]) ** 2
        + ((z - center[2]) / axes[2]) ** 2
    )


def _soft_shell(d, r, thickness=2.0):
    """球内=1, 边缘 thickness 内线性衰减到 0"""
    return np.clip((r + thickness / 2 - d) / thickness, 0, 1)


def build_ct() -> np.ndarray:
    x, y, z = _world_axes(CT_DIMS, CT_SPACING, CT_ORIGIN)
    rng = np.random.default_rng(42)
    body = _ellipsoid_dist(x, y, z, (0, 0, 0), BODY_AXES)
    ct = np.full(CT_DIMS, -1000, dtype=np.int16)
    inside = body <= 1
    ct[inside] = 40
    ct[inside] += rng.integers(-12, 13, size=int(inside.sum())).astype(np.int16)
    # 骨壳
    ct[(body >= 0.93) & (body <= 1)] = 1200
    # 肺
    for center, axes in LUNGS:
        lung = _ellipsoid_dist(x, y, z, center, axes) <= 1
        ct[lung] = -750
    # 肝
    liver = _ellipsoid_dist(x, y, z, LIVER[0], LIVER[1]) <= 1
    ct[liver] = 60
    # 病灶
    for center, r, hu, _suv in LESIONS:
        d = np.sqrt((x - center[0]) ** 2 + (y - center[1]) ** 2 + (z - center[2]) ** 2)
        ct[d <= r] = hu
    return ct


def build_pet() -> np.ndarray:
    x, y, z = _world_axes(PET_DIMS, PET_SPACING, CT_ORIGIN)
    pet = np.zeros(PET_DIMS, dtype=np.float32)
    body = _ellipsoid_dist(x, y, z, (0, 0, 0), BODY_AXES)
    inside = body <= 1
    pet[inside] = 0.9 + np.random.default_rng(7).normal(0, 0.08, size=inside.sum()).astype(np.float32)
    pet[(body > 0.93) & (body <= 1)] = 0.4
    for center, axes in LUNGS:
        lung = _ellipsoid_dist(x, y, z, center, axes) <= 1
        pet[lung] = 0.15
    liver = _ellipsoid_dist(x, y, z, LIVER[0], LIVER[1]) <= 1
    pet[liver] = 1.6
    for center, r, _hu, suv in LESIONS:
        d = np.sqrt((x - center[0]) ** 2 + (y - center[1]) ** 2 + (z - center[2]) ** 2)
        w = _soft_shell(d, r, 3.0)
        pet = (pet * (1 - w) + suv * w).astype(np.float32)
    return np.clip(pet, 0, None).astype(np.float32)


def _nrrd_header(dtype: str, dims, spacing, origin, space="right-anterior-superior") -> str:
    dirs = " ".join(
        "(" + ",".join((str(spacing[a]) if i == a else "0") for i in range(3)) + ")"
        for a in range(3)
    )
    org = "(" + ",".join(str(v) for v in origin) + ")"
    return (
        "NRRD0005\n"
        f"type: {dtype}\n"
        "dimension: 3\n"
        f"space: {space}\n"
        f"sizes: {dims[0]} {dims[1]} {dims[2]}\n"
        f"space directions: {dirs}\n"
        "kinds: domain domain domain\n"
        "endian: little\n"
        "encoding: raw\n"
        f"space origin: {org}\n\n"
    )


_NRRD_TO_NUMPY = {"short": "<i2", "float": "<f4"}


def write_nrrd(path, arr: np.ndarray, dims, spacing, origin, dtype_name):
    """NRRD 数据流 axis0(x) 最快; numpy C 序 axis0 最慢 → 先转置 (k,j,i)。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(_nrrd_header(dtype_name, dims, spacing, origin).encode("ascii"))
        f.write(arr.transpose(2, 1, 0).astype(_NRRD_TO_NUMPY[dtype_name]).tobytes(order="C"))


def write_nifti_gz(path, arr: np.ndarray, dims, spacing, origin):
    """NIfTI-1 单文件(int16, sform=RAS 对角仿射)。头部 348B + 4B 填充, 数据在 vox_offset=352。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    hdr = bytearray(352)
    struct.pack_into("<I", hdr, 0, 348)                    # sizeof_hdr
    struct.pack_into("<h", hdr, 40, 3)                     # dim[0]=3 → 长度写在 40
    for i, n in enumerate(dims):
        struct.pack_into("<h", hdr, 40 + 2 * (i + 1), n)
    struct.pack_into("<h", hdr, 70, 4)                     # datatype int16
    struct.pack_into("<h", hdr, 72, 16)                    # bitpix
    struct.pack_into("<f", hdr, 76, 1.0)                   # pixdim[0]
    for i, s in enumerate(spacing):
        struct.pack_into("<f", hdr, 76 + 4 * (i + 1), s)
    struct.pack_into("<f", hdr, 108, 352.0)                # vox_offset
    struct.pack_into("<h", hdr, 254, 1)                    # sform_code=1 (scanner RAS)
    for r in range(3):
        row = [0.0, 0.0, 0.0, float(origin[r])]
        row[r] = float(spacing[r])
        base = 280 + 16 * r
        for c, v in enumerate(row):
            struct.pack_into("<f", hdr, base + 4 * c, v)
    hdr[123] = 2                                           # xyzt_units: mm
    struct.pack_into("<h", hdr, 252, 0)                    # qform_code 未设置(sform 优先)
    hdr[344:348] = b"n+1\x00"
    with gzip.open(path, "wb", compresslevel=6) as f:
        f.write(bytes(hdr))
        # NIfTI 数据 i(x) 最快, 同样要转置
        f.write(arr.transpose(2, 1, 0).astype("<i2").tobytes(order="C"))


def _taxonomy() -> dict:
    specs = OpenLabel.available_taxonomy("medical-volume")
    if not specs:
        raise RuntimeError("openlabel-specs/medical-volume 缺失, 无法 seed 体数据任务")
    s = specs[0]
    return {"key": s["taxonomy_key"], "type": "system", "name": s.get("name", ""), "domain": "medical-volume"}


async def _create_job(name, seq, streams, file_exts, all_user_ids, admin_id):
    # 幂等按任务名(单流/融合两个 job 共用同一 seq, 不能按 seq 判)
    if Conf.MG_ANNO_JOB_PERFORM.find_one({"name": name}):
        logger.info(f"volume demo job 已存在, 跳过: {name}")
        return False
    dto = AnnoJob(
        name=name,
        desc="医学体数据演示任务(自动 seed)",
        priority=1,
        type=0,
        version="1.0.0",
        taxonomy_key="",
        label_spec={
            "domain": {"key": "medical-volume"},
            "mission": {"key": "volumeSegment3d"},
            "taxonomy": _taxonomy(),
            "data": {
                "clip_key": "",
                "format": "simple-directory",
                "root_dir": "",
                "seq": seq,
                "dataSource": "serverLocalDir",
                "streams": streams,
                "file_exts": file_exts,
                "imageURLs": [],
            },
        },
    )
    await job_service.create_job(admin_id, dto)
    Conf.MG_ANNO_JOB_PERFORM.update_many(
        {"label_spec.data.seq": seq}, {"$set": {"authority.owners": all_user_ids}})
    Conf.MG_DATA_SEQ_META.update_many(
        {"job.seq": seq}, {"$set": {"authority.owners": all_user_ids}})
    Conf.MG_DATA_STREAM_META.update_many(
        {"job.seq": seq}, {"$set": {"authority.owners": all_user_ids}})
    logger.info(f"volume demo job 已创建: {name} (seq={seq})")
    return True


async def upgrade() -> str:
    import os

    shared = Path(shared_data_root())
    ct_path = shared / "demo-med-volume" / "ct" / "phantom-ct-01.nrrd"
    pet_path = shared / "demo-med-volume" / "pet" / "phantom-pet-01.nrrd"
    nifti_path = shared / "demo-med-volume-nifti" / "ct" / "phantom-ct-01.nii.gz"

    if not (ct_path.exists() and pet_path.exists() and nifti_path.exists()):
        ct = build_ct()
        pet = build_pet()
        write_nrrd(ct_path, ct, CT_DIMS, CT_SPACING, CT_ORIGIN, "short")
        write_nrrd(pet_path, pet, PET_DIMS, PET_SPACING, CT_ORIGIN, "float")
        small_ct = ct[::2, ::2, ::2].copy()
        write_nifti_gz(nifti_path, small_ct, small_ct.shape, (2.0, 2.0, 3.0), CT_ORIGIN)
        del ct, pet, small_ct

    all_users = await User.all()
    all_user_ids = [u.id for u in all_users]
    admin = await user_service.get_by_email(gConf["admin"]["user"])
    if admin is None:
        raise RuntimeError(f"admin 用户 {gConf['admin']['user']} 不存在, 无法 seed 体数据演示任务")
    created = 0
    created += await _create_job(
        "演示-医学体数据-CT分割", "shared-datas/demo-med-volume", ["ct"], [".nrrd"], all_user_ids, admin.id)
    created += await _create_job(
        "演示-医学体数据-PET/CT融合", "shared-datas/demo-med-volume", ["ct", "pet"], [".nrrd"], all_user_ids, admin.id)
    created += await _create_job(
        "演示-医学体数据-NIfTI", "shared-datas/demo-med-volume-nifti", ["ct"], [".nii.gz"], all_user_ids, admin.id)
    return f"created {created} volume demo jobs, files at {os.fspath(shared / 'demo-med-volume')}"


async def downgrade() -> str:
    for seq in ("shared-datas/demo-med-volume", "shared-datas/demo-med-volume-nifti"):
        Conf.MG_ANNO_JOB_PERFORM.delete_many({"label_spec.data.seq": seq})
        Conf.MG_DATA_SEQ_META.delete_many({"job.seq": seq})
        Conf.MG_DATA_STREAM_META.delete_many({"job.seq": seq})
    return "removed volume demo jobs"
