"""数据目录解析:用户私有目录 + 共享目录(shared-datas)双根。

前端 seq 形如 "/example-datas/xxx"(用户私有)或 "/shared-datas/xxx"(共享),
这里统一把 seq 解析成绝对路径,供目录树 / streams / 建任务 / 文件读取共用。
标注输出(_yh_output)不经过这里,始终写在用户自己的目录下。
"""
import os
import pathlib

from ..config import Conf, settings

SHARED_DIR_NAME = "shared-datas"


def user_data_root(user_id) -> str:
    return os.path.join(settings.YH_USER_DATA_ROOT, str(user_id))


def shared_data_root() -> str:
    return os.path.join(settings.YH_USER_DATA_ROOT, SHARED_DIR_NAME)


def split_shared_prefix(seq: str):
    """拆出 (is_shared, rest)。seq 以 shared-datas 开头时 rest 为剩余相对路径。"""
    s = (seq or "").strip("/")
    if s == SHARED_DIR_NAME or s.startswith(SHARED_DIR_NAME + "/"):
        return True, s[len(SHARED_DIR_NAME):].strip("/")
    return False, s


def resolve_seq_dir(user_id, seq: str):
    """seq → 绝对目录。shared 前缀走共享根,否则走用户根;含 .. 越界返回 None。"""
    is_shared, rest = split_shared_prefix(seq)
    base = shared_data_root() if is_shared else user_data_root(user_id)
    if ".." in rest.split("/"):
        return None
    base = os.path.normpath(base)
    target = os.path.normpath(os.path.join(base, rest))
    if target != base and not target.startswith(base + os.sep):
        return None
    return target


def file_uri_prefix(job_owner_id, seq: str) -> pathlib.PurePath:
    """seq → file_app URL 前缀。shared 前缀不含 owner 段(磁盘上不在用户目录下)。"""
    is_shared, rest = split_shared_prefix(seq)
    if is_shared:
        return pathlib.PurePath(Conf.FILE_PATH) / SHARED_DIR_NAME / rest
    return pathlib.PurePath(Conf.FILE_PATH) / str(job_owner_id) / rest
