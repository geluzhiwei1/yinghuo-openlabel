# dev setup

## 启动开发环境

### 1. 启动数据库服务

我们使用 Docker Compose 来管理后端服务，包括 PostgreSQL、FerretDB 和 Redis。

```bash
docker compose -f docker/docker-compose-dev.yaml up -d
# create database yinghuo-dev
docker exec -it yh-dev-postgres psql -U dev -d postgres -c "CREATE DATABASE \"yinghuo-dev\";"
# 列出表
docker exec -it yh-dev-postgres psql -U dev -d yinghuo-dev -c "\dt"

```

### 2. 启动 Web API 服务

后端服务是一个 Python 项目，位于 `services/web-api` 目录下。

```bash
conda create -n yinghuo-dev python=3.12
conda activate yinghuo-dev

cd services/web-api
pip install -e .
python -m uvicorn yinghuo_app.app:app --port 8423 --reload

```

### 3. 启动前端

前端项目位于 `apps/web-app` 目录下。

首先，安装依赖：

```bash
cd  apps/web-app
pnpm install

pnpm run dev
```

现在，你可以通过浏览器访问[app](http://localhost:8400/guis/v0.3.4/home.html)，使用账号prod@geluzhiwei.com密码yinghuo登录。