# docker-production · CE 生产部署

yinghuo-openlabel CE (Community Edition) 的生产部署。独立 compose、独立端口、独立数据卷,默认监听 6600/6610。

EE / SaaS 的部署资产分别在私有仓:
- [yinghuo-openlabel-ee](https://github.com/geluzhiwei1/yinghuo-openlabel-ee) 仓库的 `docker-production/`
- [yinghuo-openlabel-saas](https://github.com/geluzhiwei1/yinghuo-openlabel-saas) 仓库的 `docker-production/`

## 目录结构

```
docker-production/
├── README.md                     # 本文档
├── docker-compose.ce.yaml        # CE compose
├── app-config/
│   └── ce/yinghuo.yaml           # CE 配置(最小化)
├── nginx-conf/
│   └── ce/app.conf               # 仅业务面
├── scripts/
│   └── ce/init-db.sh             # 建库 yinghuo-ce
└── env-templates/
    └── .env.ce.template
```

## 启动

```bash
cd docker-production
cp env-templates/.env.ce.template .env.ce
docker compose --env-file .env.ce -f docker-compose.ce.yaml up -d
```

访问 `http://localhost:6600/guis/yinghuo/home.html`
账号 `prod@geluzhiwei.com` / 密码 `yinghuo`

## 停止 / 重启

```bash
docker compose --env-file .env.ce -f docker-compose.ce.yaml down
docker compose --env-file .env.ce -f docker-compose.ce.yaml restart
```

## 数据卷

数据落宿主机的路径由 `.env.ce` 决定(默认 `~/tmp/yh_ce_*`)。删除对应目录即可重置。

## CE 镜像如何构建

镜像发布脚本统一走仓根 `scripts/release_docker_image.sh`,CE 通过 `--edition ce`(默认)自动追加 `-ce` 后缀:

```bash
export GITHUB_TOKEN=ghp_xxx   # 需 write:packages scope
scripts/release_docker_image.sh release --version 0.4.0
```

分步命令与全部选项见 `scripts/release_docker_image.sh --help`。CE 单独打 tarball 用 `scripts/build-ce.sh`。

## 已知坑

- **不要同端口跑多版**:CE/EE/SaaS 默认端口已错开,自行改 `.env` 时注意。
- **`.env` 不要入 git**:含宿主机路径与可能的 secret,已在仓库根 `.gitignore` 排除本目录的 `.env.*`。
