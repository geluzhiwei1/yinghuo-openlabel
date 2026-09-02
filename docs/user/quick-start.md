# 快速启动

## 系统环境

```bash
# 确认docker已经安装
docker --version

# 确认能否拉取镜像(CE 版;EE/SaaS 把 -ce 换成 -ee / -saas)
docker pull ghcr.io/geluzhiwei1/yinghuo-frontend-ce:latest-ce
docker pull ghcr.io/geluzhiwei1/yinghuo-backend-ce:latest-ce
```

## clone 代码

```bash
# git clone https://gitee.com/geluzhiwei/yinghuo
git clone https://github.com/geluzhiwei1/yinghuo-openlabel
```

## 修改配置文件

按版本选一份 env 模板,按需修改路径与端口:

```bash
cd docker-production
cp env-templates/.env.ce.template .env.ce   # CE
# cp env-templates/.env.ee.template .env.ee   # EE
# cp env-templates/.env.saas.template .env.saas # SaaS
```

**必改项**:`YH_JWT_SECRET`(模板里是占位符,生成方式 `openssl rand -hex 32`)。
其余路径/端口有默认值,单机体验可不改。详细三版差异与端口对照见 `docker-production/README.md`。

## 使用docker启动服务

```bash
cd docker-production

# CE(端口 6600/6610)
docker compose --env-file .env.ce -f docker-compose.ce.yaml up -d

# EE(端口 6700/6710 + Prometheus 9090)
docker compose --env-file .env.ee -f docker-compose.ee.yaml up -d

# SaaS(端口 6800/6810 + Prometheus 9091)
docker compose --env-file .env.saas -f docker-compose.saas.yaml up -d
```

## 访问

浏览器打开 `http://localhost:6600/guis/yinghuo/home.html`(EE/SaaS 换 6700/6800)

- 账号:`prod@geluzhiwei.com`
- 密码:`yinghuo`

首次启动会自动建库并写入管理员账号,数据卷落在 `.env` 里配置的宿主机目录(默认 `~/tmp/yh_ce_*`)。停止/重置见 `docker-production/README.md`。
