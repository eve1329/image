# Canvas Mode Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship stage-2 Canvas Mode so users can drag task nodes, persist their positions locally on the current browser, and reset back to deterministic auto-layout without changing backend data or `TaskRecord`.

**Architecture:** Keep `buildCanvasGraph()` as the canonical auto-layout generator and add a small browser-local overlay layer for manual positions only. The new `canvasLayout` helper owns versioned `localStorage` parsing, writing, clearing, and node-position merging; `CanvasWorkspace` becomes a controlled React Flow surface that applies overrides, persists moved node positions on drag stop, and exposes `Fit view` plus `Reset layout` controls while preserving stage-1 node detail-open behavior.

**Tech Stack:** React 19, TypeScript, Vitest, `@xyflow/react@12.11.1`, browser `localStorage`

---

## File Map

- Create: `src/lib/canvasLayout.ts`
  - Own the versioned `localStorage` key, safe parse/write helpers, and auto-layout overlay merge logic.
- Create: `src/lib/canvasLayout.test.ts`
  - Lock the storage contract and layout overlay semantics with pure Vitest tests.
- Modify: `src/components/CanvasWorkspace.tsx`
  - Switch to controlled React Flow nodes, enable drag persistence, add reset-layout UI, and update canvas copy from read-only to local-editable.
- Modify: `src/components/HelpModal.tsx`
  - Replace the stale read-only canvas guidance with local-layout behavior notes.
- Modify: `.agents/state/process.md`
  - Refresh handoff state after implementation and verification.

### Task 1: Add the layout overlay helper with failing tests first

**Files:**
- Create: `src/lib/canvasLayout.test.ts`
- Create: `src/lib/canvasLayout.ts`
- Reuse: `src/lib/canvasGraph.ts`

- [ ] **Step 1: Write the failing helper tests for versioned storage, overlay merge, and malformed fallback**

```ts
import { describe, expect, it } from 'vitest'
import { Position, type Node } from '@xyflow/react'
import type { TaskRecord } from '../types'
import { DEFAULT_PARAMS } from '../types'
import type { CanvasGraphNodeData } from './canvasGraph'
import {
  CANVAS_LAYOUT_STORAGE_KEY,
  clearCanvasLayoutPositions,
  mergeCanvasLayoutPositions,
  readCanvasLayoutPositions,
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
})
```

- [ ] **Step 2: Run the new helper test file and confirm the red state**

Run: `npm run test -- src/lib/canvasLayout.test.ts`
Expected: FAIL because `src/lib/canvasLayout.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal storage and merge helper**

```ts
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

export function mergeCanvasLayoutPositions(nodes: CanvasGraphNode[], positions: CanvasLayoutPositions): CanvasGraphNode[] {
  return nodes.map((node) => {
    const manual = positions[node.id]
    return manual ? { ...node, position: { x: manual.x, y: manual.y } } : node
  })
}
```

- [ ] **Step 4: Re-run the helper tests**

Run: `npm run test -- src/lib/canvasLayout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the helper layer**

```bash
git add src/lib/canvasLayout.ts src/lib/canvasLayout.test.ts
git commit -m "feat: add canvas local layout helpers"
```

### Task 2: Wire CanvasWorkspace to controlled nodes, dragging, and reset-layout controls

**Files:**
- Modify: `src/components/CanvasWorkspace.tsx`
- Verify only if needed: `src/lib/canvasGraph.ts`

- [ ] **Step 1: Lock the intended canvas interaction boundary in a focused helper assertion if the API surface moves**

Add or keep a tiny assertion in `src/lib/canvasLayout.test.ts` that `mergeCanvasLayoutPositions()` does not mutate the input nodes array and only changes matching `position` fields.

```ts
it('returns new node objects only for nodes with manual overrides', () => {
  const original = [taskNode('task-a', 0, 0), taskNode('task-b', 852, 0)]
  const merged = mergeCanvasLayoutPositions(original, { 'task-b': { x: 900, y: 40 } })

  expect(merged[0]).toBe(original[0])
  expect(merged[1]).not.toBe(original[1])
  expect(merged[1].position).toEqual({ x: 900, y: 40 })
})
```

