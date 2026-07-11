# 无限画布使用教程

## 1 新建视频模型 Key

### 1\.1 模型介绍

目前有两种即梦模型：


**1\. 支持900参数，可以最多上传9张图片**。但是不能上传视频和音频（后续如果支持会通知）。只有三种视频时长，分为5秒，10秒，15秒。假设售价为0\.4一秒，那么5秒就是2元一次（具体售价根据网站的实时价格来看，如果不懂，可以问管理！）。生成失败会退款！



2\.**支持431参数，可以上传4张图片，3个视频（视频时长限制为3\-10秒内），1个音频（2 \< x \< 15秒，不超过15MB）\.**

计费模式为条计费，意思是，**不管是生成1秒还是15秒，都叫做一条。具体一条的价格以站点售价为准。**



### 1\.2 创建密钥

第一步，左边栏的API密钥，进入之后，点击右上角的创建API密钥

![API 密钥列表](../../public/manual/images/01-api-key-list.png)

创建API密钥的界面，进行如下配置。



#### 1\.2\.1 配置900参数的即梦模型

![900 参数即梦模型密钥配置](../../public/manual/images/02-video-model-900.png)



#### 1\.2\.2 配置431参数的即梦模型

![431 参数即梦模型密钥配置](../../public/manual/images/03-video-model-431.png)

### 1\.3 查看密钥


创建完成之后，在API密钥这里，即可查看到你的密钥

![查看已创建的 API 密钥](../../public/manual/images/04-view-api-key.png)

## 2 新建画布

![新建画布](../../public/manual/images/05-create-canvas.png)

## 3 配置视频、图像、文本模型

![打开渠道配置入口](../../public/manual/images/06-open-provider-settings.png)

点击这个图标，会弹出配置框

![渠道配置面板](../../public/manual/images/07-provider-settings.png)

可以根据你的视频模型来写渠道名称，比如你配置的是900的即梦模型，就写成“900即梦”，这样你在画布里配置的时候，可以避免出现传错参数而失败的问题。



**配置完成之后，一定要点击“拉取模型”，获取这个API的模型列表**



**需要配置另一个视频模型，或者其他的图像模型，点击右上角的新增渠道**



![新增渠道](../../public/manual/images/08-add-provider.png)

画布还可以配置文本模型，用户平时的问答，生成提示词等



1. 新建渠道

2. 在新的渠道里，输入中转站的文本模型API key即可，目前只支持gpt系列模型，和openai兼容接口的模型。

![配置文本模型渠道](../../public/manual/images/09-text-model-provider.png)

### 3\.1 配置模型

还是刚才的配置面板，滑动到最上面，点击模型

![配置模型映射](../../public/manual/images/10-model-mapping.png)

为每一个模型选项都配置你需要的模型，如上图所示。

**你配置的模型，才会在无限画布中，变成可选择的模型，如果你不配置，那么在无限画布中，将无法选择到你想要的视频模型。**



默认模型也可以配置：


![配置默认模型](../../public/manual/images/11-default-models.png)

生成偏好也可以改，默认生成数量最好改为1张

![配置生成偏好](../../public/manual/images/12-generation-preferences.png)

## 4 正式使用

## 4.1 通用功能


如果生成失败，会退款：
![任务失败后的退款记录](../../public/manual/images/15-task-refund-status.png)

在画布中的显示是这样：
![画布中的视频生成失败状态](../../public/manual/images/16-canvas-generation-failed.png)

提交任务之后，会查询视频的生成进度，一般视频生成时间比较长，不要着急。
如果出现报错，但是中转站没有退款，在任务日志里也表示进行中，那么可以点击
![立即查询视频生成进度](../../public/manual/images/17-query-video-progress.png)
立即查询，查询进度，如果有进度，就表示服务端还在继续生成，等待即可。

等进度到100%的时候，就可以点击“下载视频”将视频下载下来。

## 4.2 900参数即梦视频
在画布里生成视频：

输入你的提示词，根据你选择的模型上传参数，**如果是900的即梦模型，那么就不能传入视频和音频参数，这样会报错，必须注意！！！**

![选择 900 参数即梦视频模型](../../public/manual/images/18-select-video-model-900.png)

