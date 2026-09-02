# dev setup — CE(社区版)

> 三版分层:CE ⊂ EE ⊂ SaaS。本文只覆盖 **CE**(`YH_EDITION` 默认或 `=ce`)。
> EE / SaaS 的本地开发文档与脚本引用私有仓库,不进 CE 仓库(见 `.gitignore` 相应条目)。
> 端口 / 账号 / 路由一览见 [start.md](./start.md#端口--账号--路由一览) 或 [dev 信息面板](../../apps/web-app/dev.html)。

## 0. 一键启动(推荐)

`scripts/dev/start-ce.bash` 把下面 §1~§3 全部封装,在 tmux 三窗口里跑(db / api / web):

```bash
./scripts/dev/start-ce.bash           # 启动并 attach
./scripts/dev/start-ce.bash -d        # 后台启动,不 attach
./scripts/dev/start-ce.bash status    # 看 tmux + docker 状态
./scripts/dev/start-ce.bash stop      # 停 session + docker compose down
```

Python 环境自动探测:优先 `YH_DEV_PYTHON`,再 `services/web-api/.venv`,再 conda env `yinghuo-dev`,最后 `python3.12`。首次运行自动建 `.venv` 并 `pip install -e .`,前端自动 `pnpm install`。

不想用脚本就走下面手动步骤。

## 1. 启动数据库

```bash
docker compose -f docker/docker-compose-dev.yaml up -d
docker exec -it yh-dev-postgres psql -U dev -d postgres -c "CREATE DATABASE \"yinghuo-dev\";"
```

## 2. 启动 Web API

**Python 必须 3.12.x**(`open3d` 在 PyPI 只发了 cp312 wheel)。

```bash
conda create -n yinghuo-dev python=3.12 && conda activate yinghuo-dev
cd services/web-api
pip install -e .

YH_CONFIG_FILE=config/yinghuo.yaml python -m uvicorn yinghuo_app.app:app --port 8423 --reload
```

启动时 lifespan 自动建表 + seed(`biz/dev_seed.seed_dev_data`):52 权限、5 内置角色模板、3 工作流模板、`test` 租户、3 feature flag、`prod@geluzhiwei.com` 与每角色测试账号。

## 3. 启动前端

```bash
cd apps/web-app
pnpm install
pnpm run dev   # 自动打开 dev.html
```

CE 只有业务面入口(`home.html`)。`tenant_admin.html` / `platform.html` 由 EE/SAAS 通过 `setup-edition.sh` 挂载,CE 模式访问会 404。

## 4. CLI

```bash
cd services/web-api
YH_CONFIG_FILE=config/yinghuo.yaml python -m yinghuo_cmd.anno --help   # 标注导出/导入
YH_CONFIG_FILE=config/yinghuo.yaml python -m yinghuo_cmd.job --help     # 任务管理
```

注意是 `yinghuo_cmd.anno`(点号),不是 `yinghuo_cmd anno`(空格)——包没有 `__main__.py`。

## 已知坑

- **`YH_CONFIG_FILE` 必须显式给**:loader 只看 `YH_CONFIG_FILE` env 与 `./yinghuo.yaml` 两条路径,仓库根没有 `yinghuo.yaml`,只有 `services/web-api/config/yinghuo.yaml`。
- **Python 必须 3.12**:open3d 在 PyPI 只发了 cp312 wheel。
- **`setuptools<81` 必须显式 pin**:passlib 还在用 `pkg_resources`,setuptools 81+ 把这个模块删了。`pyproject.toml` 已经 pin 了。
- **`tortoise-orm` 不要降级到 0.x**:源端代码用了 `_enable_global_fallback=True`(tortoise 1.x 的兼容 API)。
- **Mongo 必须带 auth**:FerretDB 走 postgres 透传 auth,URI 必须是 `mongodb://dev:dev@127.0.0.1:27017/?authMechanism=PLAIN`。
- **Captcha 严检**:登录请求必须带 `X-Captcha-Id` HTTP header(不只是 body 里的 captchaId),否则中间件直接 401。完整流程见 dev 信息面板。
- **`captcha.db`**:auth 中间件用 SQLite 存验证码记录,落在 `services/web-api/captcha.db`。验证码异常时删掉这个文件让 lifespan 重建即可。
