# gptch.cloud/image 同机蓝绿部署 Runbook

本文档用于把当前仓库构建出的静态 SPA 容器部署到 `new-api` 现有服务器，并通过 `https://gptch.cloud/image/` 对外提供服务。

## 目标形态

- 复用 `new-api` 那台服务器与它的蓝绿发布习惯。
- 不复用 `new-api` 的应用健康检查接口，也不改它的根路径和 `/v1` 路由。
- 本项目以静态站点容器运行，通过主机回环端口挂到现有站点子路径：
  - `image-blue` -> `127.0.0.1:3200`
  - `image-green-amd64` -> `127.0.0.1:3201`
- 公网入口固定为 `https://gptch.cloud/image/`。
- 前端默认 API URL 固定为 `https://gptch.cloud/v1`。
- Docker 内置 `/api-proxy/` 在这条部署路径上保持关闭：
  - `ENABLE_API_PROXY=false`
  - `LOCK_API_PROXY=false`

## 先决条件

- 本地具备 `docker`、`docker buildx`、`ssh`、`scp`、`npm`。
- 远端 `root` SSH alias 可用。
- 远端已安装 `docker`、`nginx`、`systemctl`、`curl`、`python3`。
- 现有 `gptch.cloud` 主站仍由 `new-api` 持有根路径 `/` 和 `/v1`。

## 首次远端准备

创建部署目录并上传 env 样例：

```bash
ssh root 'install -d -m 700 /root/image/deploy'
scp deploy/bluegreen-host.env.example root:/root/image/deploy/bluegreen-host.env
ssh root 'chmod 600 /root/image/deploy/bluegreen-host.env'
```

远端 env 文件至少保留这些字段：

```env
APP_BLUE_IMAGE=image:bootstrap-blue
APP_GREEN_IMAGE=image:bootstrap-green
BLUE_CONTAINER=image-blue
GREEN_CONTAINER=image-green-amd64
BLUE_PORT=3200
GREEN_PORT=3201
DEFAULT_API_URL=https://gptch.cloud/v1
ENABLE_API_PROXY=false
LOCK_API_PROXY=false
HOST=0.0.0.0
PORT=80
```

说明：

- 首次部署前 `APP_BLUE_IMAGE` / `APP_GREEN_IMAGE` 可先保留占位值。
- 实际发布时，脚本会把“待更新颜色”的镜像 tag 写回对应字段。

## Nginx 一次性接入

主站配置只接入一次，后续蓝绿切流只改 snippet。

1. 上传 snippet 模板供对照：

```bash
scp deploy/nginx.image-snippet.conf.example root:/etc/nginx/snippets/gpt-image-playground-image.conf
```

2. 在 `/etc/nginx/sites-enabled/gptch.cloud` 的根 `location /` 之前加入：

```nginx
include /etc/nginx/snippets/gpt-image-playground-image.conf;
```

推荐使用下面的幂等化命令插入：

```bash
ssh root "python3 - <<'PY'
from pathlib import Path
import re

site = Path('/etc/nginx/sites-enabled/gptch.cloud')
snippet = '    include /etc/nginx/snippets/gpt-image-playground-image.conf;'
text = site.read_text()
if snippet not in text:
    match = re.search(r'^(\\s*location\\s+/\\s*\\{)', text, re.MULTILINE)
    if not match:
        raise SystemExit('root location not found')
    text = text[:match.start(1)] + snippet + '\\n' + text[match.start(1):]
    site.write_text(text)
PY
nginx -t && systemctl reload nginx"
```

接入后的 snippet 结构固定为：

```nginx
location = /image {
    return 301 /image/;
}

location ^~ /image/ {
    proxy_pass http://127.0.0.1:3200/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect off;
}
```

关键点：

- `proxy_pass` 必须带尾部 `/`。
- `/image/...` 会被转发为容器内的 `/...`。
- 这样 `assets`、`manifest.webmanifest`、`sw.js` 和 SPA fallback 都能保持正确。

## 发布命令

默认从干净 `HEAD` 构建并发布：

```bash
bash scripts/deploy/bluegreen-host.sh
```

常用变体：

```bash
bash scripts/deploy/bluegreen-host.sh --image-tag image:codex-20260612183000
```

```bash
bash scripts/deploy/bluegreen-host.sh --skip-build --image-tag image:codex-20260612183000
```

```bash
bash scripts/deploy/bluegreen-host.sh --build-source worktree --allow-dirty-worktree
```

脚本行为：

- 默认基于本地干净 `HEAD` 构建 `linux/amd64` 镜像。
- 使用 `docker save | ssh root docker load` 传到远端。
- 先替换 standby 颜色容器，再验证 loopback：
  - `/`
  - `/manifest.webmanifest`
  - `/sw.js`
- 只切 `/etc/nginx/snippets/gpt-image-playground-image.conf` 的 `proxy_pass` 端口。
- 保留旧容器为 `*-pre-deploy-*`，作为即时回滚快照。

## 本地预检

部署前建议执行：

```bash
npm ci
npm run test
npm run build
docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t image:plancheck --load .
```

## 远端 standby 验证

standby 更新后，脚本等价于会验证：

```bash
curl -fsS http://127.0.0.1:3200/
curl -fsS http://127.0.0.1:3200/manifest.webmanifest
curl -fsS http://127.0.0.1:3200/sw.js
```

或绿色端口：

```bash
curl -fsS http://127.0.0.1:3201/
curl -fsS http://127.0.0.1:3201/manifest.webmanifest
curl -fsS http://127.0.0.1:3201/sw.js
```

## 公网验证

```bash
curl -I https://gptch.cloud/image/
curl -fsS https://gptch.cloud/image/ | grep -i "GPT Image Playground"
```

浏览器验证项：

- 打开 `https://gptch.cloud/image/`。
- 确认静态资源来自 `/image/assets/...`。
- 确认默认 API URL 为 `https://gptch.cloud/v1`。
- 确认网络请求走 `/v1/...`，而不是 `/image/api-proxy/...`。
- 用可用测试 key 至少验证一次 `GET /v1/models` 或最小生图请求。

## 回滚流程

回滚只需要把 snippet 切回旧端口：

```bash
ssh root "sed -i.bak 's#proxy_pass http://127.0.0.1:3201/#proxy_pass http://127.0.0.1:3200/#' /etc/nginx/snippets/gpt-image-playground-image.conf && nginx -t && systemctl reload nginx"
```

或反向：

```bash
ssh root "sed -i.bak 's#proxy_pass http://127.0.0.1:3200/#proxy_pass http://127.0.0.1:3201/#' /etc/nginx/snippets/gpt-image-playground-image.conf && nginx -t && systemctl reload nginx"
```

回滚后重新验证：

```bash
curl -I https://gptch.cloud/image/
curl -fsS https://gptch.cloud/image/ | grep -i "GPT Image Playground"
```

## 只换镜像 tag，不改站点结构

当 nginx include 和 snippet 已接好后，后续升级只需要：

- 构建新镜像 tag，或指定已有 tag。
- 运行 `bash scripts/deploy/bluegreen-host.sh [--image-tag ...]`。

不需要再改：

- `/etc/nginx/sites-enabled/gptch.cloud` 主体结构
- `/v1` 代理
- 根路径 `/`
- 前端源码中的 base path 或 API 路由逻辑