假设你选的900的即梦模型，因为只有3个模型，分别对应时长是5秒，10秒，15秒，那么最终生成的时长由你选择的模型为准。例如：你选择了video-v1-5s的模型，但是你在视频设置这里：
![900 参数即梦视频时长设置](../../public/manual/images/19-video-duration-setting-900.png)
选择了9秒，那么最终会根据你的模型而生成5秒的视频。扣费也是扣5秒的费用。

**而且，目前视频比例，只支持16:9(1920 * 1080)、9:16(1080 * 1920)、1:1(1080 * 1080)**

你在选择尺寸参数的时候，如果不是这三个标准参数，会根据你的参数最接近而调整！

**该模型可以过人脸！**


## 4.3 431参数即梦视频
可以传4张图片，3个视频，1个音频。都必须通过公网直链的方式传递参数，不能通过base64

其中，视频必须在3~10秒之间，音频必须在2～15秒之间，并且小于等于15MB

**注意：这个模型为条计费，不管是生成1秒还是15秒，都是同样的计费方式，所以，在生成视频前，必须配置自己的生成视频秒数，传入多少秒，就生成多少秒的视频！在此已详细说明，后续不对此再做解释！**

![431 参数即梦视频时长设置](../../public/manual/images/20-video-duration-setting-431.png)


![任务日志中的视频生成进度](../../public/manual/images/21-task-log-progress.png)

## 5 单独使用生图

点击顶部的画廊

![进入画廊](../../public/manual/images/13-gallery-entry.png)

点击右上角的设置

![画廊设置](../../public/manual/images/14-gallery-settings.png)

输入中转站的API key，记住，必须是image\-2的api key，目前仅仅支持image\-2。

**这里的设置和刚刚画布的绘图模型是不互通的，所以如果要单独生图，必须配置两遍**



## 6 API 文档

对下游提供两个 OpenAI 兼容接口：

- 文生图：`POST /v1/images/generations`

- 图生图/图片编辑：`POST /v1/images/edits`

### 6\.1 视频接口概览

900参数即梦 和431参数即梦：

- 对下游：可以使用同一个接口 `POST /v1/videos`

也就是说，下游不需要知道渠道差异，只需要通过 `model` 区分。

---

### 6\.2 统一 API 图片文档

以下假设：

```Plain Text
BASE_URL=https://你的域名
API_KEY=下游令牌
```

所有接口均使用：

```Plain Text
Authorization: Bearer API_KEY
```

#### 6\.2\.1 文生图

```Plain Text
POST /v1/images/generations
Content-Type: application/json
```

请求示例：

```Plain Text
curl "$BASE_URL/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "一只戴着宇航员头盔的橘猫，站在月球表面，电影感灯光",
    "n": 1,
    "size": "1024x1024",
    "quality": "high",
    "response_format": "url"
  }'
```

主要参数：

响应结构：

```Plain Text
{
  "created": 1750000000,
  "data": [
    {
      "url": "https://example.com/generated-image.png",
      "b64_json": "",
      "revised_prompt": ""
    }
  ]
}
```

如果返回 Base64，结果在：

```Plain Text
{
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAA..."
    }
  ]
}
```

下游最好同时兼容 `url` 和 `b64_json`。

---

#### 6\.2\.2 图生图/图片编辑

推荐使用标准 OpenAI multipart 格式：

```Plain Text
POST /v1/images/edits
Content-Type: multipart/form-data
```

单张参考图：

```Plain Text
curl "$BASE_URL/v1/images/edits" \
  -H "Authorization: Bearer $API_KEY" \
  -F "model=gpt-image-2" \
  -F "prompt=保留人物主体，将背景替换为夜晚的东京街头，霓虹灯风格" \
  -F "image=@./input.png" \
  -F "n=1" \
  -F "size=1024x1024" \
  -F "quality=high"
```

多张参考图：

```Plain Text
curl "$BASE_URL/v1/images/edits" \
  -H "Authorization: Bearer $API_KEY" \
  -F "model=gpt-image-2" \
  -F "prompt=融合两张图片的主体和画面风格" \
  -F "image[]=@./reference-1.png" \
  -F "image[]=@./reference-2.png" \
  -F "n=1" \
  -F "size=1024x1024"
```

