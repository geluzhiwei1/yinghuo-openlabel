[English](README.md) | [中文](README_ZH.md)

[![build](https://github.com/geluzhiwei1/yinghuo-openlabel/actions/workflows/build.yml/badge.svg)](https://github.com/geluzhiwei1/yinghuo-openlabel/actions/workflows/build.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![ghcr 0.4.0-ce](https://img.shields.io/badge/ghcr.io-0.4.0--ce-2496ED?logo=docker&logoColor=white)](https://github.com/geluzhiwei1?tab=packages)

[github](https://github.com/geluzhiwei1/yinghuo-openlabel) | [gitee](https://gitee.com/gerwee/yinghuo) | [官网](https://www.geluzhiwei.com/) | [在线体验](https://www.geluzhiwei.com/guis/yinghuo/home.html)

# Yinghuo-OpenLabel: 专业级开源数据标注平台

`Yinghuo-OpenLabel` 是一个专业的、开源的数据标注平台，专为自动驾驶、机器人和计算机视觉领域设计。它提供了一套完整的工具链，用于处理和标注复杂的传感器数据（如 2D 图像、视频和 3D 点云），并深度集成了 AI 辅助标注功能以显著提升标注效率。

本项目参考 **OpenLABEL** 国际标准，确保了数据的互操作性、规范性和可扩展性。

## 🌐 在线体验

无需安装,直接体验 CE 最新版(数据会不定期重置):

**https://www.geluzhiwei.com/guis/yinghuo/home.html**

体验账号(密码均为 `yinghuo`):

| 账号 | 角色 |
|---|---|
| `prod@geluzhiwei.com` | 租户管理员(主账号) |
| `test-tenant-admin@geluzhiwei.com` | 租户管理员 |
| `test-annotator@geluzhiwei.com` | 标注员 |
| `test-reviewer@geluzhiwei.com` | 审核员 |

![3d-box](docs/assets/3d/3d-box.gif)
![3d-line](docs/assets/3d/3d-line2.gif)
![2d-demo](docs/assets/640.gif)
![2d-demo](docs/assets/641.gif)

## ✨ 核心功能

*   **多模态数据标注**:支持对图像、视频和 3D 点云数据进行精细化标注,涵盖 2D 边界框、旋转框、多边形/掩码分割、3D 边界框、3D 折线等类型。
*   **点云-图像联动标注**:3D 标注实时投影到环视相机图像,跨模态交叉核对。
*   **AI 辅助与自动化**:集成 ONNX Runtime Web,支持在浏览器内半自动/全自动推理预标注。
*   **数据与项目管理**:数据包导入导出、标注任务、标签批次和数据集的系统化管理。
*   **标准化与规范**:深度参考 `OpenLABEL` 规范,定义清晰的数据格式和分类体系(Taxonomy)。

📄 与 Label Studio / CVAT / Supervisely 的功能对比见 [docs/comparison.md](docs/comparison.md)(英文)。

## 🧭 功能路线图

图例:`[√]` 已实现 · `[-]` 进行中 · `[ ]` 规划中

### 📚 标注工具

- 视觉 2D 标注
    * [√] 2D 边界框
    * [√] 2D 旋转边界框
    * [√] 语义分割 - 多边形
    * [√] 语义分割 - 掩码
    * [√] 视频 - 事件标注
    * [-] 模型辅助 - ONNX Runtime Web
        * [-] 模型加载
        * [-] 模型推理
    * [ ] 模型辅助 - 后台服务
- 点云 3D 标注
    * [√] 3D 边界框
    * [√] 3D 折线
    * [√] 点云-图像:3D 标注投影到 2D 图像
    * [-] 3D 旋转边界框
    * [ ] 语义分割 - 多边形
    * [ ] 语义分割 - 掩码
- 多模态标注
    * [ ] 图像-文本
    * [ ] 视频-文本
- 4D 标注(规划中)

### 🔧 管理功能

- 数据管理
    * [√] 数据包导入导出
    * [ ] 标注数据审核与校验
- 用户管理
    * [√] 用户登录
    * [ ] 用户和团队管理
    * [ ] 权限控制
- 项目管理
    * [√] 标注任务管理

## 📦 版本

| 版本 | 用途 | License | 源码公开 |
|---|---|---|---|
| **CE**(社区版,本仓库) | 个人/小团队自部署 | AGPL-3.0 | 是 |
| **EE**(企业版) | 企业自部署,补 SSO/审计/监控/备份 | 商业 | 否 |
| **SaaS** | 多租户云服务,补计费/配额/租户管理 | 商业 | 否 |

EE/SaaS 不开放源码,商业授权请联系[维护者](https://www.geluzhiwei.com/)。本仓库(CE)严格遵守 AGPL-3.0。

## 📚 文档导航

| 文档 | 说明 |
|---|---|
| [用户快速上手](docs/user/quick-start.md) / [Quick Start (EN)](docs/user/quick-start.en.md) | Docker Compose 一键部署生产环境 |
| [开发环境搭建](docs/dev/start-ce.md) | 前后端本地开发环境 |
| [架构说明](docs/dev/architecture.md) | 服务拓扑、API 前缀、配置体系、数据模型 |
| [镜像发布](docs/dev/release.md) | 构建/发布 Docker 镜像到 ghcr.io |
| [生产部署详解](docker-production/README.md) | 三版部署编排、端口、数据卷 |
| [更新日志](CHANGELOG.md) | 版本变更记录 |

## 🚀 快速开始

### 生产环境(Docker Compose)

```bash
git clone https://github.com/geluzhiwei1/yinghuo-openlabel.git
cd yinghuo-openlabel/docker-production
cp env-templates/.env.ce.template .env.ce
docker compose --env-file .env.ce -f docker-compose.ce.yaml up -d
```

访问 `http://localhost:6600/guis/yinghuo/home.html`,默认账号 `prod@geluzhiwei.com` / 密码 `yinghuo`。

详见[用户快速上手](docs/user/quick-start.md)。

### 开发环境

见[开发环境搭建](docs/dev/start-ce.md)。

启动视频演示:[Bilibili](https://www.bilibili.com/video/BV1thJdzMEN6/?spm_id_from=333.1365.list.card_archive.click&vd_source=4262e24d5d41e600eb592442d23fc63e)

## 🛠️ 技术栈

前后端分离架构。

### 前端(`apps/web-app`)

*   **核心框架**: Vue 3 + TypeScript
*   **构建工具**: Vite(多页应用)
*   **UI 组件库**: Element Plus
*   **状态管理**: Pinia
*   **3D 渲染**: Three.js + Rust WASM(点云解析)
*   **数据加载**: @loaders.gl

### 后端(`services/web-api`)

*   **核心框架**: FastAPI(Python 3.12+)
*   **数据库**: PostgreSQL + FerretDB( MongoDB 兼容)+ Redis
*   **ORM**: Tortoise ORM(PostgreSQL)、Motor(FerretDB)
*   **数据处理**: NumPy、Pandas、OpenCV、Open3D

## 📂 项目结构

```
.
├── apps
│   └── web-app/          # 前端 Vue 3 应用
├── services
│   └── web-api/          # 后端 FastAPI 应用
├── docker/               # 开发环境 Docker 配置
├── docker-production/    # 生产环境 Docker Compose 编排
├── scripts/              # 构建/发布/开发辅助脚本
└── docs/                 # 项目文档
```

## 🤝 贡献指南

我们欢迎任何形式的贡献!请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。

# 微信公众号 格律至微

关注公众号,获取更多技术文章和项目更新。

![关注公众号](docs/assets/weixingongzhonghao.png)

## License

This project is licensed under the AGPL-3.0 License. See the [LICENSE](LICENSE) file for details.
