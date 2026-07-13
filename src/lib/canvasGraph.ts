import { Position, type Edge, type Node } from '@xyflow/react'
import type { TaskRecord } from '../types'
import { taskMatchesFilterStatus, taskMatchesSearchQuery, getTaskFavoriteCollectionIds } from '../store'

export interface CanvasGraphTaskFilters {
  searchQuery: string
  filterStatus: 'all' | 'running' | 'done' | 'error'
  filterFavorite: boolean
  activeFavoriteCollectionId: string | null
}

export interface CanvasGraphNodeData extends Record<string, unknown> {
  taskId: string
  task: TaskRecord
  inputTaskIds: string[]
  outputTaskIds: string[]
  depth: number
  lane: number
}

export type CanvasGraphNode = Node<CanvasGraphNodeData, 'canvasTask'>
export type CanvasGraphEdge = Edge

export interface CanvasGraph {
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
}

const NODE_WIDTH = 720
const NODE_HEIGHT = 290
const NODE_X_GAP = 132
const NODE_Y_GAP = 92

export function buildCanvasGraph(tasks: TaskRecord[], filters: CanvasGraphTaskFilters): CanvasGraph {
  const sortedTasks = [...tasks]
    .filter((task) => matchesCanvasTaskFilters(task, filters))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))

  const taskById = new Map(sortedTasks.map((task) => [task.id, task] as const))
  const outputToTaskId = new Map<string, string>()
  for (const task of sortedTasks) {
    for (const imageId of task.outputImages ?? []) {
      if (!outputToTaskId.has(imageId)) outputToTaskId.set(imageId, task.id)
    }
  }

  const inputTaskIdByTaskId = new Map<string, string[]>()
  const outputTaskIdByTaskId = new Map<string, string[]>()
  const edgeKeys = new Set<string>()
  const edges: CanvasGraphEdge[] = []

  for (const task of sortedTasks) {
    const producerIds = new Set<string>()
    for (const inputImageId of task.inputImageIds ?? []) {
      const producerId = outputToTaskId.get(inputImageId)
      if (!producerId || producerId === task.id) continue
      producerIds.add(producerId)
    }

    const inputTaskIds = [...producerIds]
      .sort((a, b) => {
        const taskA = taskById.get(a)
        const taskB = taskById.get(b)
        return (taskA?.createdAt ?? 0) - (taskB?.createdAt ?? 0) || a.localeCompare(b)
      })
    inputTaskIdByTaskId.set(task.id, inputTaskIds)
    for (const producerId of inputTaskIds) {
      const producerOutputs = outputTaskIdByTaskId.get(producerId) ?? []
      producerOutputs.push(task.id)
      outputTaskIdByTaskId.set(producerId, producerOutputs)

      const key = `${producerId}->${task.id}`
      if (edgeKeys.has(key)) continue
      edgeKeys.add(key)
      edges.push({ id: key, source: producerId, target: task.id })
    }
  }

  edges.sort((a, b) => {
    const sourceA = taskById.get(a.source)
    const sourceB = taskById.get(b.source)
    const targetA = taskById.get(a.target)
    const targetB = taskById.get(b.target)
    return (sourceA?.createdAt ?? 0) - (sourceB?.createdAt ?? 0)
      || (targetA?.createdAt ?? 0) - (targetB?.createdAt ?? 0)
      || a.id.localeCompare(b.id)
  })

  const depthByTaskId = new Map<string, number>()
  const visiting = new Set<string>()
  const getDepth = (taskId: string): number => {
    const cached = depthByTaskId.get(taskId)
    if (cached != null) return cached
    if (visiting.has(taskId)) return 0
    visiting.add(taskId)

    const parents = inputTaskIdByTaskId.get(taskId) ?? []
    const depth = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((parentId) => getDepth(parentId)))
    visiting.delete(taskId)
    depthByTaskId.set(taskId, depth)
    return depth
  }

  const nodesByDepth = new Map<number, TaskRecord[]>()
  for (const task of sortedTasks) {
    const depth = getDepth(task.id)
    const bucket = nodesByDepth.get(depth) ?? []
    bucket.push(task)
    nodesByDepth.set(depth, bucket)
  }

  const orderedDepths = [...nodesByDepth.keys()].sort((a, b) => a - b)
  const nodes: CanvasGraphNode[] = []
  for (const depth of orderedDepths) {
    const laneTasks = (nodesByDepth.get(depth) ?? []).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    laneTasks.forEach((task, lane) => {
      nodes.push({
        id: task.id,
        type: 'canvasTask',
        position: {
          x: depth * (NODE_WIDTH + NODE_X_GAP),
          y: lane * (NODE_HEIGHT + NODE_Y_GAP),
        },
        data: {
          taskId: task.id,
          task,
          inputTaskIds: inputTaskIdByTaskId.get(task.id) ?? [],
          outputTaskIds: outputTaskIdByTaskId.get(task.id) ?? [],
          depth,
          lane,
        },
        draggable: false,
        selectable: true,
        deletable: false,
        dragHandle: '.canvas-task-drag-handle',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      })
    })
  }

  return { nodes, edges }
}

function matchesCanvasTaskFilters(task: TaskRecord, filters: CanvasGraphTaskFilters) {
  if (filters.filterFavorite) {
    if (!task.isFavorite) return false
    if (filters.activeFavoriteCollectionId) {
      const collectionIds = getTaskFavoriteCollectionIds(task)
      if (!collectionIds.includes(filters.activeFavoriteCollectionId)) return false
    }
  }

  if (!taskMatchesFilterStatus(task, filters.filterStatus)) return false
  return taskMatchesSearchQuery(task, filters.searchQuery)
}
