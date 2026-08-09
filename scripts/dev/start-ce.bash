#!/usr/bin/env bash
# 在一个 tmux session 里启动 CE dev 环境(数据库 / 后端 API / 前端)。
#
# 用法:
#   scripts/dev/start-ce.bash           # 默认启动并 attach
#   scripts/dev/start-ce.bash -d        # 启动但不 attach(后台跑)
#   scripts/dev/start-ce.bash stop      # 停 session + docker compose down
#   scripts/dev/start-ce.bash status    # 看 tmux + docker 状态
#
# tmux 窗口布局(session: yh-ce-dev):
#   1. db    — docker compose logs -f(实时日志,Ctrl-C 不会停容器)
#   2. api   — uvicorn yinghuo_app.app:app --port 8423 --reload
#   3. web   — pnpm run dev(端口 8400,自动打开 dev.html)
#
# Ctrl-b 1/2/3 切窗口;Ctrl-b d 脱离 session(继续跑)。
# 完整文档:docs/dev/start-ce.md;端口/账号一览:apps/web-app/dev.html。

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SESSION="yh-ce-dev"
COMPOSE="$ROOT_DIR/docker/docker-compose-dev.yaml"
WEB_API="$ROOT_DIR/services/web-api"
WEB_APP="$ROOT_DIR/apps/web-app"
VENV="$WEB_API/.venv"

log()  { printf '\033[36m[dev]\033[0m %s\n' "$*"; }
err()  { printf '\033[31m[err]\033[0m %s\n' "$*" >&2; }

require() {
  command -v "$1" >/dev/null 2>&1 || { err "缺少命令: $1"; exit 1; }
}

# ─── 子命令 ──────────────────────────────────────────────────────────────
SUBCMD="${1:-start}"
[[ "$SUBCMD" == "-d" ]] && { SUBCMD="start"; DETACH=1; }
[[ "${2:-}" == "-d" ]] && DETACH=1 || DETACH=${DETACH:-0}

case "$SUBCMD" in
  stop)
    if tmux kill-session -t "$SESSION" 2>/dev/null; then
      log "tmux session 已杀"
    else
      log "无 tmux session"
    fi
    log "docker compose down"
    docker compose -f "$COMPOSE" down
    exit 0
    ;;
  status)
    if tmux has-session -t "$SESSION" 2>/dev/null; then
      log "tmux session: active"
      tmux list-windows -t "$SESSION" 2>/dev/null
    else
      log "tmux session: not running"
    fi
    echo
    docker compose -f "$COMPOSE" ps 2>/dev/null || true
    exit 0
    ;;
  start)
    ;;
  *)
    err "未知子命令: $SUBCMD"
    err "Usage: $0 [start|stop|status] [-d]"
    exit 1
    ;;
esac

require tmux
require docker

# ─── 步骤 1:数据库容器 ──────────────────────────────────────────────────
log "启动 docker compose"
docker compose -f "$COMPOSE" up -d || { err "docker 启动失败"; exit 1; }

log "等待 postgres 就绪"
for i in $(seq 1 30); do
  if docker exec yh-dev-postgres pg_isready -U dev >/dev/null 2>&1; then
    log "  postgres ready (${i}s)"
    break
  fi
  sleep 1
  [[ $i -eq 30 ]] && { err "postgres 30s 内未就绪"; exit 1; }
done

log "确保 yinghuo-dev 数据库存在"
if ! docker exec yh-dev-postgres psql -U dev -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='yinghuo-dev'" | grep -q 1; then
  docker exec yh-dev-postgres psql -U dev -d postgres -c 'CREATE DATABASE "yinghuo-dev";' >/dev/null
  log "  yinghuo-dev 已创建"
else
  log "  yinghuo-dev 已存在"
fi

