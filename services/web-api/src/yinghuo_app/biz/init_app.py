"""
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-09-24"

from yinghuo_conf.config import gConf
from ..config import Conf
from ..log import logger
from .services.user import user_service
from yinghuo_app.dto.users import UserCreate, UserUpdate

async def init_user_admin():
    logger.info("init admin user")
    admin_user = gConf['admin']['user']
    admin_passwd = gConf['admin']['password']

    exist_user = await user_service.get_by_username(admin_user)
    if exist_user:
        logger.info("admin user already exists")
        return

    new_usser = await user_service.create_user(UserCreate(
        email=admin_user,
        password=admin_passwd,
        # 普通用户,角色绑定由 dev_seed.seed_dev_data(CE)或
        # saas.platform.seed.seed_platform_data(SAAS)负责。
        is_superuser=False,
    ))
    logger.info("create admin user")
    print(new_usser)

async def init_mongo_collections():
    """显式建集合。

    FerretDB (postgres-documentdb) 对「不存在的集合」做 count_documents / find /
    aggregate 时会报 `cache lookup failed for type 0`(documentdb_api 内部 tupdesc
    没物化),而原版 MongoDB 是惰性建集合,这就导致冷启动后第一个访问
    MG_ANNO_JOB_PERFORM / MG_COUNTER 等接口的请求全部 500。

    启动期主动 create_collection,触发 documentdb_api 物化底表,
    后续 read 走空集合路径也安全。
    """
    logger.info("init mongo collections")
    db = Conf.MG_ANNO_JOB_PERFORM.database
    existing = set(db.list_collection_names())

    wanted = set()
    for attr in dir(Conf):
        if not attr.startswith("MG_"):
            continue
        coll = getattr(Conf, attr)
        # MG_COLLECTION 是 dict[name, Collection];其他 MG_* 是单个 Collection
        if hasattr(coll, "name"):
            wanted.add(coll.name)
        elif isinstance(coll, dict):
            wanted.update(c.name for c in coll.values() if hasattr(c, "name"))

    created = 0
    for name in sorted(wanted):
        if name in existing:
            continue
        try:
            db.create_collection(name)
            logger.info(f"  created mongo collection: {name}")
            created += 1
        except Exception as e:
            # 兼容并发启动场景:可能另一进程已经建好
            logger.warning(f"  create_collection({name}) failed: {e!r}")
    logger.info(f"init mongo collections done ({created} new)")


async def init_mongo_indexes():
    logger.info("init mongo indexes")
    
    # user_team
    collection = Conf.MG_USER_TEAM
    indexes = collection.list_indexes()
    index_exists = any(
        index for index in indexes
        if (
            index['key'] == [('creater', 1), ('email', 1)] and
            index.get('unique', False) is True
        )
    )
    if not index_exists:
        logger.info("创建唯一索引creater,email")
        collection.create_index([("creater", 1), ("email", 1)], unique=True)
    else:
        logger.info("唯一索引creater,email已经存在")
    
    # label collection
    index_cols = [('jobConfig.uuid', 1),
                  ('jobConfig.seq', 1),
                  ('jobConfig.stream', 1),
                  ('jobConfig.frame', 1),
                  ('authority.owner', 1)]
    for k, v in Conf.MG_COLLECTION.items():
        collection = v
        indexes = collection.list_indexes()
        index_exists = any(
            index for index in indexes
            if (
                index['key'] == index_cols and
                index.get('unique', False) is True
            )
        )
        if not index_exists:
            logger.info(f"创建{k}的唯一索引")
            collection.create_index(index_cols, unique=True)
        else:
            logger.info("{k}的唯一索引存在")

    # unit_label:(tenant_id, unit_id, version) 唯一,支撑乐观锁与版本查询;
    # (tenant_id, project_id, mission) 用于按项目+mission 列表过滤。
    ul = Conf.MG_UNIT_LABEL
    ul_unique_cols = [('tenant_id', 1), ('unit_id', 1), ('version', 1)]
    ul_filter_cols = [('tenant_id', 1), ('project_id', 1), ('mission', 1)]

    def _has_unique(coll, cols):
        return any(
            ix for ix in coll.list_indexes()
            if ix['key'] == cols and ix.get('unique', False) is True
        )

    def _has_index(coll, cols):
        return any(ix for ix in coll.list_indexes() if ix['key'] == cols)

    if not _has_unique(ul, ul_unique_cols):
        logger.info("创建 unit_label 唯一索引 (tenant_id, unit_id, version)")
        ul.create_index(ul_unique_cols, unique=True)
    if not _has_index(ul, ul_filter_cols):
        logger.info("创建 unit_label 索引 (tenant_id, project_id, mission)")
        ul.create_index(ul_filter_cols)
