# Canvas Mode Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a stage-1 `Canvas Mode` that adds a third top-level view for read-only task lineage exploration, with dark infinite-canvas presentation, left prompt rail plus right thumbnail matrix, and working pan/zoom/detail-open behavior.

**Architecture:** Keep `TaskRecord` as the only source of truth, derive graph nodes and edges client-side, and render the result through `@xyflow/react@12.11.1` without introducing backend changes or manual node persistence. The implementation starts from the current worktree prototype, then tightens it through failing tests, API-compatibility fixes, and scoped UI polish until `npm run test` and `npm run build` both pass.

**Tech Stack:** React 19, TypeScript, Zustand, Vite, Vitest, Tailwind/CSS utilities, `@xyflow/react@12.11.1`

---

### Task 1: Stabilize app-mode switching around the new `canvas` view

**Files:**
- Modify: `src/store.test.ts`
- Modify: `src/store.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/HelpModal.tsx`
- Verify only if needed: `src/components/InputBar.tsx`

- [ ] **Step 1: Write a failing store regression test for `gallery -> canvas -> gallery -> agent`**

```ts
it('preserves draft state while switching through canvas mode', () => {
  const responsesProfile = createDefaultOpenAIProfile({
    id: 'openai-responses',
    apiKey: 'openai-key',
    apiMode: 'responses',
  })

  useStore.setState({
    settings: normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [responsesProfile],
      activeProfileId: responsesProfile.id,
    }),
    appMode: 'gallery',
    prompt: 'gallery draft',
    inputImages: [imageB],
    maskDraft: null,
    maskEditorImageId: null,
    galleryInputDraft: null,
    agentConversations: [agentConversation({ id: 'conversation-a' })],
    activeAgentConversationId: 'conversation-a',
    agentInputDrafts: {
      'conversation-a': {
        prompt: 'agent draft',
        inputImages: [imageA],
        maskDraft: null,
        maskEditorImageId: null,
      },
    },
  })

  useStore.getState().setAppMode('canvas')
  expect(useStore.getState().appMode).toBe('canvas')
  expect(useStore.getState().prompt).toBe('gallery draft')

  useStore.getState().setAppMode('gallery')
  expect(useStore.getState().prompt).toBe('gallery draft')

  useStore.getState().setAppMode('agent')
  expect(useStore.getState().appMode).toBe('agent')
  expect(useStore.getState().prompt).toBe('agent draft')
})
```

- [ ] **Step 2: Run the focused store test and record the actual baseline**

Run: `npm run test -- src/store.test.ts -t "preserves draft state while switching through canvas mode"`
Expected: if it FAILs, use that regression as the reason to tighten `setAppMode()`; if it PASSes, keep the test as a lock and only touch `store.ts` if later canvas work reveals a real state bug.

- [ ] **Step 3: Tighten the mode-switch implementation without expanding scope**

```ts
setAppMode: (appMode) => {
  if (appMode === 'gallery') {
    const state = get()
    const agentInputDrafts = saveActiveAgentInputDrafts(state)
    const galleryInputDraft = saveGalleryInputDraft(state)
    set((state) => ({
      appMode,
      agentInputDrafts,
      galleryInputDraft,
      agentMobileHeaderVisible: true,
      selectedTaskIds: [],
      selectedFavoriteCollectionIds: [],
      agentEditingRoundId: null,
      ...(state.appMode === 'agent' ? restoreGalleryInputDraftState(galleryInputDraft) : {}),
    }))
    return
  }

  if (appMode === 'canvas') {
    set((state) => ({
      appMode: 'canvas',
      agentMobileHeaderVisible: true,
      selectedTaskIds: [],
      selectedFavoriteCollectionIds: [],
      ...(state.appMode === 'agent' ? restoreGalleryInputDraftState(saveGalleryInputDraft(state)) : {}),
    }))
    return
  }

  // keep existing Responses-API gate for agent mode
}
```

```tsx
// src/App.tsx
{appMode === 'agent' ? (
  <AgentWorkspace />
) : appMode === 'canvas' ? (
  <main data-home-main data-drag-select-surface className="pb-48">
    <div className="safe-area-x">
      <SearchBar />
      <CanvasWorkspace />
    </div>
  </main>
) : (
  <main data-home-main data-drag-select-surface className="pb-48">
    <div className="safe-area-x max-w-7xl mx-auto">
      <SearchBar />
      {filterFavorite && !activeFavoriteCollectionId ? <FavoriteCollectionsView /> : <TaskGrid />}
    </div>
  </main>
)}
```

```tsx
// src/components/Header.tsx
<button type="button" onClick={() => setAppMode('gallery')}>画廊</button>
<button type="button" onClick={() => setAppMode('canvas')}>Canvas</button>
<button type="button" onClick={() => setAppMode('agent')}>Agent</button>
```

```tsx
// src/components/HelpModal.tsx
<li>在画布上拖拽平移，滚轮或触控板双指缩放。</li>
<li>每个任务块左侧是提示词，右侧是输出缩略图矩阵。</li>
<li>点击任务块可查看详情，现有历史、收藏和 Agent 入口保持不变。</li>
<li>画布当前是只读视图，不支持拖动节点或手动连线。</li>
```

