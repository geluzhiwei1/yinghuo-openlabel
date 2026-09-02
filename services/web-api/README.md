# web-api · 后端

FastAPI(Python 3.12+)单体服务,包名 `yinghuo_app`。

## 启动

```bash
# 依赖管理用 uv
uv sync

# YH_CONFIG_FILE 必须指向一份配置 yaml
YH_CONFIG_FILE=config/yinghuo.yaml \
  .venv/bin/python -m uvicorn yinghuo_app.app:app --port 8423 --reload
```

一键启动(数据库 + 后端 + 前端)见仓库根 `scripts/dev/start-ce.bash`。

## 路由与网关约定

- 网关(生产 nginx / 开发 vite proxy)把 `/api/v1/b/*` **剥掉前缀**后转给本服务,业务路由挂在根路径(`/seq`、`/file`、`/anno-job`、`/projects` 等,注册见 `apps/init_app.py`)。
- `/api/v1/c/*`:登录前验证码(captcha / 邮件 / 短信),免 token。
- `/api/v1/p/*`:平台面路由(仅 EE/SaaS 版挂载,CE 无)。
- 业务接口走 JWT Bearer(`Authorization: Bearer <access_token>`)。

## 配置体系

单一 YAML(`YH_CONFIG_FILE` 指向),含 PostgreSQL / FerretDB(Mongo 兼容)/ Redis 连接、数据根目录、日志等。没有该文件服务拒绝启动。

## 存储分工

| 存储 | 用途 |
|---|---|
| PostgreSQL + Tortoise ORM | 用户/租户/角色等关系数据 |
| FerretDB + Motor | 标注任务、标注数据、序列元数据 |
| Redis | 会话/验证码/缓存 |
| 数据根目录 | 原始数据包与导出产物(经 `/file/`、`/file2/get` 下发) |

## 目录

```
src/yinghuo_app/
├── app.py            # FastAPI 入口、中间件、鉴权
├── apps/             # 路由层(*_app.py / *.py)
├── biz/              # 服务层:db models、job/label/user 等领域逻辑
├── algos/            # 点云算法(投影、帧 URI 构造等)
├── captcha/          # 验证码
├── config.py         # Conf/gConf 配置加载
└── edition.py        # CE/EE/SaaS 版本门控
```

测试:`pytest`(冒烟在 `tests/test_smoke.py`)。
