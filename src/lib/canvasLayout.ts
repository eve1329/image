import type { XYPosition } from '@xyflow/react'
import type { CanvasGraphNode } from './canvasGraph'

export const CANVAS_LAYOUT_STORAGE_KEY = 'gpt-image-playground.canvas-layout.v1'
const CANVAS_LAYOUT_STORAGE_VERSION = 1

export type CanvasLayoutPositions = Record<string, XYPosition>

interface CanvasLayoutStoragePayload {
  version: number
  positions: CanvasLayoutPositions
}

function isFinitePosition(value: unknown): value is XYPosition {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return Number.isFinite(record.x) && Number.isFinite(record.y)
}

function sanitizePositions(value: unknown): CanvasLayoutPositions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const next: CanvasLayoutPositions = {}
  for (const [taskId, position] of Object.entries(value as Record<string, unknown>)) {
    if (!isFinitePosition(position)) continue
    next[taskId] = { x: position.x, y: position.y }
  }
  return next
}

export function readCanvasLayoutPositions(storage: Pick<Storage, 'getItem'> | null | undefined): CanvasLayoutPositions {
  if (!storage) return {}

  try {
    const raw = storage.getItem(CANVAS_LAYOUT_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Partial<CanvasLayoutStoragePayload> | null
    if (!parsed || parsed.version !== CANVAS_LAYOUT_STORAGE_VERSION) return {}
    return sanitizePositions(parsed.positions)
  } catch {
    return {}
  }
}

export function writeCanvasLayoutPositions(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined,
  positions: CanvasLayoutPositions,
) {
  if (!storage) return false

  try {
    if (Object.keys(positions).length === 0) {
      storage.removeItem(CANVAS_LAYOUT_STORAGE_KEY)
      return true
    }

    storage.setItem(CANVAS_LAYOUT_STORAGE_KEY, JSON.stringify({
      version: CANVAS_LAYOUT_STORAGE_VERSION,
      positions,
    } satisfies CanvasLayoutStoragePayload))
    return true
  } catch {
    return false
  }
}

export function clearCanvasLayoutPositions(storage: Pick<Storage, 'removeItem'> | null | undefined) {
  if (!storage) return false

  try {
    storage.removeItem(CANVAS_LAYOUT_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function setCanvasLayoutPosition(
  positions: CanvasLayoutPositions,
  taskId: string,
  nextPosition: XYPosition,
): CanvasLayoutPositions {
  const current = positions[taskId]
  if (current && current.x === nextPosition.x && current.y === nextPosition.y) return positions

  return {
    ...positions,
    [taskId]: {
      x: nextPosition.x,
      y: nextPosition.y,
    },
  }
}

export function mergeCanvasLayoutPositions(nodes: CanvasGraphNode[], positions: CanvasLayoutPositions): CanvasGraphNode[] {
  return nodes.map((node) => {
    const manualPosition = positions[node.id]
    if (!manualPosition) return node

    return {
      ...node,
      position: {
        x: manualPosition.x,
        y: manualPosition.y,
      },
    }
  })
}
