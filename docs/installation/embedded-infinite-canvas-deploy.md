# 嵌入式画布部署说明

本文档说明如何把主项目中的“画布”入口部署到服务器，并让同事拉取仓库后能正常看到嵌入的 Infinite Canvas。

## 部署形态

当前项目不是把画布代码直接打进主站页面，而是：

- 主站：`gpt_image_playground`，Vite 静态前端。
- 画布：`vendor/infinite-canvas/web`，独立 Next.js 应用。
- 主站通过 iframe 加载画布地址。
- iframe 地址由 `VITE_INFINITE_CANVAS_URL` 决定，默认是 `http://localhost:3002/canvas`，只适合本地开发。

生产部署时必须同时提供：

1. 主站访问地址，例如 `https://image.example.com/`。
2. 画布访问地址，例如 `https://canvas.example.com/canvas` 或 `https://image.example.com/canvas`。
3. 中转站接口域名，例如 `https://relay.example.com`。

## 接口地址配置

画布里的“设置 / API 配置 / 接口地址”部署时不要使用 `http://localhost:3000`。

这里要填写服务器环境可访问的中转站域名，例如：

```text
https://relay.example.com
```

当前画布配置里的提交接口已经带有 `/v1/images/generations/async`，任务查询也带有 `/v1/images/tasks/{task_id}`，所以接口地址通常填写中转站域名本身，不要重复拼成 `https://relay.example.com/v1/v1/...`。

如果中转站实际部署在子路径下，例如 `https://relay.example.com/api`，则填写这个完整前缀，并确认最终请求能落到：

```text
https://relay.example.com/api/v1/images/generations/async
https://relay.example.com/api/v1/images/tasks/{task_id}
```

主站自己的默认 OpenAI 兼容接口仍按主站配置处理；嵌入画布内的接口地址需要在画布设置中配置为中转站域名。

## 必须拉取子模块

画布项目是 Git 子模块，不会在普通 zip 下载里完整包含。

首次拉取仓库时使用：

```bash
git clone --recurse-submodules <主仓库地址>
```

如果已经 clone 了主仓库，再执行：

```bash
git submodule update --init --recursive
```

确认子模块存在：

```bash
git submodule status
ls vendor/infinite-canvas/web
```

如果子模块指针对应的提交没有推到子模块远端，同事执行 `git submodule update --init --recursive` 会失败。需要先把 `vendor/infinite-canvas` 里的提交 push 到它自己的远端仓库。

## 本地开发启动

安装主站依赖：

```bash
npm ci
```

安装画布依赖：

```bash
cd vendor/infinite-canvas/web
bun install --frozen-lockfile
```

回到主仓库，启动主站和画布：

```bash
npm run dev:all
```

本地默认地址：

- 主站：`http://localhost:5173`
- 画布：`http://localhost:3002/canvas`

## 服务器部署步骤

### 1. 拉取代码和子模块

```bash
git clone --recurse-submodules <主仓库地址>
cd gpt_image_playground
```

如果服务器上已有仓库：

```bash
git pull
git submodule update --init --recursive
```

### 2. 部署画布服务

画布服务在 `vendor/infinite-canvas` 下。

使用 Docker 部署：

```bash
cd vendor/infinite-canvas
docker build \
  --build-arg NEXT_PUBLIC_DOC_URL=https://artworkers.online/image/manual/index.html \
  -t infinite-canvas:latest \
  .
docker run -d \
  --name infinite-canvas \
  --restart unless-stopped \
  -p 3002:3000 \
  infinite-canvas:latest
```

此时服务器本机可通过下面地址访问画布：

```text
http://127.0.0.1:3002/canvas
```

`NEXT_PUBLIC_DOC_URL` 会在 Next.js 构建阶段写入书本按钮。它不能在容器启动后再通过 `docker run -e` 修改。主站教程随 Vite 静态产物部署，当前正式地址为：

```text
https://artworkers.online/image/manual/index.html
```

生产环境建议用 Nginx 或网关反代成 HTTPS，例如：

```text
https://canvas.example.com/canvas
```

或反代到主站同域路径：

```text
https://image.example.com/canvas
```

### 3. 部署主站

直接构建静态站点时，主站 iframe 地址需要在构建阶段写入：

```bash
VITE_INFINITE_CANVAS_URL=https://canvas.example.com/canvas npm run build
```

然后把 `dist/` 部署到静态服务或容器中。

如果使用项目里的 `deploy/Dockerfile`，镜像会保留画布地址占位符，并在容器启动时读取 `INFINITE_CANVAS_URL`。例如：

```bash
docker run -e INFINITE_CANVAS_URL=https://artworkers.online/canvas/canvas ...
```

蓝绿部署脚本会从远端 `bluegreen-host.env` 读取该变量；未设置时默认使用 `https://artworkers.online/canvas/canvas`。

### 4. Nginx 反代示例

独立画布域名示例：

```nginx
server {
    server_name canvas.example.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

主站同域子路径示例：

```nginx
location ^~ /canvas {
    proxy_pass http://127.0.0.1:3002/canvas;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

如果主站是 HTTPS，画布地址也必须使用 HTTPS，避免浏览器拦截 iframe 混合内容。

## 部署后检查

1. 打开主站。
2. 点击顶部“画布”。
3. 确认 iframe 加载的是生产画布地址，不是 `localhost:3002`。
4. 进入画布设置，确认“接口地址”为中转站域名，不是 `localhost:3000`。
5. 用测试 Key 发起一次最小文生图任务，确认请求落到中转站域名。
6. 点击画布右上角书本图标，确认新标签页打开 `/image/manual/index.html`，且教程图片完整加载。

## 常见问题

### 同事看不到画布

优先检查：

- 是否使用 `--recurse-submodules` 拉取仓库。
- `vendor/infinite-canvas/web` 是否存在完整文件。
- 子模块指针对应提交是否已经 push 到子模块远端。
- 画布服务是否已部署并能公网访问。
- 主站构建时是否设置了正确的 `VITE_INFINITE_CANVAS_URL`。
- HTTPS 主站是否嵌入了 HTTP 画布地址。

### 画布能打开，但生成失败

优先检查：

- 画布设置里的“接口地址”是否为中转站域名。
- 中转站是否支持 `/v1/images/generations/async` 和 `/v1/images/tasks/{task_id}`。
- API Key 是否有效。
- 浏览器网络请求最终是否访问了中转站，而不是 `localhost`。
