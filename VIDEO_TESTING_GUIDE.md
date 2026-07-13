# 视频生成功能测试指南

开发服务器已启动：http://localhost:5173

## 测试步骤

### 1. 配置视频 API

打开浏览器访问 http://localhost:5173，然后：

1. 点击右上角 **设置图标** ⚙️
2. 滚动到 **自定义服务商** 部分
3. 点击 **添加自定义服务商**
4. 粘贴以下配置（根据你的实际 API 修改）：

```json
{
  "id": "video-ds-2.0",
  "name": "视频生成 DS 2.0",
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

5. 在 **Base URL** 中填入你的 API 地址（如 `https://artworkers.top`）
6. 在 **API Key** 中填入你的密钥
7. 点击 **保存**

### 2. 创建视频生成 API Profile

1. 在设置中找到 **API 配置** 部分
2. 点击 **添加配置**
3. 填写：
   - **名称**: "视频生成测试"
   - **Provider**: 选择刚才添加的 "视频生成 DS 2.0"
   - **Base URL**: `https://artworkers.top`（或你的 API 地址）
   - **API Key**: 你的密钥
4. 点击 **保存**
5. 将这个配置设为 **活动配置**

### 3. 测试视频生成

1. 回到主界面
2. 在顶部下拉菜单中选择刚才创建的 **"视频生成测试"** 配置
3. 在输入框中输入测试提示词，例如：
   ```
   A cinematic 9:16 video of a cat running through warm sunlight
   ```
4. 点击 **生成** 按钮

### 4. 观察运行过程

你应该看到：

1. **任务卡片出现**，状态为"生成中"
2. **定时器显示**，记录耗时
3. **每 5 秒轮询一次** API 状态（可在浏览器开发者工具 Network 标签中观察）
4. **完成后**：
   - 任务状态变为"完成"
   - 显示视频缩略图
   - 缩略图上有**播放图标**叠加
   - 右下角显示**视频时长**徽章
   - 左上角显示**宽高比和时长**标签

### 5. 测试视频播放

#### 在任务卡片中
- 点击视频缩略图，应该打开详情页

#### 在详情页
- 应该看到原生视频播放器
- 可以播放、暂停、调整音量
- 显示宽高比和时长信息
- 点击视频可以打开全屏灯箱

#### 在全屏灯箱中
- 视频全屏显示
- 原生控制条可用
- 点击背景区域可关闭
- 按 ESC 键退出

## 测试清单

### ✅ 功能测试

- [ ] API 配置成功保存
- [ ] 任务提交成功，获得 task_id
- [ ] 状态轮询正常工作（每 5 秒一次）
- [ ] 视频下载成功
- [ ] 缩略图生成正确
- [ ] 元数据提取正确（时长、宽高比）
- [ ] 任务卡片显示视频缩略图 + 播放图标
- [ ] 详情页视频播放正常
- [ ] 全屏灯箱视频播放正常
- [ ] 视频控制条（播放、暂停、音量、进度）可用

### ✅ 异常测试

- [ ] API 返回错误时，任务状态显示"失败"
- [ ] 网络中断时，轮询能恢复
- [ ] 视频下载失败时，显示错误信息
- [ ] 无效的视频 URL 处理正确

### ✅ UI/UX 测试

- [ ] 视频卡片与图片卡片视觉区分明显
- [ ] 播放图标清晰可见
- [ ] 时长和宽高比标签易读
- [ ] 视频播放流畅
- [ ] 响应式布局正常（手机、平板、桌面）

## 调试技巧

### 1. 查看网络请求

打开浏览器开发者工具（F12）→ Network 标签：

- 检查 POST `/v1/videos` 请求和响应
- 检查 GET `/v1/videos/{task_id}` 轮询请求
- 查看视频文件下载请求

### 2. 查看控制台日志

开发者工具 → Console 标签：

- 查看视频处理日志
- 查看缩略图生成日志
- 查看错误信息

### 3. 检查存储

开发者工具 → Application 标签 → IndexedDB：

- 查看 `images` 表中的视频缩略图
- 查看 `tasks` 表中的任务记录

### 4. 常见问题排查

**问题**: 轮询一直显示"处理中"
- **检查**: API 响应的 `status` 字段值是否在 `successValues` 中
- **解决**: 调整配置中的 `successValues` 和 `failureValues`

**问题**: 找不到视频 URL
- **检查**: API 响应结构，视频 URL 的路径
- **解决**: 调整 `videoUrlPaths` 配置

**问题**: 视频下载失败
- **检查**: 视频 URL 是否可访问，是否有 CORS 问题
- **解决**: 确保视频 URL 支持跨域访问

**问题**: 缩略图显示黑屏
- **检查**: 视频格式是否支持，视频是否损坏
- **解决**: 使用标准的 MP4 格式

## 测试用例示例

### 测试用例 1: 短视频生成（9:16）
```
提示词: A vertical video of a flower blooming in time-lapse, 9:16 aspect ratio
预期结果: 生成 9:16 竖屏视频，时长约 15 秒
```

### 测试用例 2: 横屏视频生成（16:9）
```
提示词: A cinematic landscape video of ocean waves at sunset, 16:9 format
配置修改: aspect_ratio: "16:9"
预期结果: 生成 16:9 横屏视频
```

### 测试用例 3: 包含参考图片
```
提示词: Create a video based on this product image style
上传参考图片
预期结果: 根据参考图片风格生成视频
```

## Mock API 测试（可选）

如果暂时没有实际 API，可以使用 Mock API 进行测试：

### 使用 JSON Server

1. 安装 json-server:
   ```bash
   npm install -g json-server
   ```

2. 创建 `mock-api.json`:
   ```json
   {
     "videos": [
       {
         "task_id": "test123",
         "status": "completed",
         "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
         "duration": 15,
         "aspect_ratio": "16:9"
       }
     ]
   }
   ```

3. 启动 Mock API:
   ```bash
   json-server --watch mock-api.json --port 3001
   ```

4. 配置 Base URL 为 `http://localhost:3001`

## 性能测试

- [ ] 测试长视频（30 秒+）下载速度
- [ ] 测试多个并发视频生成
- [ ] 测试 IndexedDB 存储容量限制
- [ ] 测试缩略图生成性能

## 浏览器兼容性测试

- [ ] Chrome（推荐）
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] 移动端浏览器（iOS Safari、Android Chrome）

## 报告 Bug

如果发现问题，请记录：

1. **环境信息**
   - 浏览器版本
   - 操作系统
   - API 提供商

2. **复现步骤**
   - 详细的操作步骤
   - 使用的提示词
   - API 配置

3. **预期行为 vs 实际行为**
   - 期望发生什么
   - 实际发生了什么

4. **错误信息**
   - 控制台错误日志
   - 网络请求失败信息
   - 截图或录屏

---

## 快速测试命令

```bash
# 检查开发服务器状态
curl http://localhost:5173

# 查看实时日志
tail -f /tmp/vite-dev.log

# 停止开发服务器
# 在终端中按 Ctrl+C
```

祝测试顺利！🎉
