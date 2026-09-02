"""启动时应用 yinghuo_app/migrations/data/ 下的数据迁移。

migrations/models/ 是 aerich 的表结构迁移(实际建表走 Tortoise.generate_schemas);
数据迁移放包内 yinghuo_app/migrations/data/(随 pip install 进镜像),
每个文件提供 ``async def upgrade() -> str``
(可选 ``async def downgrade()``),按文件名排序应用。已应用的记录在 Mongo
data_migration 集合,只跑未应用的;单个失败记 error 不阻断启动,下次启动重试。
"""
import importlib.util
from pathlib import Path

from ..config import Conf
from ..log import logger

# 包内路径: dev 直跑 src/ 与容器内 site-packages 安装两种方式都能解析
DATA_MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations" / "data"


async def apply_data_migrations() -> None:
    if not DATA_MIGRATIONS_DIR.is_dir():
        logger.warning(f"data migrations dir not found: {DATA_MIGRATIONS_DIR}")
        return
    for path in sorted(DATA_MIGRATIONS_DIR.glob("*.py")):
        if path.name.startswith("_"):
            continue
        if Conf.MG_DATA_MIGRATION.find_one({"name": path.name}):
            continue
        try:
            spec = importlib.util.spec_from_file_location(
                f"yh_data_migration.{path.stem}", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            upgrade = getattr(mod, "upgrade", None)
            if not callable(upgrade):
                raise AttributeError("缺少 async upgrade()")
            rtn = await upgrade()
            Conf.MG_DATA_MIGRATION.insert_one(
                {"name": path.name, "result": str(rtn)})
            logger.info(f"data migration applied: {path.name} ({rtn})")
        except Exception:
            logger.exception(f"data migration failed: {path.name}")
