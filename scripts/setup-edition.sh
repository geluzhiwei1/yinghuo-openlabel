#!/usr/bin/env bash
# 把 EE/SaaS 私有仓库挂载到 CE 工作树。
#
# 用法:
#   scripts/setup-edition.sh ce       # 啥也不做(CE 模式不需要任何挂载)
#   scripts/setup-edition.sh ee       # 挂 EE
#   scripts/setup-edition.sh saas     # 挂 EE + SaaS(SaaS 依赖 EE)
#   scripts/setup-edition.sh teardown # 卸载所有挂载点
#
# 环境变量:
#   YH_EDITION_EE_REPO    (默认 git@github.com:geluzhiwei1/yinghuo-openlabel-ee.git)
#   YH_EDITION_SAAS_REPO  (默认 git@github.com:geluzhiwei1/yinghuo-openlabel-saas.git)
#   YH_EDITION_EE_REF     (默认 master,可设为 tag/commit)
#   YH_EDITION_SAAS_REF   (默认 master)
#   YH_EDITION_CLONE_ROOT (默认 $(dirname $(realpath .))/yinghuo-openlabel-{ee,saas},
#                          即本仓库的同级目录;EE/SaaS 实际 clone 在此,再用 symlink 挂入)
#
# 挂载机制:非托管 clone(不用 git submodule)。
#   - 真正的 git clone 在 $CLONE_ROOT 下,可以独立 git pull/commit
#   - CE 工作树内的 ee/ saas/ 路径是 symlink,指向 clone 内的对应子目录
#   - .gitignore 已排除这些路径,主仓库不会误跟踪
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EE_REPO="${YH_EDITION_EE_REPO:-git@github.com:geluzhiwei1/yinghuo-openlabel-ee.git}"
SAAS_REPO="${YH_EDITION_SAAS_REPO:-git@github.com:geluzhiwei1/yinghuo-openlabel-saas.git}"
EE_REF="${YH_EDITION_EE_REF:-master}"
SAAS_REF="${YH_EDITION_SAAS_REF:-master}"
CLONE_ROOT_DEFAULT="$(dirname "$ROOT_DIR")"
CLONE_ROOT="${YH_EDITION_CLONE_ROOT:-$CLONE_ROOT_DEFAULT}"

EE_CLONE_PATH="$CLONE_ROOT/yinghuo-openlabel-ee"
SAAS_CLONE_PATH="$CLONE_ROOT/yinghuo-openlabel-saas"

# CE 工作树内的挂载点
EE_BACKEND_MOUNT="services/web-api/src/yinghuo_app/ee"
EE_FRONTEND_ENTRIES_MOUNT="apps/web-app/ee"
EE_FRONTEND_SRC_MOUNT="apps/web-app/src/ee"
SAAS_BACKEND_MOUNT="services/web-api/src/yinghuo_app/saas"
SAAS_FRONTEND_ENTRIES_MOUNT="apps/web-app/saas"
SAAS_FRONTEND_SRC_MOUNT="apps/web-app/src/saas"

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 {ce|ee|saas|teardown}" >&2
  exit 1
fi

clone_or_update() {
  local repo="$1" path="$2" ref="$3"
  if [[ -d "$path/.git" ]]; then
    echo "==> Existing clone at $path (ref=$ref)"
    # 有 origin 才尝试 fetch;本地 init 的仓库无 remote 也能用
    if git -C "$path" remote get-url origin >/dev/null 2>&1; then
      git -C "$path" fetch origin || true
      git -C "$path" reset --hard "origin/$ref" 2>/dev/null || git -C "$path" checkout "$ref" || true
    else
      echo "    (no 'origin' remote, using working tree as-is)"
      git -C "$path" checkout "$ref" 2>/dev/null || true
    fi
  else
    echo "==> Cloning $repo → $path (ref=$ref)"
    git clone --branch "$ref" "$repo" "$path" 2>/dev/null || {
      # --branch 失败(tag/commit 而非 branch),回退默认 clone 再 checkout
      git clone "$repo" "$path"
      git -C "$path" checkout "$ref"
    }
  fi
}

mount_symlink() {
  local src="$1" dst="$2"
  if [[ -e "$dst" || -L "$dst" ]]; then
    rm -rf "$dst"
  fi
  mkdir -p "$(dirname "$dst")"
  ln -s "$src" "$dst"
  echo "    $dst → $src"
}

