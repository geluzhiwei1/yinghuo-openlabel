
[README_EN](README_EN.md) | [README中文](README.md)

[github](https://github.com/geluzhiwei/yinghuo-openlabel) | [gitee](https://gitee.com/gerwee/yinghuo) | [官网](https://www.geluzhiwei.com/) 

# Yinghuo-OpenLabel: 专业级开源数据标注平台

`Yinghuo-OpenLabel` 是一个专业的、开源的数据标注平台，专为自动驾驶、机器人和计算机视觉领域设计。它提供了一套完整的工具链，用于处理和标注复杂的传感器数据（如 2D 图像、视频和 3D 点云），并深度集成了 AI 辅助标注功能以显著提升标注效率。

本项目参考 **OpenLABEL** 国际标准，确保了数据的互操作性、规范性和可扩展性。

## ✨ 核心功能

*   **多模态数据标注**:
    *   提供强大的标注工具集，支持对图像、视频和 3D 点云数据进行精细化标注。
    *   支持多种标注类型，如 2D 边界框、语义分割、3D 立方体、关键点等。
*   **AI 辅助与自动化**:
    *   集成深度学习模型 (DNN) 模块，支持使用 ONNX 等格式的模型进行半自动或全自动标注。
*   **数据与项目管理**:
    *   提供灵活的数据包导入与导出功能。
    *   支持标注任务、标签批次和数据集的系统化管理。
*   **标准化与规范**:
    *   深度集成并遵循 `OpenLABEL` 规范，定义了清晰的数据格式和分类体系（Taxonomy）。
*   **系统管理**:
    *   包含完整的用户、角色和团队管理功能，支持多租户和精细化的权限控制。

##  核心特性和发展路线图
已经完成的功能，正在开发的功能，以及未来的功能规划。
### 📚 标注工具
- 视觉2D标注
    * [√] 2D边界框
    * [√] 2D旋转边界框
    * [√] 语义分割-多边形
    * [√] 语义分割-掩码
    * [√] 视频-事件标注
    * [-] 模型辅助-onnxruntime web
        * [-] 模型加载
        * [-] 模型推理
    * [] 模型辅助-后台服务
- 点云3D标注
    * [ ] 3D边界框
    * [ ] 3D旋转边界框
    * [ ] 语义分割-多边形
    * [ ] 语义分割-掩码
- 多模态标注
    * [ ] 点云-图像：点云3D标注投影到2D图像
    * [ ] 图像-文本
    * [ ] 视频-文本
- 4D标注

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

## 🚀 技术栈

项目采用前后端分离的现代架构，确保了开发效率和系统的可扩展性。

#### 前端 (`apps/web-app`)

*   **核心框架**: Vue 3
*   **语言**: TypeScript
*   **构建工具**: Vite
*   **UI 组件库**: Element Plus

#### 后端 (`services/web-api`)

*   **核心框架**: FastAPI
*   **语言**: Python 3.10+
*   **数据库**: PostgreSQL, FerretDB (提供 MongoDB 兼容接口), Redis
*   **ORM**: Tortoise ORM (PostgreSQL), Motor (FerretDB)
*   **数据处理**: NumPy, Pandas, Open3D, OpenCV

## 🛠️ 快速启动 (开发环境)

请按照以下步骤在本地启动开发环境: [开发环境](docs/dev/start.md)

启动视频演示：[开发环境启动视频](https://www.bilibili.com/video/BV1thJdzMEN6/?spm_id_from=333.1365.list.card_archive.click&vd_source=4262e24d5d41e600eb592442d23fc63e)

## 🛠️ 快速启动 (生成环境)
TODO: 一键启动脚本，包括数据库、后端服务、前端应用

## 📂 项目结构简介

```
.
├── apps
│   └── web-app/          # 前端 Vue 3 应用
├── docker/               # Docker 配置文件
├── docs/                 # 项目文档
├── services
│   └── web-api/          # 后端 FastAPI 应用
└── scripts/              # 辅助脚本
```

## 🤝 贡献指南

我们欢迎任何形式的贡献！请参考 `CONTRIBUTING.md` (待补充) 获取更多信息。

## License

This project is licensed under the AGPL-3.0 License. See the [LICENSE](LICENSE) file for details.
