# 架构说明

面向开发者的整体架构。环境搭建见 [start-ce.md](./start-ce.md),生产部署见 [docker-production/README.md](../../docker-production/README.md)。

## 总览

```
                       ┌─────────────────────────────────┐
                       │  浏览器                          │
                       │  /guis/yinghuo/*.html (MPA)     │
                       └───────────┬─────────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                │  网关                                │
                │  生产: nginx(:6600)                  │
                │  开发: vite dev server(:8400)+proxy │
                └───────┬──────────────┬───────────────┘
                        │ 静态文件       │ /api/v1/b/* → 剥前缀
                        ▼              ▼
              apps/web-app/dist   services/web-api
              (Vue3 构建产物)      FastAPI(uvicorn,生产 :6610 / 开发 :8423)
                                       │
              ┌────────────┬───────────┼────────────┬──────────────┐
              ▼            ▼           ▼            ▼              ▼
         PostgreSQL    FerretDB      Redis     数据根目录     (EE/SaaS 增量)
         (Tortoise)    (Motor)     会话/验证码  原始数据包    /api/v1/p/*
```

## 前端(`apps/web-app`)

Vue 3 + TypeScript + Vite **多页应用**,base `/guis/yinghuo`。页面入口见 `vite.config.ts` 的 `build.rollupOptions.input`:

- `auth.html` 登录、`home.html` 主控台、`anno.html` 2D 标注、`pc.html` 3D 点云标注
- `dashboard.html` / `review.html` / `qa.html` 质量、审核、QA 工作台
- `nrrd.html` / `gaussian.html` 医学体数据 / 高斯泼溅
- `dev.html` 开发信息面板(dev server 根路径默认重定向到这里)

要点:

- 状态 Pinia,UI Element Plus,3D Three.js;ply/las/laz 点云解析走 Rust WASM(`ensureRustWasm` 前置),pcd 有 JS fallback。
- API 层在 `src/api/req.ts`,统一走 `/api/v1/b/*`;`/notifications/stream` 是 SSE,vite 里单独做了旁路转发。

## 后端(`services/web-api`)

FastAPI 单体,包名 `yinghuo_app`,Python 3.12+,依赖管理 uv。

```
src/yinghuo_app/
├── app.py          # 入口:lifespan(建连/seed/迁移)、中间件、token 校验
├── apps/           # 路由层:init_app.py 集中挂载全部 router
├── biz/            # 领域层:db/ 模型、services/ 业务逻辑、data_paths.py 路径约定
├── algos/          # 点云算法(帧 URI 构造、相机排序等)
├── captcha/        # 图形/邮件/短信验证码
├── admin/          # 管理面路由
├── edition.py      # 版本门控(HAS_EE / HAS_SAAS)
└── config.py       # Conf(含 Mongo 集合映射)/ 依赖 yinghuo_conf.gConf
```

## API 前缀约定

| 前缀 | 面向 | 鉴权 | 说明 |
|---|---|---|---|
| `/api/v1/b/*` | 业务面 | JWT Bearer(登录后) | 网关**剥掉** `/api/v1/b` 再转给后端,后端路由挂在根路径(`/seq`、`/file`、`/projects`、`/anno-job`…) |
| `/api/v1/c/*` | 登录前 | 免 token(自带验证码校验) | captcha / emailcode / mobilecode |
| `/api/v1/p/*` | 平台面 | platform_access token + IP 白名单 | 仅 EE/SaaS 挂载,CE 无此面 |

登录/注册等无鉴权业务路由挂在 `/u/a/noau`(`auth.py`),同样由网关剥前缀。路由挂载总表:`apps/init_app.py`。

## 鉴权

- JWT 双 token:`access`(业务接口)+ `refresh`(`/u/a/noau/refresh`)。
- `app.py` 中间件按前缀分流:`/api/v1/c/*` 放行、`/api/v1/p/*` 交给平台路由自身的 dependency、其余校验 access token。
- 登录/注册接口强制图形验证码(`X-Captcha-Id` header,Redis 存储有效期)。

## 配置体系

- 所有运行时配置在**单一 YAML**,由环境变量 `YH_CONFIG_FILE` 指向(如 `services/web-api/config/yinghuo.yaml`);缺失则启动失败。
- yaml 顶层两大段:`global`(mongodb / postgres / redis 连接、mode)与 `admin`;加载后进 `gConf`(yinghuo_conf 包),业务常量在 `Config`(config.py,单例 `Conf`)。
- CI 用独立的 `config/yinghuo-ci.yaml`。
- `.env` 文件只放本地敏感项,通过 pydantic-settings/dotenv 读取。

## 存储分工与 Mission 契约

| 存储 | 内容 |
|---|---|
| PostgreSQL(Tortoise ORM) | 用户/租户/角色/部门等关系数据 |
| FerretDB(Motor) | 标注任务、标注数据、序列元数据(见下表) |
| Redis | 验证码、缓存、会话态 |
| 数据根目录(`YH_USER_DATA_ROOT`) | 原始数据包与导出产物;共享数据在 `shared-datas/` 前缀下,不在用户目录里(URI 构造统一走 `biz/data_paths.py:file_uri_prefix`) |

前端 `apps/web-app/src/constants.ts` 的 **`Mission` 枚举是前后端线上契约**,值直接映射到 Mongo 集合(`config.py` 的 `MG_COLLECTION`):

| Mission | Mongo 集合 |
|---|---|
| `objectBBox2d` | `label_object_bbox2d` |
| `objectRBBox2d` | `label_object_rbbox2d` |
| `semantic2d` | `label_semantic2d` |
| `videoEvents` | `label_video_event` |
| `objectBBox3d` | `label_object3d_bbox` |
| `pcSemantic3d` | `label_setamic3d_pc` |
| `pcPolyline3d` | `label_polyline3d_pc` |

**改 Mission key 必须前后端联动**,否则旧数据失联。其他核心集合:`anno_job`(任务)、`data_seq_meta` / `data_stream_meta`(序列/数据流元信息)、`user_anno_spec`(标注规范)。

## 版本门控(CE ⊂ EE ⊂ SaaS)

- `edition.py` 检测 `ee/`、`saas/` 目录是否挂载 + `YH_EDITION` 环境变量,启动期 fail-fast。
- EE 增量路由/中间件(SSO、审计、备份、`/metrics`)在 `init_app.py` 里以 `if HAS_EE:` 条件挂载;SaaS 再叠加租户/计费/配额。
- 前端 `vite.config.ts` 依据 edition 增减入口页(platform 等)。
- pytest 用 marker 区分:`not ee and not saas` / `not saas` / 全量。

## CI(`.github/workflows/build.yml`)

push/PR 到 `main`/`master` 触发:

1. **build & test 矩阵**(ce/ee/saas):前端 `pnpm install → type-check → build`,后端 `pip install -e .[test]` → app 装配校验 → 按 edition 选 pytest marker 子集;服务容器起 PostgreSQL 17 + Redis 7。
2. **CE tarball 检查**(push 时):从 `git archive` 剔除 ee/saas 目录后全量扫描,确认产物无 EE/SaaS 代码泄漏。

## 部署形态

- **生产**(`docker-production/`):nginx 容器(:6600)伺服前端静态文件并把 `/api/v1/b/*` 剥前缀反代到 backend 容器(:6610);PostgreSQL/FerretDB/Redis 各自容器,数据卷落宿主机。
- **开发**:`scripts/dev/start-ce.bash` 起 tmux 三窗口(db / api :8423 / web :8400),vite proxy 承担网关角色。
