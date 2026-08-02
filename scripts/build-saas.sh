#!/usr/bin/env bash
# Build the SaaS Edition (YH_EDITION=saas) for internal cloud deployment.
#
# 新拓扑(2026-07-30 仓库拆分后):
#   SaaS = CE 主仓库 + yinghuo-openlabel-ee + yinghuo-openlabel-saas
#   通过 setup-edition.sh saas 挂载,ee/ 与 saas/ 都作为 symlink 存在
#
# SaaS 是商业化运营版本,仅做装配验证 + Docker 镜像构建,不发布源码 tarball。
# 实际产物由 scripts/docker_release 负责。
#
# 校验逻辑:
#   1. ee/ 与 saas/ 都必须挂上
#   2. YH_EDITION=saas 后端装配通过
#   3. 前端 YH_EDITION=saas 构建通过

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="$ROOT_DIR/services/web-api/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="${PYTHON:-python3}"
fi
echo "==> Using Python: $PYTHON_BIN"

EE_BACKEND="services/web-api/src/yinghuo_app/ee"
SAAS_BACKEND="services/web-api/src/yinghuo_app/saas"

# 1. 校验挂载
if [[ ! -e "$EE_BACKEND" ]]; then
  echo "ERROR: $EE_BACKEND 未挂载" >&2
  echo "  运行: scripts/setup-edition.sh saas" >&2
  exit 1
fi
if [[ ! -e "$SAAS_BACKEND" ]]; then
  echo "ERROR: $SAAS_BACKEND 未挂载" >&2
  echo "  运行: scripts/setup-edition.sh saas" >&2
  exit 1
fi

echo "==> Building frontend (YH_EDITION=saas,复用 ee/ 入口)..."
(
  cd apps/web-app
  YH_EDITION=saas pnpm install --frozen-lockfile
  YH_EDITION=saas pnpm build
)

echo "==> Verifying backend import (YH_EDITION=saas)..."
(
  cd services/web-api
  YH_EDITION=saas YH_CONFIG_FILE=config/yinghuo-ci.yaml PYTHONPATH=src "$PYTHON_BIN" \
    -c "from yinghuo_app.app import app; print('SaaS app assembled OK, routes:', len(app.routes))"
)

echo "==> Sanity: SaaS 关键资产都应存在"
test -f services/web-api/src/yinghuo_app/ee/platform/auth.py      || { echo "missing ee/platform/auth.py"; exit 1; }
test -f services/web-api/src/yinghuo_app/saas/platform/tenants.py || { echo "missing saas/platform/tenants.py"; exit 1; }
echo "==> SaaS sanity check passed (实际打镜像请走 docker_release)"