- [ ] **Step 4: Re-run the focused store test**

Run: `npm run test -- src/store.test.ts -t "preserves draft state while switching through canvas mode"`
Expected: PASS.

- [ ] **Step 5: Commit the mode-switch stabilization**

```bash
git add src/store.test.ts src/store.ts src/App.tsx src/components/Header.tsx src/components/HelpModal.tsx
git commit -m "feat: stabilize canvas mode switching"
```

### Task 2: Lock down graph derivation behavior with deterministic tests

**Files:**
- Modify: `src/lib/canvasGraph.test.ts`
- Modify: `src/lib/canvasGraph.ts`

- [ ] **Step 1: Rewrite the lineage test so it matches the intended layered layout**

```ts
it('derives deterministic nodes, depths, lanes, and deduped edges from task lineage', () => {
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
```

- [ ] **Step 2: Run the graph derivation tests and confirm the current test fails first**

Run: `npm run test -- src/lib/canvasGraph.test.ts`
Expected: FAIL on the outdated position assertion before the helper is corrected or the expectations are updated.

- [ ] **Step 3: Tighten `buildCanvasGraph()` only where behavior is ambiguous**

```ts
export function buildCanvasGraph(tasks: TaskRecord[], filters: CanvasGraphTaskFilters): CanvasGraph {
  const sortedTasks = [...tasks]
    .filter((task) => matchesCanvasTaskFilters(task, filters))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))

  // build output-image reverse index
  // derive deduped producer/consumer edges
  // compute deterministic depth from lineage
  // assign lane by createdAt within each depth bucket
  // return React Flow nodes with fixed left-to-right positions
}
```

- [ ] **Step 4: Add one more regression for per-depth vertical stacking**

```ts
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
```

- [ ] **Step 5: Re-run the graph tests**

Run: `npm run test -- src/lib/canvasGraph.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit the graph derivation hardening**

```bash
git add src/lib/canvasGraph.ts src/lib/canvasGraph.test.ts
git commit -m "test: lock canvas graph derivation"
```

### Task 3: Make `CanvasWorkspace` compile and behave correctly with `@xyflow/react@12.11.1`

**Files:**
- Modify: `src/components/CanvasWorkspace.tsx`
- Modify: `src/components/icons.tsx`
- Verify imports only if needed: `src/main.tsx`

- [ ] **Step 1: Add a focused compile-time regression checkpoint**

Run: `npm run build`
Expected: FAIL with the current React Flow integration errors, specifically around `useReactFlow`, `viewport`, `ReactFlow` JSX usage, and `Panel position="center"`.

- [ ] **Step 2: Adjust the React Flow integration to match the installed package API**

```tsx
import {
  Background,
  BackgroundVariant,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Edge,
  type Node,
} from '@xyflow/react'
```

```tsx
type CanvasTaskNode = Node<CanvasGraphNodeData, 'canvasTask'>

function CanvasViewportToolbar(props: { nodeCount: number; edgeCount: number; hasGraph: boolean }) {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow<CanvasTaskNode, Edge>()
  const { zoom } = useViewport()

  return (
    <>
      <button onClick={() => void zoomOut({ duration: 180 })} />
      <button onClick={() => void fitView({ padding: 0.18, duration: 240 })} disabled={!props.hasGraph}>
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={() => void zoomIn({ duration: 180 })} />
      <button onClick={() => void setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 240 })} />
    </>
  )
}
```

```tsx
// Replace the invalid empty-state panel anchor.
<Panel position="bottom-center" className="pointer-events-none mb-6">
  <div className="pointer-events-auto max-w-md rounded-[28px] border border-white/10 bg-[#0c0f15]/90 px-6 py-5 text-center text-slate-300 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
    <div className="text-sm font-semibold text-white">画布里还没有节点</div>
    <p className="mt-2 text-sm leading-6 text-slate-400">
      这里会把现有任务展开成无限画布。若当前搜索或收藏筛选过窄，先放宽筛选再试。
    </p>
  </div>
</Panel>
```

- [ ] **Step 3: Keep the stage-1 viewport behavior intentionally small**

```tsx
<ReactFlow<CanvasTaskNode, Edge>
  nodes={graph.nodes}
  edges={graph.edges}
  nodeTypes={nodeTypes}
  onNodeClick={handleNodeClick}
  fitView
  fitViewOptions={{ padding: 0.18, minZoom: 0.2, maxZoom: 1.2 }}
  nodesDraggable={false}
  nodesConnectable={false}
  elementsSelectable={false}
  panOnDrag
  panOnScroll
  zoomOnScroll
  zoomOnPinch
  preventScrolling={false}
  proOptions={{ hideAttribution: true }}
