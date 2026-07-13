import { describe, expect, it } from 'vitest'
import { Position, type Node } from '@xyflow/react'
import { DEFAULT_PARAMS, type TaskRecord } from '../types'
import type { CanvasGraphNodeData } from './canvasGraph'
import {
  CANVAS_LAYOUT_STORAGE_KEY,
  clearCanvasLayoutPositions,
  mergeCanvasLayoutPositions,
  readCanvasLayoutPositions,
  setCanvasLayoutPosition,
  writeCanvasLayoutPositions,
} from './canvasLayout'

type CanvasTaskNode = Node<CanvasGraphNodeData, 'canvasTask'>

function taskNode(id: string, x: number, y: number): CanvasTaskNode {
  return {
    id,
    type: 'canvasTask',
    position: { x, y },
    data: {
      taskId: id,
      task: {
        id,
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
      } satisfies TaskRecord,
      inputTaskIds: [],
      outputTaskIds: [],
      depth: 0,
      lane: 0,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    dragHandle: '.canvas-task-drag-handle',
    draggable: false,
    selectable: true,
    deletable: false,
  }
}

describe('canvasLayout', () => {
  it('writes and reads the versioned local layout payload', () => {
    const storageMap = new Map<string, string>()
    const storage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, value)
      },
      removeItem: (key: string) => {
        storageMap.delete(key)
      },
    }

    expect(writeCanvasLayoutPositions(storage, { 'task-a': { x: 120, y: 240 } })).toBe(true)
    expect(storageMap.get(CANVAS_LAYOUT_STORAGE_KEY)).toContain('"version":1')
    expect(readCanvasLayoutPositions(storage)).toEqual({ 'task-a': { x: 120, y: 240 } })
  })

  it('overlays manual positions onto matching nodes and leaves untouched nodes at auto-layout', () => {
    const merged = mergeCanvasLayoutPositions(
      [taskNode('task-a', 0, 0), taskNode('task-b', 852, 0)],
      {
        'task-b': { x: 940, y: 140 },
        ghost: { x: 1, y: 2 },
      },
    )

    expect(merged.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }))).toEqual([
      { id: 'task-a', x: 0, y: 0 },
      { id: 'task-b', x: 940, y: 140 },
    ])
  })

  it('returns new node objects only for nodes with manual overrides', () => {
    const original = [taskNode('task-a', 0, 0), taskNode('task-b', 852, 0)]
    const merged = mergeCanvasLayoutPositions(original, { 'task-b': { x: 900, y: 40 } })

    expect(merged[0]).toBe(original[0])
    expect(merged[1]).not.toBe(original[1])
    expect(merged[1].position).toEqual({ x: 900, y: 40 })
  })

  it('falls back safely when localStorage data is malformed or unavailable', () => {
    const badStorage = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('no write')
      },
      removeItem: () => {
        throw new Error('no remove')
      },
    }

    expect(readCanvasLayoutPositions(badStorage)).toEqual({})
    expect(writeCanvasLayoutPositions(badStorage, { 'task-a': { x: 1, y: 2 } })).toBe(false)
    expect(clearCanvasLayoutPositions(badStorage)).toBe(false)
  })

  it('returns the same positions object when a dragged node did not actually move', () => {
    const current = { 'task-a': { x: 10, y: 20 } }

    expect(setCanvasLayoutPosition(current, 'task-a', { x: 10, y: 20 })).toBe(current)
    expect(setCanvasLayoutPosition(current, 'task-b', { x: 30, y: 40 })).toEqual({
      'task-a': { x: 10, y: 20 },
      'task-b': { x: 30, y: 40 },
    })
  })
})
