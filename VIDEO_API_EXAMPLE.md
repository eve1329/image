# 视频生成 API 配置示例

本项目现已支持视频生成功能。视频生成通过自定义提供商配置实现，支持异步轮询模式。

## 配置说明

在设置页面添加自定义服务商，配置视频 API 的端点和结果提取路径。

### 配置示例

以下是一个视频生成 API 的配置示例（基于您提供的 API 文档）：

```json
{
  "id": "video-ds-2.0",
  "name": "视频生成 DS 2.0",
  "template": "http-video",
  "submit": {
    "path": "/v1/videos",
    "method": "POST",
    "contentType": "json",
    "body": {
      "model": "video-ds-2.0-fast",
      "prompt": "{{prompt}}",
      "seconds": 15,
      "aspect_ratio": "9:16"
    },
    "taskIdPath": "task_id"
  },
  "poll": {
    "path": "/v1/videos/{{task_id}}",
    "method": "GET",
    "intervalSeconds": 5,
    "statusPath": "status",
    "successValues": ["completed", "succeeded", "done"],
    "failureValues": ["failed", "error"],
    "errorPath": "error",
    "result": {
      "videoUrlPaths": ["video_url", "url", "data.url"]
    }
  }
}
```

### 配置字段说明

#### Submit 提交配置

- `path`: API 端点路径（例如 `/v1/videos`）
- `method`: 请求方法，通常为 `POST`
- `contentType`: 请求内容类型，通常为 `json`
- `body`: 请求体，支持以下变量：
  - `{{prompt}}`: 用户输入的提示词
  - `{{model}}`: 模型名称
  - 其他自定义参数（如 `seconds`, `aspect_ratio` 等）
- `taskIdPath`: 从响应中提取任务 ID 的路径（例如 `task_id` 或 `data.id`）

#### Poll 轮询配置

- `path`: 轮询状态的端点路径，`{{task_id}}` 会被自动替换为实际任务 ID
- `method`: 请求方法，通常为 `GET`
- `intervalSeconds`: 轮询间隔（秒），建议 5-10 秒
- `statusPath`: 从响应中提取状态的路径（例如 `status` 或 `data.status`）
- `successValues`: 表示成功的状态值列表（例如 `["completed", "succeeded"]`）
- `failureValues`: 表示失败的状态值列表（例如 `["failed", "error"]`）
- `errorPath`: 从响应中提取错误信息的路径（可选）
- `result.videoUrlPaths`: 从响应中提取视频 URL 的路径列表（按优先级尝试）

### API 响应格式示例

#### 提交任务响应

```json
{
  "task_id": "abc123xyz",
  "status": "pending"
}
```

#### 轮询状态响应（处理中）

```json
{
  "task_id": "abc123xyz",
  "status": "processing",
  "progress": 45
}
```

#### 轮询状态响应（完成）

```json
{
  "task_id": "abc123xyz",
  "status": "completed",
  "video_url": "https://example.com/videos/abc123xyz.mp4",
  "duration": 15,
  "aspect_ratio": "9:16"
}
```

## 支持的参考素材

如果您的 API 支持参考素材（图片、视频、音频），可以在 `body` 中添加：

```json
{
  "body": {
    "model": "video-ds-2.0-fast",
    "prompt": "{{prompt}}",
    "seconds": 15,
    "aspect_ratio": "9:16",
    "images": ["{{image_url_0}}", "{{image_url_1}}"],
    "videos": ["{{video_url_0}}"],
    "audios": ["{{audio_url_0}}"]
  }
}
```

## 功能特性

视频生成完成后，系统会自动：

1. ✅ 下载视频文件
2. ✅ 生成视频缩略图（用于列表显示）
3. ✅ 提取视频元数据（时长、宽高比）
4. ✅ 存储到本地 IndexedDB
5. ✅ 在任务卡片中显示视频预览（带播放图标）
6. ✅ 支持在详情页和全屏灯箱中播放视频

## UI 展示

- **任务卡片**: 显示视频缩略图 + 播放图标，标签显示时长和宽高比
- **详情页**: 支持视频播放器，可以暂停、快进、音量控制
- **全屏灯箱**: 点击视频可全屏播放

## 注意事项

1. **网络环境**: 视频文件通常较大，确保网络稳定
2. **跨域问题**: 视频 URL 需要支持 CORS
3. **存储空间**: 视频缓存占用较多空间，建议定期清理
4. **轮询间隔**: 根据视频生成时长调整轮询间隔，避免过于频繁

## 测试建议

配置完成后，建议：

1. 先用短视频（5-10秒）测试
2. 检查轮询是否正常工作
3. 确认视频可以正常下载和播放
4. 验证缩略图生成是否正确

## 故障排查

如果视频生成失败，请检查：

1. **API 配置**: 确认 `taskIdPath` 和 `videoUrlPaths` 路径正确
2. **状态值**: 确认 `successValues` 和 `failureValues` 包含所有可能的状态
3. **视频 URL**: 在浏览器中直接访问视频 URL，确认可以下载
4. **控制台日志**: 打开浏览器开发者工具查看错误信息

## 进阶配置

### 多模型支持

如果 API 支持多个模型，可以在 body 中使用变量：

```json
{
  "body": {
    "model": "{{model}}",
    "prompt": "{{prompt}}"
  }
}
```

然后在任务创建时选择不同的模型。

### 自定义轮询间隔

视频生成通常需要较长时间，可以根据视频时长动态调整：

- 短视频（5-10秒）: `intervalSeconds: 3`
- 中等视频（10-30秒）: `intervalSeconds: 5`
- 长视频（30秒以上）: `intervalSeconds: 10`

### 下载链接

某些 API 提供单独的下载链接端点：

```json
{
  "poll": {
    "path": "/v1/videos/{{task_id}}",
    "method": "GET",
    "statusPath": "status",
    "successValues": ["completed"],
    "failureValues": ["failed"],
    "result": {
      "videoUrlPaths": ["download_url", "video_url"]
    }
  }
}
```

或者使用独立的下载端点（某些 API 在任务完成后需要调用 `/content` 端点获取视频）：

```json
{
  "result": {
    "videoUrlPaths": ["content_url"]
  }
}
```

并在 API 返回中提供完整的下载 URL：`https://example.com/v1/videos/{task_id}/content`

## 示例配置（完整）

```json
{
  "id": "my-video-service",
  "name": "我的视频生成服务",
  "template": "http-video",
  "submit": {
    "path": "/v1/videos",
    "method": "POST",
    "contentType": "json",
    "body": {
      "model": "video-ds-2.0-fast",
      "prompt": "{{prompt}}",
      "seconds": 15,
      "aspect_ratio": "9:16"
    },
    "taskIdPath": "task_id"
  },
  "poll": {
    "path": "/v1/videos/{{task_id}}",
    "method": "GET",
    "intervalSeconds": 5,
    "statusPath": "status",
    "successValues": ["completed", "succeeded"],
    "failureValues": ["failed", "error"],
    "errorPath": "error",
    "result": {
      "videoUrlPaths": ["video_url", "url"]
    }
  }
}
```

将此配置复制到设置页面的"自定义服务商"中，然后就可以开始生成视频了！
