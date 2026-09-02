"""演示任务 seed:启动时默认插入 6 个标注任务(3x2D 图像 + 3x3D 点云)。

数据源统一用「互联网图像(HTTP)」,指向前端静态资源 apps/web-app/public/demo-data
(vite base 为 /guis/yinghuo,dev 端口 8400;URL 前缀可经 config/yinghuo.yaml
global.demo_data_base_url 覆盖)。标注规范从 openlabel-specs/intelligent-driving
内置系统规范里随机选一个。由 biz/data_migrations.py 在启动时应用一次。
"""
import random

from yinghuo_conf.config import gConf

from openlabel import OpenLabel

from yinghuo_app.biz.db.collection import AnnoJob
from yinghuo_app.biz.db.models import User
from yinghuo_app.biz.services.job import job_service
from yinghuo_app.biz.services.user import user_service
from yinghuo_app.config import Conf
from yinghuo_app.log import logger

DEMO_SEQ_PREFIX = "demo-"
DEFAULT_BASE_URL = "http://localhost:8400/guis/yinghuo/demo-data"

IMAGE_FILES = ["1.jpg", "2.jpg", "3.jpg"]
PC_FILES = [
    "car6.pcd",
    "colored_cloud.pcd",
    "cube.ply",
    "curve3d.pcd",
    "five_people.pcd",
    "office1.pcd",
    "autzen.las",
    "1.2-with-color.laz",
]
IMAGE_EXTS = [".png", ".jpg"]
POINTCLOUD_EXTS = [".pcd", ".ply", ".las", ".laz"]

# (name, mission, seq, stream, 子目录, 文件列表, file_exts)
DEMO_JOBS = [
    ("演示-2D图像-2D框", "objectBBox2d", "demo-2d-bbox", "camera1", "images", IMAGE_FILES, IMAGE_EXTS),
    ("演示-2D图像-旋转框", "objectRBBox2d", "demo-2d-rbbox", "camera1", "images", IMAGE_FILES, IMAGE_EXTS),
    ("演示-2D图像-语义分割", "semantic2d", "demo-2d-semantic", "camera1", "images", IMAGE_FILES, IMAGE_EXTS),
    ("演示-3D点云-3D框", "objectBBox3d", "demo-3d-bbox", "lidar1", "pc1", PC_FILES, POINTCLOUD_EXTS),
    ("演示-3D点云-曲线", "pcPolyline3d", "demo-3d-polyline", "lidar1", "pc1", PC_FILES, POINTCLOUD_EXTS),
    ("演示-3D点云-语义分割", "pcSemantic3d", "demo-3d-semantic", "lidar1", "pc1", PC_FILES, POINTCLOUD_EXTS),
]


def _demo_base_url() -> str:
    url = gConf["global"].get("demo_data_base_url") or DEFAULT_BASE_URL
    return url.rstrip("/")


def _random_taxonomy() -> dict:
    spec = random.choice(OpenLabel.available_taxonomy("intelligent-driving"))
    return {
        "key": spec["taxonomy_key"],
        "type": "system",
        "name": spec.get("name", ""),
        "domain": spec.get("domain", "intelligent-driving"),
    }


async def upgrade() -> str:
    base = _demo_base_url()
    admin = await user_service.get_by_email(gConf["admin"]["user"])
    if admin is None:
        raise RuntimeError(f"admin 用户 {gConf['admin']['user']} 不存在,无法 seed 演示任务")
    # 演示任务对所有用户可见:owners 放全量用户 id(列表查询按 owners 过滤)
    all_user_ids = [u.id for u in await User.all()]

    created = []
    for name, mission, seq, stream, subdir, files, file_exts in DEMO_JOBS:
        # 幂等:同 seq 的 job 已存在(本迁移之外手工建过)则跳过
        if Conf.MG_ANNO_JOB_PERFORM.find_one({"label_spec.data.seq": seq}):
            logger.info(f"demo job 已存在,跳过: {name} (seq={seq})")
            continue
        dto = AnnoJob(
            name=name,
            desc="启动时自动插入的演示任务",
            priority=1,
            type=0,
            version="1.0.0",
            taxonomy_key="",
            label_spec={
                "domain": {"key": "intelligent-driving"},
                "mission": {"key": mission},
                "taxonomy": _random_taxonomy(),
                "data": {
                    "clip_key": "",
                    "format": "simple-directory",
                    "root_dir": "",
                    "seq": seq,
                    "dataSource": "imageURLs",
                    "streams": [stream],
                    "file_exts": file_exts,
                    "imageURLs": [f"{base}/{subdir}/{f}" for f in files],
                },
            },
        )
        await job_service.create_job(admin.id, dto)
        # create_job 固定 owners=[user_id],这里放宽为全体用户
        Conf.MG_ANNO_JOB_PERFORM.update_many(
            {"label_spec.data.seq": seq}, {"$set": {"authority.owners": all_user_ids}})
        Conf.MG_DATA_SEQ_META.update_many(
            {"job.seq": seq}, {"$set": {"authority.owners": all_user_ids}})
        Conf.MG_DATA_STREAM_META.update_many(
            {"job.seq": seq}, {"$set": {"authority.owners": all_user_ids}})
        created.append(name)
        logger.info(f"demo job 已创建: {name} (seq={seq})")
    return f"created {len(created)} demo jobs, base={base}"


async def downgrade() -> str:
    Conf.MG_ANNO_JOB_PERFORM.delete_many(
        {"label_spec.data.seq": {"$regex": f"^{DEMO_SEQ_PREFIX}"}})
    Conf.MG_DATA_SEQ_META.delete_many(
        {"job.seq": {"$regex": f"^{DEMO_SEQ_PREFIX}"}})
    Conf.MG_DATA_STREAM_META.delete_many(
        {"job.seq": {"$regex": f"^{DEMO_SEQ_PREFIX}"}})
    return "removed demo jobs"
