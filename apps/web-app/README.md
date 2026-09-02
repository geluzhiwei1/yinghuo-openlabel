# web-app · 前端

Vue 3 + TypeScript + Vite 多页应用(MPA),base 路径 `/guis/yinghuo`。

## 页面入口

| 页面 | 用途 |
|---|---|
| `dev.html` | 开发信息面板(dev server 默认入口:端口/账号/路由/连接串) |
| `auth.html` | 登录/注册 |
| `home.html` | 主控台(任务、数据、系统管理) |
| `anno.html` | 2D 图像/视频标注 |
| `pc.html` | 3D 点云标注(含点云-图像联动) |
| `dashboard.html` | 质量看板 |
| `review.html` / `qa.html` | 审核 / QA 工作台 |
| `nrrd.html` / `gaussian.html` | 医学体数据 / 高斯泼溅视图 |

## 常用命令

```bash
pnpm install
pnpm dev          # 开发 server,端口 8400
pnpm build        # 产物到 dist/(Dockerfile 直接 COPY)
pnpm test:unit    # vitest
pnpm type-check   # vue-tsc
pnpm lint
```

## 开发要点

- **API 代理**:dev 模式下 vite 把 `/api/v1/b/*` 代理到后端(默认 `http://127.0.0.1:8423`,可用 env `API_URL_APP` 覆盖);`/notifications/stream` 等 SSE 走旁路转发(见 `vite.config.ts`)。
- **点云 wasm**:ply/las/laz 解析走 Rust WASM(`ensureRustWasm` 前置),pcd 有 JS fallback。
- **状态管理**:Pinia;UI 为 Element Plus;3D 渲染 Three.js。

详见仓库根 `docs/dev/start-ce.md`(环境搭建)与 `docs/dev/architecture.md`(整体架构)。
