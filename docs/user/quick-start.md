# 快速启动

## 系统环境

```bash

# 确认docker已经安装
docker --version

# 确认能否拉取镜像
docker pull ghcr.io/geluzhiwei1/yinghuo-frontend:latest
docker pull ghcr.io/geluzhiwei1/yinghuo-backend:latest

```

## clone 代码

```bash

# git clone https://gitee.com/geluzhiwei/yinghuo
git clone https://github.com/geluzhiwei1/yinghuo-openlabel

```

## 修改配置文件

修改如下配置文件中的路径和端口配置，使其符合你的需求：

docker-production/.env_docker


## 使用docker启动服务

```bash
cd docker-production
docker compose --env-file .env_docker up -d
```

可以通过浏览器访问http://localhost:6600/guis/yinghuo/home.html

账号prod@geluzhiwei.com
密码yinghuo
