# dev setup

本地开发环境搭建见 [start-ce.md](./start-ce.md)。

## 一键启动

```bash
./scripts/dev/start-ce.bash     # 数据库 + 后端 + 前端 三窗口 tmux(session: yh-ce-dev)
```

脚本支持 `-d`(后台)/ `stop` / `status` 子命令,Python 环境自动探测(优先 `.venv`,详见 start-ce.md §0)。

## 端口 / 账号 / 路由一览

启动前端后访问 [dev 信息面板](../../apps/web-app/dev.html)(或 `http://localhost:8400/guis/yinghuo/dev.html`),包含:

- 后端 API 端口、路由前缀、`/docs` 鉴权状态
- 前端面板入口与登录页
- PostgreSQL / Mongo / Redis 连接串
- 业务 `access` token 流程
- 默认测试账号表
