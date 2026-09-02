"""Stage 10.3 v0 → v1 回填脚本。

把存量 workflow / instance 补齐 WorkflowVersion 体系:
1. Workflow 表加 current_version_id 列(若不存在)
2. WorkflowInstance 表加 workflow_version_id / migration_log 列(若不存在)
3. WorkflowVersion 表已由 Tortoise generate_schemas 创建
4. 给每个 workflow 创建 v1 active version,stages snapshot 自 workflow.stages
5. 把 workflow.current_version_id 指向新建的 v1
6. 给当前 status 仍是 pending/in_progress/arbitrate 的 instance 写 workflow_version_id

幂等:重复跑只补缺,不会重复创建 v1。

用法:
    YH_CONFIG_FILE=yinghuo-dev.yaml PYTHONPATH=src .venv/bin/python -m yinghuo_app.biz.workflow.migrate_v0
"""
from __future__ import annotations

import asyncio
import sys
import os

from tortoise import Tortoise


ALTERS = [
    # (label, ddl)
    ("add workflow.current_version_id",
     "ALTER TABLE workflow ADD COLUMN IF NOT EXISTS current_version_id BIGINT NULL"),
    ("idx workflow.current_version_id",
     "CREATE INDEX IF NOT EXISTS idx_workflow_current_version_id ON workflow (current_version_id)"),
    ("add workflow_instance.workflow_version_id",
     "ALTER TABLE workflow_instance ADD COLUMN IF NOT EXISTS workflow_version_id BIGINT NULL"),
    ("idx workflow_instance.workflow_version_id",
     "CREATE INDEX IF NOT EXISTS idx_workflow_instance_version_id ON workflow_instance (workflow_version_id)"),
    ("add workflow_instance.migration_log",
     "ALTER TABLE workflow_instance ADD COLUMN IF NOT EXISTS migration_log JSONB DEFAULT '[]'"),
]


async def _ensure_columns(conn) -> None:
    """ALTER TABLE 加新列 + 索引(IF NOT EXISTS,幂等)。"""
    for label, ddl in ALTERS:
        try:
            await conn.execute_query(ddl)
            print(f"  [ok] {label}")
        except Exception as e:
            print(f"  [skip] {label}: {str(e)[:120]}")


async def _backfill_versions(conn) -> None:
    """给每个没有 active version 的 workflow 创建 v1。"""
    from ..db.models import Workflow, WorkflowVersion
    wfs = await Workflow.filter(current_version_id__isnull=True)
    print(f"  待回填 workflow: {len(wfs)}")
    for wf in wfs:
        existing = await WorkflowVersion.filter(
            workflow_id=wf.id, version_no=1,
        ).first()
        if existing:
            vid = existing.id
        else:
            v = await WorkflowVersion.create(
                tenant_id=wf.tenant_id or "test",
                workflow_id=wf.id,
                version_no=1,
                stages=wf.stages or [],
                changelog="Stage 10.3 自动回填",
                created_by=None,
                is_active=True,
            )
            vid = v.id
        # 用 filter().update() 避开 auto_now 副作用(其实 Workflow 也有 auto_now updated_at)
        await Workflow.filter(id=wf.id).update(current_version_id=vid)
        print(f"    workflow {wf.id} → version v1 (id={vid})")


async def _backfill_instances(conn) -> None:
    """把存量 active instance 的 workflow_version_id 写成 workflow.current_version_id。"""
    res, _ = await conn.execute_query(
        "UPDATE workflow_instance wi "
        "SET workflow_version_id = w.current_version_id "
        "FROM workflow w "
        "WHERE wi.workflow_id = w.id "
        "  AND wi.workflow_version_id IS NULL "
        "  AND w.current_version_id IS NOT NULL "
        "  AND wi.current_status IN ('pending', 'in_progress', 'arbitrate')"
    )
    print(f"  instance 回填影响行数: {res}")


async def main() -> None:
    from yinghuo_app.config import settings
    await Tortoise.init(config=settings.TORTOISE_ORM)
    conn = Tortoise.get_connection("default")

    print("[0/4] generate_schemas(补建 workflow_version 表)...")
    # safe=True:CREATE TABLE IF NOT EXISTS,不破坏现有表
    await Tortoise.generate_schemas(safe=True)

    print("[1/4] ALTER TABLE 加列 + 索引...")
    await _ensure_columns(conn)
    print("[2/4] 给存量 workflow 创建 v1 active version...")
    await _backfill_versions(conn)
    print("[3/4] 给 active instance 写 workflow_version_id...")
    await _backfill_instances(conn)
    print("[4/4] done.")


if __name__ == "__main__":
    if not os.environ.get("YH_CONFIG_FILE"):
        os.environ["YH_CONFIG_FILE"] = "/home/work/ws/yinghuo/yinghuo-app/yinghuo-dev.yaml"
    if "src" not in sys.path:
        sys.path.insert(0, "src")
    asyncio.run(main())