带遮罩：

```Plain Text
curl "$BASE_URL/v1/images/edits" \
  -H "Authorization: Bearer $API_KEY" \
  -F "model=gpt-image-2" \
  -F "prompt=将遮罩区域替换成一束鲜花" \
  -F "image=@./input.png" \
  -F "mask=@./mask.png"
```

项目支持：

- `image`

- `image[]`

- `image[0]`、`image[1]`

- `mask`

---

### 6\.3 统一视频生成接口

所有视频统一使用：

```Plain Text
POST /v1/videos
Content-Type: application/json
```

当前模型：

#### 6\.3\.1 文生视频

900参数即梦示例：

```Plain Text
curl "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "video-v1-5s",
    "prompt": "一只橘猫在雨后的霓虹街道上缓慢行走",
    "aspect_ratio": "16:9"
  }'
```

431参数即梦示例：

```Plain Text
curl "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "video-ds-2.0-fast",
    "prompt": "电影镜头，一辆跑车穿过夜晚的城市",
    "seconds": 10,
    "aspect_ratio": "16:9"
  }'
```

#### 6\.3\.2 图生视频

两个渠道可以使用相同的基础请求格式：

```Plain Text
curl "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "video-ds-2.0-fast",
    "prompt": "镜头缓慢推进，人物轻轻转头看向镜头",
    "images": [
      "https://cdn.example.com/reference.png"
    ],
    "seconds": 10,
    "aspect_ratio": "16:9"
  }'
```

也支持单图字段：

```Plain Text
{
  "model": "video-v1-5s",
  "prompt": "让画面中的人物缓慢向前走",
  "image": "https://cdn.example.com/reference.png",
  "aspect_ratio": "9:16"
}
```



900参数即梦不支持视频和音频转入

##### 6\.3\.2\.1 431参数即梦支持视频和音频

支持：

```Plain Text
{
  "model": "video-ds-2.0-fast",
  "prompt": "提示词",
  "seconds": 10,
  "aspect_ratio": "16:9",
  "image": "https://example.com/image.png",
  "images": ["https://example.com/image.png"],
  "videos": ["https://example.com/video.mp4"],
  "audios": ["https://example.com/audio.mp3"]
}
```

注意：

- `prompt` 必填。

- `seconds` 可传数字或字符串。

- 比例只能是 `16:9`、`9:16`、`1:1`。

- 图片、视频、音频必须是公网可访问的直接 HTTP/HTTPS URL。

- 不支持 Base64、Data URI、本地文件路径、localhost 或内网 IP。

---

#### 6\.3\.3 视频创建响应

两个渠道都统一返回：

```Plain Text
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "task_id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "model": "video-ds-2.0-fast",
  "status": "queued",
  "progress": 0,
  "created_at": 1750000000
}
```

请保存 `id`。它是你的网关生成的公开任务 ID。

可能的状态：

```Plain Text
queued
in_progress
completed
failed
```

---

#### 6\.3\.4 查询视频任务

```Plain Text
GET /v1/videos/{task_id}
```

示例：

```Plain Text
curl "$BASE_URL/v1/videos/task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Authorization: Bearer $API_KEY"
```

处理中：

```Plain Text
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "model": "video-ds-2.0-fast",
  "status": "in_progress",
  "progress": 30,
  "created_at": 1750000000,
  "metadata": {
    "url": ""
  }
}
```

完成后：

```Plain Text
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "model": "video-ds-2.0-fast",
  "status": "completed",
  "progress": 100,
  "created_at": 1750000000,
  "completed_at": 1750000060,
  "metadata": {
    "url": "https://upstream.example.com/video.mp4"
  }
}
```

查询接口统一转换为 OpenAI 视频结构

---

#### 6\.3\.5 获取视频文件

任务状态变为 `completed` 后，推荐始终从你的网关下载：

```Plain Text
GET /v1/videos/{task_id}/content
```

示例：

```Plain Text
curl "$BASE_URL/v1/videos/task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/content" \
  -H "Authorization: Bearer $API_KEY" \
  --output result.mp4
```

该接口返回视频二进制流，一般是：

```Plain Text
Content-Type: video/mp4
```
