#!/usr/bin/env bash
# Build an Enterprise Edition (YH_EDITION=ee) source tarball for self-hosted deployment.
#
# 新拓扑(2026-07-30 仓库拆分后):
#   EE = CE 主仓库 + yinghuo-openlabel-ee 仓库的内容,通过 setup-edition.sh ee 挂载
#   ee/ 路径作为 symlink 指向 yinghuo-openlabel-ee/backend, frontend-entries, frontend-src
#
# 校验逻辑:
#   1. ee/ 必须挂上,saas/ 必须没挂(EE 不含 SaaS)
#   2. YH_EDITION=ee 后端装配通过
#   3. 前端 YH_EDITION=ee 构建通过
#   4. tarball 必须:含 ee/ 关键资产 + LICENSE.EE;不含任何 saas/ 或 LICENSE.SAAS
#
# tar 打包策略:
#   git archive HEAD 只取主仓库(CE 部分),需补:
#     - 把 yinghuo-openlabel-ee clone 内的 backend/frontend-entries/frontend-src 物理拷进 tar
#     - 把 yinghuo-openlabel-ee/LICENSE 复制为 LICENSE.EE

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="$ROOT_DIR/services/web-api/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="${PYTHON:-python3}"
fi
echo "==> Using Python: $PYTHON_BIN"

# 1. 校验挂载状态
EE_BACKEND="services/web-api/src/yinghuo_app/ee"
EE_FRONTEND_ENTRIES="apps/web-app/ee"
EE_FRONTEND_SRC="apps/web-app/src/ee"
SAAS_BACKEND="services/web-api/src/yinghuo_app/saas"

if [[ ! -e "$EE_BACKEND" ]]; then
  echo "ERROR: $EE_BACKEND 未挂载" >&2
  echo "  运行: scripts/setup-edition.sh ee" >&2
  exit 1
fi
if [[ -e "$SAAS_BACKEND" || -L "$SAAS_BACKEND" ]]; then
  echo "ERROR: $SAAS_BACKEND 存在,EE 构建不允许挂 SaaS" >&2
  echo "  运行: scripts/setup-edition.sh ee (会自动清掉 saas/ 挂载)" >&2
  exit 1
fi

# 解析 EE clone 真实路径(通过 symlink)
EE_CLONE_PATH="$("$PYTHON_BIN" -c "import os; print(os.path.dirname(os.path.realpath('$EE_BACKEND')))")"
echo "==> EE clone: $EE_CLONE_PATH"

if [[ ! -f "$EE_CLONE_PATH/LICENSE" ]]; then
  echo "ERROR: EE clone 缺少 LICENSE 文件($EE_CLONE_PATH/LICENSE)" >&2
  exit 1
fi

VERSION="${VERSION:-$(git rev-parse --short HEAD)}"
OUT_DIR="${OUT_DIR:-dist}"
TARBALL="$OUT_DIR/yinghuo-openlabel-ee-${VERSION}.tar.gz"

echo "==> Building frontend (YH_EDITION=ee)..."
(
  cd apps/web-app
  YH_EDITION=ee pnpm install --frozen-lockfile
  YH_EDITION=ee pnpm build
)

echo "==> Verifying backend import (YH_EDITION=ee)..."
(
  cd services/web-api
  YH_EDITION=ee YH_CONFIG_FILE=config/yinghuo-ci.yaml PYTHONPATH=src "$PYTHON_BIN" \
    -c "from yinghuo_app.app import app; print('EE app assembled OK, routes:', len(app.routes))"
)

echo "==> Packing tarball (CE + EE)..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

WORKDIR="$(mktemp -d)"
git archive --format=tar HEAD | tar -x -C "$WORKDIR"

# 把 EE clone 的三个子目录物化进 tarball(覆盖 symlink)
mkdir -p "$WORKDIR/$(dirname "$EE_BACKEND")"
rm -rf "$WORKDIR/$EE_BACKEND"
cp -r "$EE_CLONE_PATH/backend" "$WORKDIR/$EE_BACKEND"

mkdir -p "$WORKDIR/$(dirname "$EE_FRONTEND_ENTRIES")"
rm -rf "$WORKDIR/$EE_FRONTEND_ENTRIES"
cp -r "$EE_CLONE_PATH/frontend-entries" "$WORKDIR/$EE_FRONTEND_ENTRIES"

mkdir -p "$WORKDIR/$(dirname "$EE_FRONTEND_SRC")"
rm -rf "$WORKDIR/$EE_FRONTEND_SRC"
cp -r "$EE_CLONE_PATH/frontend-src" "$WORKDIR/$EE_FRONTEND_SRC"

# LICENSE.EE
cp "$EE_CLONE_PATH/LICENSE" "$WORKDIR/LICENSE.EE"

tar -czf "$TARBALL" -C "$WORKDIR" .
rm -rf "$WORKDIR"

echo "==> Built: $TARBALL"
echo "==> Sanity: tarball must contain ee/, exclude saas/"
# 注意:不能用 `tar | grep -q` 配 pipefail —— grep -q 命中即退出,tar 会收 SIGPIPE 退非零,
# pipefail 把它当 pipeline 失败。先 dump 文件清单到变量,再 grep。
MANIFEST=$(tar tzf "$TARBALL")

LEAKS=$(echo "$MANIFEST" | grep -E "/saas/|^LICENSE.SAAS$" || true)
if [ -n "$LEAKS" ]; then
  echo "ERROR: SaaS code leaked into EE tarball:" >&2
  echo "$LEAKS" >&2
  exit 1
fi
if ! echo "$MANIFEST" | grep -q "yinghuo_app/ee/platform/auth.py"; then
  echo "ERROR: EE tarball missing ee/platform/auth.py" >&2
  exit 1
fi
if ! echo "$MANIFEST" | grep -q "^./LICENSE.EE$"; then
  echo "ERROR: EE tarball missing LICENSE.EE" >&2
  exit 1
fi
echo "==> EE tarball sanity check passed"
