"""备份 CLI,可被 systemd timer / cron 直接调用。

用法:
  YH_CONFIG_FILE=config/yinghuo-prod.yaml python -m yinghuo_cmd.backup run [--target DIR] [--no-pg] [--no-mongo]
  YH_CONFIG_FILE=config/yinghuo-prod.yaml python -m yinghuo_cmd.backup list

不依赖 HTTP 鉴权,直接调 service.execute_backup 同步跑完(无 Redis 状态)。
"""
import asyncio
import uuid
from pathlib import Path

import fire
from redis.asyncio import Redis

from yinghuo_app.config import gConf
from yinghuo_app.ee.platform.backup import service


async def _run_async(target: str | None, include_pg: bool, include_mongo: bool) -> dict:
    if target:
        # gConf 无 __setitem__,直接改它内部的 kvs dict
        try:
            gConf.kvs.setdefault("backup", {})["target_dir"] = target
        except AttributeError:
            pass
    # CLI 模式不需要 Redis 状态,用一个 no-op shim 替代
    redis = _NullRedis()
    job_id = uuid.uuid4().hex
    await service.execute_backup(
        redis,
        job_id=job_id,
        actor_id=None,
        include_pg=include_pg,
        include_mongo=include_mongo,
    )
    status = await service.get_job(redis, job_id) or {}
    return {"job_id": job_id, **status}


class _NullRedis:
    """CLI 不维护 Redis 状态,内存里临时存。"""
    def __init__(self):
        self._store = {}

    async def set(self, key, val, ex=None):
        self._store[key] = val

    async def get(self, key):
        return self._store.get(key)

    async def scan_iter(self, match=None):
        for k in list(self._store.keys()):
            if match and match.replace("*", "") in k:
                yield k


def run(target: str | None = None, no_pg: bool = False, no_mongo: bool = False):
    """触发一次备份,同步等待完成。

    Args:
        target: 备份目标目录(默认读 config backup.target_dir 或 /var/backups/yinghuo)
        no_pg: 跳过 PostgreSQL dump
        no_mongo: 跳过 MongoDB dump
    """
    result = asyncio.run(_run_async(target, include_pg=not no_pg, include_mongo=not no_mongo))
    print(f"job_id: {result.get('job_id')}")
    print(f"status: {result.get('status')}")
    if result.get("artifacts"):
        print("artifacts:")
        for a in result["artifacts"]:
            print(f"  {a}")
    if result.get("error"):
        print(f"error: {result['error']}")
        raise SystemExit(1)


def list_jobs(limit: int = 20):
    """列最近 N 个 job(仅当 Redis 里有状态时,CLI 一般不持久化)。"""
    async def _go():
        uri = gConf["global"]["redis"]["uri"]
        r = Redis.from_url(uri, encoding="utf-8", decode_responses=True)
        try:
            rows = await service.list_jobs(r, limit=limit)
            return rows
        finally:
            await r.close()
    rows = asyncio.run(_go())
    for row in rows:
        print(f"{row.get('job_id', '?')[:8]}  {row.get('status'):10}  {row.get('created_at', '')}")
    print(f"({len(rows)} jobs)")


if __name__ == "__main__":
    fire.Fire({
        "run": run,
        "list": list_jobs,
    })
