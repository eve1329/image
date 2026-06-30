/**
 * 视频处理工具函数
 */

/**
 * 从视频 Blob 生成缩略图
 * @param videoBlob 视频 Blob 对象
 * @returns 缩略图的 data URL (JPEG)
 */
export async function generateVideoThumbnail(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoBlob)

    video.onloadedmetadata = () => {
      // 跳到 0.1 秒处获取第一帧
      video.currentTime = Math.min(0.1, video.duration / 2)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        // 生成最大宽度 320px 的缩略图
        const maxWidth = 320
        const scale = maxWidth / video.videoWidth
        canvas.width = maxWidth
        canvas.height = Math.floor(video.videoHeight * scale)

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('无法创建 canvas context'))
          return
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)

        // 转换为 JPEG，质量 0.8
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('视频加载失败'))
    }

    video.src = url
    video.muted = true
    video.playsInline = true
  })
}

/**
 * 获取视频的元数据（时长、宽高等）
 * @param videoBlob 视频 Blob 对象
 * @returns 视频元数据
 */
export async function getVideoMetadata(videoBlob: Blob): Promise<{
  duration: number
  width: number
  height: number
  aspectRatio: string
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoBlob)

    video.onloadedmetadata = () => {
      const width = video.videoWidth
      const height = video.videoHeight
      const duration = video.duration

      // 计算宽高比
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
      const divisor = gcd(width, height)
      const aspectRatio = `${width / divisor}:${height / divisor}`

      URL.revokeObjectURL(url)
      resolve({ duration, width, height, aspectRatio })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('视频加载失败'))
    }

    video.src = url
    video.muted = true
    video.playsInline = true
  })
}

/**
 * 下载视频文件
 * @param url 视频 URL
 * @param signal 可选的 AbortSignal
 * @returns 视频 Blob
 */
export async function downloadVideo(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`下载视频失败: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type')
  if (contentType && !contentType.includes('video/')) {
    console.warn(`视频 URL 返回了非视频类型: ${contentType}`)
  }

  return await response.blob()
}

/**
 * 将视频 Blob 转换为 data URL
 * @param videoBlob 视频 Blob 对象
 * @returns data URL
 */
export async function videoBlobToDataUrl(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('读取视频失败'))
    reader.readAsDataURL(videoBlob)
  })
}
