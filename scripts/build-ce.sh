#!/usr/bin/env bash
# Build a clean Community Edition (YH_EDITION=ce) source tarball.
#
# 新拓扑(2026-07-30 仓库拆分后):
#   CE = yinghuo-openlabel 主仓库(本仓库)的内容,不含 ee/ saas/ 挂载点。
#   ee/ 与 saas/ 路径即使被 yinghuo-openlabel-ee/saas 私有仓的 setup-edition.sh
#   挂上了 symlink,本脚本也会校验它们不存在,确保发布物纯 CE。
#
# 校验逻辑:
#   1. 必须没有 ee/saas 挂载(若有,到私有仓跑 setup-edition.sh teardown)
#   2. YH_EDITION=ce 后端装配通过
#   3. 前端 YH_EDITION=ce 构建通过
#   4. tarball 不含 ee/ saas/ LICENSE.EE LICENSE.SAAS

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 选 Python:优先用项目 venv,没有就回退系统 python3
PYTHON_BIN="$ROOT_DIR/services/web-api/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="${PYTHON:-python3}"
fi
echo "==> Using Python: $PYTHON_BIN"

# 1. 校验:CE 必须没有 ee/saas 挂载点
for p in \
  services/web-api/src/yinghuo_app/ee \
  services/web-api/src/yinghuo_app/saas \
  apps/web-app/ee apps/web-app/src/ee \
  apps/web-app/saas apps/web-app/src/saas; do
  if [[ -e "$p" || -L "$p" ]]; then
    echo "ERROR: $p 存在,CE 构建必须先卸载 EE/SaaS 挂载" >&2
    echo "  到 yinghuo-openlabel-ee 或 yinghuo-openlabel-saas 私有仓运行 CE_ROOT=$ROOT_DIR scripts/setup-edition.sh teardown" >&2
    exit 1
  fi
done

VERSION="${VERSION:-$(git rev-parse --short HEAD)}"
OUT_DIR="${OUT_DIR:-dist}"
TARBALL="$OUT_DIR/yinghuo-openlabel-ce-${VERSION}.tar.gz"

echo "==> Building frontend (YH_EDITION=ce)..."
(
  cd apps/web-app
  YH_EDITION=ce pnpm install --frozen-lockfile
  YH_EDITION=ce pnpm build
)

echo "==> Verifying backend import (YH_EDITION=ce)..."
(
  cd services/web-api
  YH_EDITION=ce YH_CONFIG_FILE=config/yinghuo-ci.yaml PYTHONPATH=src "$PYTHON_BIN" \
    -c "from yinghuo_app.app import app; print('CE app assembled OK, routes:', len(app.routes))"
)

echo "==> Packing tarball (CE only)..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

WORKDIR="$(mktemp -d)"
git archive --format=tar HEAD | tar -x -C "$WORKDIR"

tar -czf "$TARBALL" -C "$WORKDIR" .
rm -rf "$WORKDIR"

echo "==> Built: $TARBALL"
echo "==> Sanity: tarball must contain zero ee/ or saas/ paths"
MANIFEST=$(tar tzf "$TARBALL")
LEAKS=$(echo "$MANIFEST" | grep -E "/ee/|/saas/|^LICENSE\.(EE|SAAS)$" || true)
if [ -n "$LEAKS" ]; then
  echo "ERROR: commercial code leaked into CE tarball:" >&2
  echo "$LEAKS" >&2
  exit 1
fi
echo "==> CE tarball sanity check passed"
