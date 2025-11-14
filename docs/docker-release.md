# docker images

## build
``` shell

YH_ROOT=$(pwd)

cd ${YH_ROOT}/apps/web-app && pnpm run build

cd ${YH_ROOT}
# ghcr.io/geluzhiwei1/yinghuo-frontend:latest
${YH_ROOT}/scripts/release_docker_image.sh build frontend --version 0.3.5-alpha --environment production

# ghcr.io/geluzhiwei1/yinghuo-backend:latest
${YH_ROOT}/scripts/release_docker_image.sh build backend --version 0.1.1-alpha --environment production

```

# 测试
``` shell
cd docker-production
docker compose --env-file .env_docker up

```

可以通过浏览器访问[app](http://localhost:6600/guis/yinghuo/home.html)，使用账号prod@geluzhiwei.com密码yinghuo登录。

## push
``` shell
# ghcr.io/geluzhiwei1/yinghuo-frontend:latest
./scripts/release_docker_image.sh push frontend --version 0.3.5-alpha --environment production

# ghcr.io/geluzhiwei1/yinghuo-backend:latest
./scripts/release_docker_image.sh push backend --version 0.1.1-alpha --environment production

```