/>
```

- [ ] **Step 4: Re-run the build after the API alignment**

Run: `npm run build`
Expected: either PASS or fail later on a different file than `CanvasWorkspace.tsx`. If it fails again here, stop and fix only the remaining React Flow API mismatch before moving on.

- [ ] **Step 5: Commit the workspace API-compatibility fix**

```bash
git add src/components/CanvasWorkspace.tsx src/components/icons.tsx
git commit -m "fix: align canvas workspace with react flow api"
```

### Task 4: Finish the `CanvasNode` layout and keep it testable through pure helpers

**Files:**
- Modify: `src/components/CanvasNode.tsx`
- Create: `src/lib/canvasNodeViewModel.ts`
- Create: `src/lib/canvasNodeViewModel.test.ts`
- Verify existing helper imports: `src/lib/size.ts`

- [ ] **Step 1: Extract a pure view-model helper for node layout decisions**

```ts
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
```

- [ ] **Step 2: Write failing tests for the prompt-left / output-right data contract**

```ts
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
```

- [ ] **Step 3: Run the new helper test and verify it fails first**

Run: `npm run test -- src/lib/canvasNodeViewModel.test.ts`
Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 4: Refactor `CanvasNode` to consume the helper and expose stable data hooks**

```tsx
const viewModel = useMemo(() => buildCanvasNodeViewModel(task), [task])

<div data-canvas-task-node>
  <div data-canvas-prompt-rail className="border-b border-white/8 p-4 sm:border-b-0 sm:border-r sm:border-white/8">
    <p className="mt-3 line-clamp-5 text-[15px] leading-6 text-slate-100">{viewModel.promptText}</p>
  </div>
  <div data-canvas-thumbnail-matrix className="p-4">
    {viewModel.visibleOutputIds.map((imageId) => (
      <div key={imageId} className="group/thumb relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0f1118]" />
    ))}
  </div>
</div>
```

```tsx
// Keep the asymmetric split card:
// left rail = prompt + inputs + metadata
// right rail = output matrix + overflow state
// compact mode = same content model, one-column collapse below zoom threshold
```

- [ ] **Step 5: Re-run the helper test and the build**

Run: `npm run test -- src/lib/canvasNodeViewModel.test.ts`
Run: `npm run build`
Expected: helper test PASS, build still green.

- [ ] **Step 6: Commit the node layout finalization**

```bash
git add src/components/CanvasNode.tsx src/lib/canvasNodeViewModel.ts src/lib/canvasNodeViewModel.test.ts
git commit -m "feat: finalize canvas node layout"
```

### Task 5: Polish canvas-specific styling and empty-state behavior without changing stage scope

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/CanvasWorkspace.tsx`

- [ ] **Step 1: Inspect the current canvas styling against the spec and list only stage-1 gaps**

Run: `npm run build`
Expected: PASS before visual polish starts, so later regressions are attributable to this task.

- [ ] **Step 2: Tighten the dark editorial shell and keep the signature move obvious**

```css
.canvas-shell {
  background:
    radial-gradient(circle at 10% 0%, rgba(56, 189, 248, 0.16), transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(99, 102, 241, 0.12), transparent 30%),
    linear-gradient(180deg, rgba(4, 6, 12, 0.98), rgba(7, 9, 14, 0.96));
}

.canvas-shell-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
  background-size: 64px 64px;
}
```

```tsx
// Keep the empty state and the top-left info panel inside the canvas shell.
// Do not add minimap, editable controls, drag hints, or stage-2 affordances.
```

- [ ] **Step 3: Re-run the build after style polish**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit the stage-1 polish**

```bash
git add src/index.css src/components/CanvasWorkspace.tsx
git commit -m "style: polish canvas stage one shell"
```

### Task 6: Run full verification and refresh handoff state

**Files:**
- Modify: `.agents/state/tasks/cherry-AI/process.md`

- [ ] **Step 1: Run the focused canvas-related test set**

Run: `npm run test -- src/store.test.ts -t "preserves draft state while switching through canvas mode"`
Run: `npm run test -- src/lib/canvasGraph.test.ts`
Run: `npm run test -- src/lib/canvasNodeViewModel.test.ts`
Expected: all PASS.

- [ ] **Step 2: Run the whole automated suite and production build**

Run: `npm run test`
Run: `npm run build`
Expected: both succeed with no remaining Canvas-related failures.

- [ ] **Step 3: Refresh the task handoff file with actual end-state evidence**

```text
Current Task:
- Stage-1 Canvas Mode implementation complete and verified.

Done:
- Third top-level mode wired.
- Graph derivation fixed and covered.
- React Flow integration aligned with 12.11.1.
- Left prompt rail / right output matrix node layout shipped.

Verification:
- PASS: npm run test -- src/store.test.ts -t "preserves draft state while switching through canvas mode"
- PASS: npm run test -- src/lib/canvasGraph.test.ts
- PASS: npm run test -- src/lib/canvasNodeViewModel.test.ts
- PASS: npm run test
- PASS: npm run build
```

- [ ] **Step 4: Confirm the final worktree state**

Run: `git status --short`
Expected: only intended source/doc changes plus local task-state files under `.agents/state/`.

- [ ] **Step 5: Summarize residual scope boundaries**

```text
- Stage 1 remains read-only.
- No manual node dragging or persistence.
- No backend or schema changes.
- `basketikun/infinite-canvas` stayed reference-only; implementation base is React Flow.
```
