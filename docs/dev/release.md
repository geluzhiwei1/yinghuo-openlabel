# Docker 镜像发布

统一走 `scripts/release_docker_image.sh`。产物推到 `ghcr.io/geluzhiwei1/`,镜像名自动追加 `-ce/-ee/-saas` 后缀,tag 自动生成 4 个:`{version}-{edition}` / `{version}-{edition}-{environment}` / `latest-{edition}` / `latest-{edition}-{environment}`,无需手动打 tag。

## 前置

- `GITHUB_TOKEN` 在环境变量里,需 `write:packages` scope(40 字符 `ghp_` 开头)。
- 前端镜像只 COPY 预构建的 `apps/web-app/dist/`,构建前端镜像前必须先 `pnpm run build`。
- EE / SaaS 需先在各自私有仓库(yinghuo-openlabel-ee / yinghuo-openlabel-saas)运行
  `CE_ROOT=<本仓路径> scripts/setup-edition.sh {ee|saas}` 挂上私有代码(CE 不需要)。

## 完整发布(推荐)

frontend + backend 全部构建 + 推送 + 全部 tag:

```bash
export GITHUB_TOKEN=ghp_xxx

# 前端先出 dist
cd apps/web-app && pnpm install && pnpm run build && cd ../..

# 发布(--edition 默认 ce)
scripts/release_docker_image.sh release --version 0.4.0
# scripts/release_docker_image.sh release --version 0.4.0 --edition ee
# scripts/release_docker_image.sh release --version 0.4.0 --edition saas
```

## 分步命令

```bash
scripts/release_docker_image.sh build_all --version 0.4.0        # 只构建
scripts/release_docker_image.sh push_all --version 0.4.0         # 只推送
scripts/release_docker_image.sh build_and_push frontend --version 0.4.0   # 单服务
scripts/release_docker_image.sh list_services                    # 列出支持的服务
scripts/release_docker_image.sh show_config                      # 查看当前配置
```

全部选项见 `scripts/release_docker_image.sh --help`。

## 测试验证

```bash
cd docker-production
cp env-templates/.env.ce.template .env.ce
docker compose --env-file .env.ce -f docker-compose.ce.yaml up
```

CE 启动后浏览器访问 [app](http://localhost:6600/guis/yinghuo/home.html),账号 `prod@geluzhiwei.com` 密码 `yinghuo`。

## 已知坑

- ghcr 偶发推送卡死:所有层显示 "Layer already exists" 后 manifest PUT 无限挂起(仓库级故障,换 tag 也挂)。解法:把镜像 tag 到一个全新仓库名(如 `xxx-probe`)再推,层会 cross-mount 秒级完成,manifest 通常立即成功;之后再推 canonical 仓库往往已恢复。
- 推送结果别信管道尾行,用 `docker buildx imagetools inspect ghcr.io/...` 确认远端 digest。
