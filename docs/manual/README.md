# 无限画布操作文档维护说明

教程源文件为 `infinite-canvas-guide.md`，页面图片位于 `public/manual/images/`。

修改教程后，在仓库根目录运行：

```bash
npm run build:manual
```

生成结果为 `public/manual/index.html`，执行 `npm run build` 时会自动重新生成，并复制到 `dist/manual/`。

- 本地地址：`http://localhost:5173/manual/index.html`
- 生产地址：`https://gptch.cloud/image/manual/index.html`

如果生产域名或路径发生变化，需要同步修改画布镜像构建时的 `NEXT_PUBLIC_DOC_URL`。
