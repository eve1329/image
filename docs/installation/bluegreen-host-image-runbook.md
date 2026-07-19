# `/image` 同机蓝绿部署 Runbook

本文档用于把当前仓库构建出的静态 SPA 容器部署到现有 API 主站所在服务器，并通过主站的 `/image/` 子路径对外提供服务。本文以 `newapi-16` + `https://artworkers.online/image/` 为默认示例，但所有关键参数都可以覆盖，不再假定只能部署到单一域名。

## 目标形态

- 复用现有 API 主站与它的宿主机 Nginx。
- 不复用后端应用健康检查，也不改它持有的根路径 `/` 与 `/v1`。
- 本项目以静态站点容器运行，通过主机回环端口挂到现有站点子路径：
  - `image-blue` -> `127.0.0.1:3200`
  - `image-green-amd64` -> `127.0.0.1:3201`
- 默认示例公网入口为 `https://artworkers.online/image/`。
- 默认示例前端 API URL 为 `https://artworkers.online/v1`。
- Docker 内置 `/api-proxy/` 在这条部署路径上保持关闭：
  - `ENABLE_API_PROXY=false`
  - `LOCK_API_PROXY=false`

## 参数入口

脚本支持两类参数入口：

- 命令行参数：
  - `--remote`
  - `--remote-env-file`
  - `--nginx-site`
  - `--nginx-snippet`
  - `--public-url`
- 环境变量：
  - `BLUEGREEN_REMOTE_ALIAS`
  - `BLUEGREEN_REMOTE_ENV_FILE`
  - `BLUEGREEN_NGINX_SITE`
  - `BLUEGREEN_NGINX_SNIPPET`
  - `BLUEGREEN_PUBLIC_URL`
  - `BLUEGREEN_DEFAULT_API_URL`

当前脚本默认值：

```text
remote alias   = newapi-16
remote env     = /root/image/deploy/bluegreen-host.env
nginx site     = /etc/nginx/sites-enabled/artworkers.online
nginx snippet  = /etc/nginx/snippets/gpt-image-playground-image.conf
public url     = https://artworkers.online/image/
default api    = https://artworkers.online/v1
```

如果目标不是这个默认示例，优先显式传参，不要去改脚本源码。

## 先决条件

- 本地具备 `docker`、`docker buildx`、`ssh`、`scp`、`npm`。
- 远端 SSH alias 可用，本文示例是 `newapi-16`。
- 远端已安装 `docker`、`nginx`、`systemctl`、`curl`、`python3`。
- 现有主站仍由后端持有根路径 `/` 和 `/v1`。
- 如果要把默认 API URL 设为 `https://.../v1`，先确认目标站点已经具备可用的 HTTPS。

## 首次远端准备

创建部署目录并上传 env 样例：

```bash
ssh newapi-16 'install -d -m 700 /root/image/deploy'
scp deploy/bluegreen-host.env.example newapi-16:/root/image/deploy/bluegreen-host.env
ssh newapi-16 'chmod 600 /root/image/deploy/bluegreen-host.env'
```

远端 env 文件至少保留这些字段：

```env
APP_BLUE_IMAGE=image:bootstrap-blue
APP_GREEN_IMAGE=image:bootstrap-green
BLUE_CONTAINER=image-blue
GREEN_CONTAINER=image-green-amd64
BLUE_PORT=3200
GREEN_PORT=3201
DEFAULT_API_URL=https://artworkers.online/v1
ENABLE_API_PROXY=false
LOCK_API_PROXY=false
HOST=0.0.0.0
PORT=80
```

说明：

- 首次部署前 `APP_BLUE_IMAGE` / `APP_GREEN_IMAGE` 可先保留占位值。
- 实际发布时，脚本会把“待更新颜色”的镜像 tag 写回对应字段。
- 如果当前站点尚未配好 HTTPS，可以先临时设成 `http://your-domain/v1`，等 HTTPS 通过后再重滚同一镜像。

## Nginx 一次性接入

主站配置只接入一次，后续蓝绿切流只改 snippet。

1. 上传 snippet 模板供对照：

```bash
scp deploy/nginx.image-snippet.conf.example newapi-16:/etc/nginx/snippets/gpt-image-playground-image.conf
```

2. 在目标站点配置的根 `location /` 之前加入：

```nginx
include /etc/nginx/snippets/gpt-image-playground-image.conf;
```

以 `artworkers.online` 为例，推荐使用下面的幂等化命令插入：

```bash
ssh newapi-16 "python3 - <<'PY'
from pathlib import Path
import re

site = Path('/etc/nginx/sites-enabled/artworkers.online')
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

如果目标机器不是默认示例：

```bash
bash scripts/deploy/bluegreen-host.sh \
  --remote <ssh-alias> \
  --nginx-site </etc/nginx/sites-enabled/your-site> \
  --public-url <https://your-domain/image/>
```

或：

```bash
BLUEGREEN_REMOTE_ALIAS=<ssh-alias> \
BLUEGREEN_NGINX_SITE=</etc/nginx/sites-enabled/your-site> \
BLUEGREEN_PUBLIC_URL=<https://your-domain/image/> \
BLUEGREEN_DEFAULT_API_URL=<https://your-domain/v1> \
bash scripts/deploy/bluegreen-host.sh
```

脚本行为：

- 默认基于本地干净 `HEAD` 构建 `linux/amd64` 镜像。
- 使用 `docker save | ssh <remote> docker load` 传到远端。
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
curl -I https://artworkers.online/image/
curl -fsS https://artworkers.online/image/ | grep -i "GPT Image Playground"
curl -i https://artworkers.online/v1/models
```

浏览器验证项：

- 打开 `https://artworkers.online/image/`。
- 确认静态资源来自 `/image/assets/...`。
- 确认默认 API URL 为 `https://artworkers.online/v1`。
- 确认网络请求走 `/v1/...`，而不是 `/image/api-proxy/...`。
- 用可用测试 key 至少验证一次 `GET /v1/models` 或最小生图请求。

## 回滚流程

回滚只需要把 snippet 切回旧端口：

```bash
ssh newapi-16 "sed -i.bak 's#proxy_pass http://127.0.0.1:3201/#proxy_pass http://127.0.0.1:3200/#' /etc/nginx/snippets/gpt-image-playground-image.conf && nginx -t && systemctl reload nginx"
```

或反向：

```bash
ssh newapi-16 "sed -i.bak 's#proxy_pass http://127.0.0.1:3200/#proxy_pass http://127.0.0.1:3201/#' /etc/nginx/snippets/gpt-image-playground-image.conf && nginx -t && systemctl reload nginx"
```

回滚后重新验证：

```bash
curl -I https://artworkers.online/image/
curl -fsS https://artworkers.online/image/ | grep -i "GPT Image Playground"
```

## 只换镜像 tag，不改站点结构

当 nginx include 和 snippet 已接好后，后续升级只需要：

- 构建新镜像 tag，或指定已有 tag。
- 运行 `bash scripts/deploy/bluegreen-host.sh [--image-tag ...]`。

不需要再改：

- 目标站点配置主体结构
- `/v1` 代理
- 根路径 `/`
- 前端源码中的 base path 或 API 路由逻辑