# 像 mount_symlink,但为目录里每个文件单独建 symlink(父目录在 CE 树里物理存在)。
# 用于 HTML 入口:vite 把入口路径 follow 到 EE clone 后,产出文件名会带相对路径 ..,
# rollup 会拒绝。改用文件级 symlink 让 vite 看到的"输入路径"父目录仍是 CE 路径。
mount_symlink_children() {
  local src_dir="$1" dst_dir="$2"
  if [[ -e "$dst_dir" || -L "$dst_dir" ]]; then
    rm -rf "$dst_dir"
  fi
  mkdir -p "$dst_dir"
  for f in "$src_dir"/*; do
    [[ -e "$f" ]] || continue
    ln -s "$f" "$dst_dir/$(basename "$f")"
  done
  echo "    $dst_dir/* → $src_dir/*"
}

mount_copy_dir() {
  # 物理拷贝整个目录(非 symlink)。用于 HTML 入口:vite 对 input 调 realpath,
  # 即使文件级 symlink,产出名仍会带 ../.. 被 rollup 拒。HTML 改动少,拷贝代价小。
  local src_dir="$1" dst_dir="$2"
  if [[ -e "$dst_dir" || -L "$dst_dir" ]]; then
    rm -rf "$dst_dir"
  fi
  mkdir -p "$dst_dir"
  cp -r "$src_dir/." "$dst_dir/"
  echo "    $dst_dir/ (copied from $src_dir)"
}

mount_ee() {
  echo "==> Mounting EE"
  mount_symlink "$EE_CLONE_PATH/backend" "$EE_BACKEND_MOUNT"
  # HTML 入口物理拷贝,避免 vite/rollup realpath 问题
  mount_copy_dir "$EE_CLONE_PATH/frontend-entries" "$EE_FRONTEND_ENTRIES_MOUNT"
  # Vue 源码用 symlink,改动即时回写到 EE 仓库
  mount_symlink "$EE_CLONE_PATH/frontend-src" "$EE_FRONTEND_SRC_MOUNT"
  # EE clone 内补 node_modules symlink → CE apps/web-app/node_modules
  link_node_modules "$EE_CLONE_PATH" "$ROOT_DIR/apps/web-app/node_modules"
}

mount_saas() {
  echo "==> Mounting SaaS"
  mount_symlink "$SAAS_CLONE_PATH/backend" "$SAAS_BACKEND_MOUNT"
  if [[ ! -d "$SAAS_CLONE_PATH/frontend-entries" ]]; then
    mkdir -p "$SAAS_CLONE_PATH/frontend-entries"
  fi
  if [[ ! -d "$SAAS_CLONE_PATH/frontend-src" ]]; then
    mkdir -p "$SAAS_CLONE_PATH/frontend-src"
  fi
  mount_copy_dir "$SAAS_CLONE_PATH/frontend-entries" "$SAAS_FRONTEND_ENTRIES_MOUNT"
  mount_symlink "$SAAS_CLONE_PATH/frontend-src" "$SAAS_FRONTEND_SRC_MOUNT"
  link_node_modules "$SAAS_CLONE_PATH" "$ROOT_DIR/apps/web-app/node_modules"
}

link_node_modules() {
  local clone_path="$1" target="$2"
  if [[ -L "$clone_path/node_modules" || -e "$clone_path/node_modules" ]]; then
    rm -rf "$clone_path/node_modules"
  fi
  ln -s "$target" "$clone_path/node_modules"
  echo "    $clone_path/node_modules → $target"
}

teardown() {
  echo "==> Removing all edition mounts"
  for p in \
    "$EE_BACKEND_MOUNT" "$EE_FRONTEND_ENTRIES_MOUNT" "$EE_FRONTEND_SRC_MOUNT" \
    "$SAAS_BACKEND_MOUNT" "$SAAS_FRONTEND_ENTRIES_MOUNT" "$SAAS_FRONTEND_SRC_MOUNT"; do
    if [[ -L "$p" || -d "$p" ]]; then
      rm -rf "$p"
      echo "    removed $p"
    fi
  done
}

case "$ACTION" in
  ce)
    echo "==> CE edition: no external mounts required"
    teardown || true
    ;;
  ee)
    clone_or_update "$EE_REPO" "$EE_CLONE_PATH" "$EE_REF"
    mount_ee
    # EE 模式不应有 saas 残留
    for p in "$SAAS_BACKEND_MOUNT" "$SAAS_FRONTEND_ENTRIES_MOUNT" "$SAAS_FRONTEND_SRC_MOUNT"; do
      [[ -e "$p" || -L "$p" ]] && rm -rf "$p"
    done
    echo "==> EE mounted. Use YH_EDITION=ee for builds."
    ;;
  saas)
    # SaaS 依赖 EE(跨包 import ee.platform.audit 等)
    clone_or_update "$EE_REPO" "$EE_CLONE_PATH" "$EE_REF"
    clone_or_update "$SAAS_REPO" "$SAAS_CLONE_PATH" "$SAAS_REF"
    mount_ee
    mount_saas
    echo "==> EE + SaaS mounted. Use YH_EDITION=saas for builds."
    ;;
  teardown)
    teardown
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    echo "Usage: $0 {ce|ee|saas|teardown}" >&2
    exit 1
    ;;
esac

echo "==> Done."
