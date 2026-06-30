import { DEFAULT_FAL_MODEL, DEFAULT_IMAGES_MODEL } from './apiProfiles'
import type { TaskRecord } from '../types'

export interface CanvasNodeViewModel {
  promptText: string
  providerLabel: string
  requestedModel: string
  statusLabel: string
  visibleInputIds: string[]
  visibleOutputIds: string[]
  outputCount: number
  hiddenInputCount: number
  hiddenOutputCount: number
  hasInputs: boolean
  hasTransparentOutput: boolean
}

export function buildCanvasNodeViewModel(task: TaskRecord): CanvasNodeViewModel {
  const outputIds = task.outputImages ?? []
  const inputIds = task.inputImageIds ?? []

  return {
    promptText: task.prompt.trim() || '(无提示词)',
    providerLabel: task.apiProfileName || task.apiProvider || '本地',
    requestedModel: task.apiModel || (task.apiProvider === 'fal' ? DEFAULT_FAL_MODEL : DEFAULT_IMAGES_MODEL),
    statusLabel: task.status === 'running' ? '生成中' : task.status === 'error' ? '失败' : '完成',
    visibleInputIds: inputIds.slice(0, 3),
    visibleOutputIds: outputIds.slice(0, 4),
    outputCount: outputIds.length,
    hiddenInputCount: Math.max(0, inputIds.length - 3),
    hiddenOutputCount: Math.max(0, outputIds.length - 4),
    hasInputs: inputIds.length > 0,
    hasTransparentOutput: Boolean(task.transparentOutput || task.params.transparent_output),
  }
}