- [ ] **Step 2: Run the helper file again and make sure the new assertion fails first if needed**

Run: `npm run test -- src/lib/canvasLayout.test.ts`
Expected: FAIL only if the merge helper currently mutates or recreates the wrong nodes; otherwise keep the test and proceed.

- [ ] **Step 3: Convert CanvasWorkspace to a controlled draggable graph**

```tsx
import { useEffect, useMemo, useState } from 'react'
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useViewport,
  type Edge,
  type Node,
  type NodeChange,
  type OnNodeDrag,
  type OnNodesChange,
} from '@xyflow/react'
import {
  clearCanvasLayoutPositions,
  mergeCanvasLayoutPositions,
  readCanvasLayoutPositions,
  writeCanvasLayoutPositions,
  type CanvasLayoutPositions,
} from '../lib/canvasLayout'

function getCanvasLayoutStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function CanvasViewportToolbar({
  nodeCount,
  edgeCount,
  hasGraph,
  hasManualLayout,
  onResetLayout,
}: {
  nodeCount: number
  edgeCount: number
  hasGraph: boolean
  hasManualLayout: boolean
  onResetLayout: () => void
}) {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow<CanvasNodeType, Edge>()
  const { zoom } = useViewport()

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-[#0c0f15]/92 px-2 py-2 text-slate-200 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <button type="button" onClick={() => void zoomOut({ duration: 180 })} aria-label="缩小">…</button>
      <button type="button" onClick={() => void zoomIn({ duration: 180 })} aria-label="放大">…</button>
      <button type="button" onClick={() => void fitView({ padding: 0.18, duration: 240 })} disabled={!hasGraph}>
        Fit view
      </button>
      <button type="button" onClick={onResetLayout} disabled={!hasManualLayout}>
        Reset layout
      </button>
      <button type="button" onClick={() => void setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 240 })}>
        {Math.round(zoom * 100)}%
      </button>
      <div className="ml-1 hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400 sm:flex">
        <span>{nodeCount} 节点</span>
        <span className="text-slate-600">/</span>
        <span>{edgeCount} 边</span>
      </div>
    </div>
  )
}

function CanvasWorkspaceSurface() {
  const graph = useMemo(() => buildCanvasGraph(tasks, filters), [tasks, filters])
  const [layoutPositions, setLayoutPositions] = useState<CanvasLayoutPositions>(() => readCanvasLayoutPositions(getCanvasLayoutStorage()))
  const mergedNodes = useMemo(
    () =>
      mergeCanvasLayoutPositions(graph.nodes, layoutPositions).map((node) => ({
        ...node,
        draggable: true,
      })),
    [graph.nodes, layoutPositions],
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeType>(mergedNodes)

  useEffect(() => {
    setNodes(mergedNodes)
  }, [mergedNodes, setNodes])

  const handleNodeDragStop: OnNodeDrag<CanvasNodeType> = (_, node) => {
    setLayoutPositions((current) => {
      const next = {
        ...current,
        [node.id]: { x: node.position.x, y: node.position.y },
      }
      writeCanvasLayoutPositions(getCanvasLayoutStorage(), next)
      return next
    })
  }

  const handleResetLayout = () => {
    setLayoutPositions({})
    clearCanvasLayoutPositions(getCanvasLayoutStorage())
    setNodes(graph.nodes.map((node) => ({ ...node, draggable: true })))
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={graph.edges}
      onNodesChange={onNodesChange}
      onNodeDragStop={handleNodeDragStop}
      nodesDraggable={hasGraph}
      nodesConnectable={false}
      elementsSelectable={false}
      …
    >
      <Panel position="top-right" className="m-4">
        <CanvasViewportToolbar
          nodeCount={nodes.length}
          edgeCount={graph.edges.length}
          hasGraph={hasGraph}
          hasManualLayout={Object.keys(layoutPositions).length > 0}
          onResetLayout={handleResetLayout}
        />
      </Panel>
    </ReactFlow>
  )
}
```