# ─── 步骤 2:Python 环境 ────────────────────────────────────────────────
# 探测优先级:YH_DEV_PYTHON > services/web-api/.venv > conda env yinghuo-dev > python3.12
detect_python() {
  if [[ -n "${YH_DEV_PYTHON:-}" && -x "$YH_DEV_PYTHON" ]]; then echo "$YH_DEV_PYTHON"; return 0; fi
  if [[ -x "$VENV/bin/python" ]]; then echo "$VENV/bin/python"; return 0; fi
  if command -v conda >/dev/null 2>&1; then
    local p; p=$(conda run -n yinghuo-dev which python 2>/dev/null || true)
    if [[ -n "$p" && -x "$p" ]]; then echo "$p"; return 0; fi
  fi
  if command -v python3.12 >/dev/null 2>&1; then echo "python3.12"; return 0; fi
  return 1
}

PYTHON=$(detect_python || true)
if [[ -z "$PYTHON" ]]; then
  log "未找到 Python 3.12,初始化 .venv"
  command -v python3.12 >/dev/null 2>&1 || { err "系统无 python3.12,可用 YH_DEV_PYTHON 指定路径"; exit 1; }
  python3.12 -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip 'setuptools<81' wheel
  PYTHON="$VENV/bin/python"
fi

# 校验 Python 版本 >= 3.12
PY_VER=$("$PYTHON" -c 'import sys;print("%d.%d"%sys.version_info[:2])')
PY_MAJOR=${PY_VER%.*}; PY_MINOR=${PY_VER#*.}
if [[ "$PY_MAJOR" -lt 3 || ( "$PY_MAJOR" -eq 3 && "$PY_MINOR" -lt 12 ) ]]; then
  err "Python $PY_VER 不符合要求(需要 3.12+,open3d 在 PyPI 只发了 cp312 wheel)"
  err "可用 YH_DEV_PYTHON=/path/to/python3.12 覆盖"
  exit 1
fi

# 首次或 yinghuo_app 未装时跑 pip install -e .
if ! "$PYTHON" -c "import yinghuo_app" >/dev/null 2>&1; then
  log "安装 web-api 依赖(首次较慢,含 open3d 等大包)"
  "$PYTHON" -m pip install -e "$WEB_API" || { err "pip install 失败"; exit 1; }
fi
log "  Python: $PYTHON ($PY_VER)"

# ─── 步骤 3:前端依赖 ────────────────────────────────────────────────────
if [[ ! -d "$WEB_APP/node_modules" ]]; then
  require pnpm
  log "安装前端依赖(首次较慢)"
  (cd "$WEB_APP" && pnpm install) || { err "pnpm install 失败"; exit 1; }
fi

# ─── 步骤 4:tmux session ───────────────────────────────────────────────
if tmux has-session -t "$SESSION" 2>/dev/null; then
  log "session 已存在,attach"
  [[ "$DETACH" == "0" ]] && exec tmux attach-session -t "$SESSION"
  exit 0
fi

log "创建 tmux session: $SESSION"

DB_CMD="echo '[db] docker compose logs -f (Ctrl-C 仅停止跟踪,不会停容器)'; \
docker compose -f '$COMPOSE' logs -f; \
echo; echo '★ 日志跟踪已退出'; sh"

API_CMD="echo '[api] uvicorn yinghuo_app.app:app --port 8423 --reload'; \
cd '$WEB_API' && YH_CONFIG_FILE=config/yinghuo.yaml '$PYTHON' -m uvicorn yinghuo_app.app:app --port 8423 --reload; \
echo; echo '★ api 已退出'; sh"

WEB_CMD="echo '[web] pnpm run dev (端口 8400, 自动打开 dev.html)'; \
cd '$WEB_APP' && pnpm run dev; \
echo; echo '★ web 已退出'; sh"

tmux new-session    -d -s "$SESSION" -n db  "$DB_CMD"
tmux new-window  -t "$SESSION" -n api "$API_CMD"
tmux new-window  -t "$SESSION" -n web "$WEB_CMD"

cat <<TIPS

[dev] 三窗口已就绪:
  Ctrl-b 1 → db    docker compose logs -f
  Ctrl-b 2 → api   uvicorn :8423
  Ctrl-b 3 → web   vite :8400

  Ctrl-b d     脱离 session(继续跑)
  $0 stop   停掉一切
  $0 status 查状态

TIPS

if [[ "$DETACH" == "0" ]]; then
  exec tmux attach-session -t "$SESSION"
else
  log "detached: 用 'tmux attach -t $SESSION' 进入"
fi
