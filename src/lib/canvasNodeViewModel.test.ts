import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import type { TaskRecord } from '../types'
import { buildCanvasNodeViewModel } from './canvasNodeViewModel'
import { DEFAULT_FAL_MODEL, DEFAULT_IMAGES_MODEL } from './apiProfiles'

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-a',
    prompt: 'prompt',
    params: { ...DEFAULT_PARAMS },
    inputImageIds: [],
    maskTargetImageId: null,
    maskImageId: null,
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    ...overrides,
  }
}

describe('buildCanvasNodeViewModel', () => {
  it('builds the stage-1 prompt rail and output matrix slices', () => {
    const vm = buildCanvasNodeViewModel(task({
      prompt: '  hello canvas  ',
      inputImageIds: ['in-1', 'in-2', 'in-3', 'in-4'],
      outputImages: ['out-1', 'out-2', 'out-3', 'out-4', 'out-5'],
    }))

    expect(vm.promptText).toBe('hello canvas')
    expect(vm.visibleInputIds).toEqual(['in-1', 'in-2', 'in-3'])
    expect(vm.hiddenInputCount).toBe(1)
    expect(vm.visibleOutputIds).toEqual(['out-1', 'out-2', 'out-3', 'out-4'])
    expect(vm.hiddenOutputCount).toBe(1)
  })

  it('derives provider, model, status, and transparency labels deterministically', () => {
    const runningFal = buildCanvasNodeViewModel(task({
      apiProvider: 'fal',
      apiProfileName: '',
      apiModel: '',
      status: 'running',
      transparentOutput: true,
    }))

    expect(runningFal.providerLabel).toBe('fal')
    expect(runningFal.requestedModel).toBe(DEFAULT_FAL_MODEL)
    expect(runningFal.statusLabel).toBe('生成中')
    expect(runningFal.hasTransparentOutput).toBe(true)

    const defaultOpenAI = buildCanvasNodeViewModel(task({
      apiProvider: 'openai',
      apiProfileName: 'OpenAI Prod',
      apiModel: '',
      status: 'error',
      transparentOutput: false,
      params: { ...DEFAULT_PARAMS, transparent_output: true },
    }))

    expect(defaultOpenAI.providerLabel).toBe('OpenAI Prod')
    expect(defaultOpenAI.requestedModel).toBe(DEFAULT_IMAGES_MODEL)
    expect(defaultOpenAI.statusLabel).toBe('失败')
    expect(defaultOpenAI.hasTransparentOutput).toBe(true)
  })
})