- [ ] **Step 4: Update the canvas copy so it matches stage-2 instead of stage-1**

```tsx
// src/components/CanvasWorkspace.tsx, top-left info panel
<p className="mt-1 text-xs leading-5 text-slate-400">
  拖拽节点做本地排布，点击节点打开详情。任务关系仍然来自现有历史、收藏和 Agent 数据。
</p>
<div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">{nodes.length} 节点</span>
  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">{graph.edges.length} 边</span>
  {Object.keys(layoutPositions).length > 0 && (
    <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-sky-200">本地布局已启用</span>
  )}
</div>
```

```tsx
// src/components/HelpModal.tsx
<ul className="list-disc pl-4 space-y-2">
  <li>拖拽任务节点可手工排布，位置只保存在当前浏览器。</li>
  <li>滚轮或触控板双指缩放，空白区拖拽可平移画布。</li>
  <li>`Reset layout` 会清空本地位置覆盖层，回到自动谱系布局。</li>
  <li>点击任务块仍会打开详情；不会改动任务内容、边关系或后端数据。</li>
</ul>
```

- [ ] **Step 5: Run focused tests and the production build**

Run: `npm run test -- src/lib/canvasLayout.test.ts`
Run: `npm run test -- src/lib/canvasGraph.test.ts`
Run: `npm run build`
Expected: all PASS.

- [ ] **Step 6: Commit the CanvasWorkspace interaction layer**

```bash
git add src/components/CanvasWorkspace.tsx src/components/HelpModal.tsx src/lib/canvasLayout.ts src/lib/canvasLayout.test.ts
git commit -m "feat: add canvas local layout persistence"
```

### Task 3: Run full verification and refresh handoff state

**Files:**
- Modify: `.agents/state/process.md`

- [ ] **Step 1: Run the focused canvas-related suite**

Run: `npm run test -- src/lib/canvasLayout.test.ts`
Run: `npm run test -- src/lib/canvasGraph.test.ts`
Run: `npm run test -- src/lib/canvasNodeViewModel.test.ts`
Run: `npm run test -- src/store.test.ts -t "preserves draft state while switching through canvas mode"`
Expected: all PASS.

- [ ] **Step 2: Run the full suite and production build**

Run: `npm run test`
Run: `npm run build`
Expected: both succeed; only the pre-existing Vite chunk-size warning may remain.

- [ ] **Step 3: Refresh the repo-local handoff file with the real stage-2 state**

```text
Current Task:
- Stage-2 Canvas Mode local-layout implementation complete and verified.

Done:
- Added versioned canvas layout storage helper.
- CanvasWorkspace now supports draggable nodes with local browser persistence.
- Reset layout clears only the local override layer and returns to auto-layout.
- Canvas copy/help text now describes local arrangement instead of stage-1 read-only behavior.

Verification:
- PASS: npm run test -- src/lib/canvasLayout.test.ts
- PASS: npm run test -- src/lib/canvasGraph.test.ts
- PASS: npm run test -- src/lib/canvasNodeViewModel.test.ts
- PASS: npm run test -- src/store.test.ts -t "preserves draft state while switching through canvas mode"
- PASS: npm run test
- PASS: npm run build
```

- [ ] **Step 4: Confirm final worktree scope**

Run: `git status --short`
Expected: only intended stage-2 source/doc changes plus the existing unrelated local files (`src/components/icons.tsx`, `src/main.tsx`, `.DS_Store`) and local handoff files.

- [ ] **Step 5: Summarize residual stage boundary**

```text
- Layout persistence is browser-local only.
- No TaskRecord schema changes.
- No backend sync, import/export, edge editing, or task editing from Canvas Mode.
- Auto-layout remains the canonical fallback and reset target.
```
