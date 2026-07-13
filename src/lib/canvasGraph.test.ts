import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import type { TaskRecord } from '../types'
import { buildCanvasGraph, type CanvasGraphTaskFilters } from './canvasGraph'

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

const noFilters: CanvasGraphTaskFilters = {
  searchQuery: '',
  filterStatus: 'all',
  filterFavorite: false,
  activeFavoriteCollectionId: null,
}

describe('buildCanvasGraph', () => {
  it('derives deterministic nodes, depths, lanes, and deduped edges from task lineage', () => {
    const taskA = task({
      id: 'task-a',
      createdAt: 100,
      outputImages: ['img-a-1', 'img-a-2'],
    })
    const taskB = task({
      id: 'task-b',
      createdAt: 200,
      inputImageIds: ['img-a-1', 'img-a-2'],
      outputImages: ['img-b-1'],
    })
    const taskC = task({
      id: 'task-c',
      createdAt: 300,
      inputImageIds: ['img-b-1', 'img-a-1'],
      outputImages: [],
    })

    const graph = buildCanvasGraph([taskC, taskB, taskA], noFilters)

    expect(graph.nodes.map((node) => node.id)).toEqual(['task-a', 'task-b', 'task-c'])
    expect(graph.edges).toEqual([
      { id: 'task-a->task-b', source: 'task-a', target: 'task-b' },
      { id: 'task-a->task-c', source: 'task-a', target: 'task-c' },
      { id: 'task-b->task-c', source: 'task-b', target: 'task-c' },
    ])
    expect(graph.nodes.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }))).toEqual([
      { id: 'task-a', x: 0, y: 0 },
      { id: 'task-b', x: 852, y: 0 },
      { id: 'task-c', x: 1704, y: 0 },
    ])
    expect(graph.nodes.map((node) => ({
      id: node.id,
      depth: node.data.depth,
      lane: node.data.lane,
      inputs: node.data.inputTaskIds,
    }))).toEqual([
      { id: 'task-a', depth: 0, lane: 0, inputs: [] },
      { id: 'task-b', depth: 1, lane: 0, inputs: ['task-a'] },
      { id: 'task-c', depth: 2, lane: 0, inputs: ['task-a', 'task-b'] },
    ])
  })

  it('filters tasks before deriving edges', () => {
    const graph = buildCanvasGraph(
      [
        task({ id: 'task-a', prompt: 'keep me', outputImages: ['img-a'] }),
        task({ id: 'task-b', prompt: 'drop me', inputImageIds: ['img-a'], outputImages: ['img-b'] }),
      ],
      { ...noFilters, searchQuery: 'keep me' },
    )

    expect(graph.nodes.map((node) => node.id)).toEqual(['task-a'])
    expect(graph.edges).toEqual([])
  })

  it('stacks sibling tasks vertically within the same depth bucket', () => {
    const root = task({ id: 'root', createdAt: 100, outputImages: ['img-root'] })
    const childA = task({ id: 'child-a', createdAt: 200, inputImageIds: ['img-root'] })
    const childB = task({ id: 'child-b', createdAt: 300, inputImageIds: ['img-root'] })

    const graph = buildCanvasGraph([childB, root, childA], noFilters)

    expect(graph.nodes.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }))).toEqual([
      { id: 'root', x: 0, y: 0 },
      { id: 'child-a', x: 852, y: 0 },
      { id: 'child-b', x: 852, y: 382 },
    ])
  })
})
