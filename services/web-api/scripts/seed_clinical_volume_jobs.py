"""一次性 seed:真实临床多患者多序列体数据任务(P0439-6095 批次)。

数据来源:test-data/P0439-6095.zip(TCIA 风格 DICOM,zip 传输截断后流式抢救解压),
经 SimpleITK 转 NRRD + PET BQML→SUVbw,落在 shared-datas:
- med-clinical-fusion/{ct,pet}:4 个 WB PET/CT 对 + 3 个 HEAD 对(7 帧,双流对齐)
- med-clinical-lung-hires/ct:6 帧 1.25mm 肺重建 + CTAC(剔除缺层的 20220602)

用法:
  cd services/web-api
  YH_CONFIG_FILE=config/yinghuo.yaml PYTHONPATH=src .venv/bin/python -m scripts.seed_clinical_volume_jobs
幂等:任务名存在即跳过。
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from tortoise import Tortoise  # noqa: E402

from openlabel import OpenLabel  # noqa: E402
from yinghuo_conf.config import gConf  # noqa: E402

from yinghuo_app.biz.data_paths import shared_data_root  # noqa: E402
from yinghuo_app.biz.db.collection import AnnoJob  # noqa: E402
from yinghuo_app.biz.db.models import User  # noqa: E402
from yinghuo_app.biz.services.job import job_service  # noqa: E402
from yinghuo_app.biz.services.user import user_service  # noqa: E402
from yinghuo_app.config import Conf, settings  # noqa: E402
from yinghuo_app.log import logger  # noqa: E402


def _taxonomy() -> dict:
    specs = OpenLabel.available_taxonomy("medical-volume")
    if not specs:
        raise RuntimeError("openlabel-specs/medical-volume 缺失")
    s = specs[0]
    return {"key": s["taxonomy_key"], "type": "system", "name": s.get("name", ""),
            "domain": "medical-volume"}


async def _create_job(name, seq, streams, all_user_ids, admin_id) -> bool:
    if Conf.MG_ANNO_JOB_PERFORM.find_one({"name": name}):
        logger.info(f"job 已存在, 跳过: {name}")
        return False
    dto = AnnoJob(
        name=name,
        desc="真实临床多患者多序列(seed: scripts/seed_clinical_volume_jobs.py)",
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
                "file_exts": [".nrrd"],
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
    logger.info(f"job 已创建: {name} (seq={seq})")
    return True


async def main() -> int:
    shared = Path(shared_data_root())
    fusion, hires = shared / "med-clinical-fusion", shared / "med-clinical-lung-hires"
    n_ct = len(list((fusion / "ct").glob("*.nrrd")))
    n_pet = len(list((fusion / "pet").glob("*.nrrd")))
    n_hires = len(list((hires / "ct").glob("*.nrrd")))
    print(f"data: fusion ct={n_ct} pet={n_pet}, lung-hires ct={n_hires}")
    assert n_ct == n_pet and n_ct > 0, "融合双流帧数不一致"

    await Tortoise.init(config=settings.TORTOISE_ORM, _enable_global_fallback=True)
    try:
        all_users = await User.all()
        all_user_ids = [u.id for u in all_users]
        admin = await user_service.get_by_email(gConf["admin"]["user"])
        created = 0
        created += await _create_job(
            "临床-多患者-PET/CT融合", "shared-datas/med-clinical-fusion",
            ["ct", "pet"], all_user_ids, admin.id)
        created += await _create_job(
            "临床-多患者-CT多序列", "shared-datas/med-clinical-lung-hires",
            ["ct"], all_user_ids, admin.id)
        print(f"created {created} jobs")
        return 0
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
