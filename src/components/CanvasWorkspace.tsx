import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
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
  type OnNodeDrag,
} from '@xyflow/react'
import { useStore, editOutputs, removeTask, reuseConfig, retryTask } from '../store'
import { buildCanvasGraph, type CanvasGraphNodeData } from '../lib/canvasGraph'
import {
  clearCanvasLayoutPositions,
  mergeCanvasLayoutPositions,
  readCanvasLayoutPositions,
  setCanvasLayoutPosition,
  writeCanvasLayoutPositions,
  type CanvasLayoutPositions,
} from '../lib/canvasLayout'
import { useDragSelect } from '../hooks/useDragSelect'
import CanvasNode from './CanvasNode'
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, FavoriteIcon, RefreshIcon, TrashIcon } from './icons'

type CanvasNodeType = Node<CanvasGraphNodeData, 'canvasTask'>
const DEFAULT_CANVAS_VIEWPORT = { x: 0, y: 0, zoom: 0.1 }

function getCanvasLayoutStorage() {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
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
  const { zoomIn, zoomOut, fitView } = useReactFlow<CanvasNodeType, Edge>()
  const { zoom } = useViewport()

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-[#0c0f15]/92 px-2 py-2 text-slate-200 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <button
        type="button"
        onClick={() => void zoomOut({ duration: 180 })}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-slate-200 transition hover:border-white/15 hover:bg-white/[0.07]"
        aria-label="缩小"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      <div className="inline-flex h-9 min-w-16 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">
        {Math.round(zoom * 100)}%
      </div>
      <button
        type="button"
        onClick={() => void zoomIn({ duration: 180 })}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-slate-200 transition hover:border-white/15 hover:bg-white/[0.07]"
        aria-label="放大"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => void fitView({ padding: 0.18, duration: 240 })}
        className="inline-flex h-9 min-w-16 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] px-3 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300 transition hover:border-white/15 hover:bg-white/[0.07]"
        aria-label="适配画布"
        disabled={!hasGraph}
      >
        Fit view
      </button>
      <button
        type="button"
        onClick={onResetLayout}
        className="inline-flex h-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300 transition hover:border-white/15 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45"
        aria-label="重置布局"
        disabled={!hasGraph || !hasManualLayout}
      >
        <RefreshIcon className="mr-1.5 h-4 w-4" />
        Reset layout
      </button>
      <div className="ml-1 hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400 sm:flex">
        <span>{nodeCount} 节点</span>
        <span className="text-slate-600">/</span>
        <span>{edgeCount} 边</span>
      </div>
    </div>
  )
}

function CanvasQuickActionButton({
  label,
  icon,
  onClick,
  disabled = false,
  tone = 'default',
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
        tone === 'danger'
          ? 'border-red-400/20 bg-red-500/10 text-red-100 hover:border-red-400/35 hover:bg-red-500/16 disabled:opacity-40'
          : 'border-white/10 bg-white/[0.05] text-slate-100 hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-40'
      } disabled:cursor-not-allowed`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function CanvasSelectionQuickActions({
  task,
  selectedCount,
  onOpenDetail,
}: {
  task: CanvasGraphNodeData['task']
  selectedCount: number
  onOpenDetail: () => void
}) {
  const openFavoritePicker = useStore((s) => s.openFavoritePicker)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const clearSelection = useStore((s) => s.clearSelection)

  const handleDelete = useCallback(() => {
    setConfirmDialog({
      title: '删除任务',
      message: '确定要删除这个任务吗？关联的图片资源也会被清理（如果没有其他任务引用）。',
      action: () => {
        void removeTask(task)
      },
    })
  }, [setConfirmDialog, task])

  return (
    <div className="pointer-events-auto w-full max-w-[44rem] rounded-[26px] border border-white/10 bg-[#0c0f15]/94 px-4 py-4 text-slate-100 shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Selection Actions</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="line-clamp-1 text-sm font-semibold text-white">
              {task.prompt.trim() || '未命名任务'}
            </div>
            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
              已选 {selectedCount} 个
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          清空选择
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CanvasQuickActionButton
          label="查看详情"
          icon={<span className="text-base leading-none">↗</span>}
          onClick={onOpenDetail}
        />
        <CanvasQuickActionButton
          label="复用配置"
          icon={<RefreshIcon className="h-4 w-4" />}
          onClick={() => {
            void reuseConfig(task)
          }}
        />
        <CanvasQuickActionButton
          label="编辑输出"
          icon={<EditIcon className="h-4 w-4" />}
          onClick={() => {
            void editOutputs(task)
          }}
          disabled={!task.outputImages?.length}
        />
        <CanvasQuickActionButton
          label="重试任务"
          icon={<RefreshIcon className="h-4 w-4" />}
          onClick={() => {
            void retryTask(task)
          }}
          disabled={task.status !== 'error'}
        />
        <CanvasQuickActionButton
          label={task.isFavorite ? '编辑收藏夹' : '收藏任务'}
          icon={<FavoriteIcon className="h-4 w-4" filled={task.isFavorite} />}
          onClick={() => openFavoritePicker([task.id])}
        />
        <CanvasQuickActionButton
          label="删除任务"
          icon={<TrashIcon className="h-4 w-4" />}
          onClick={handleDelete}
          tone="danger"
        />
      </div>
    </div>
  )
}

function CanvasWorkspaceSurface() {
  const tasks = useStore((s) => s.tasks)
  const searchQuery = useStore((s) => s.searchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const selectedTaskIds = useStore((s) => s.selectedTaskIds)
  const setSelectedTaskIds = useStore((s) => s.setSelectedTaskIds)
  const clearSelection = useStore((s) => s.clearSelection)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const appMode = useStore((s) => s.appMode)
  const containerRef = useRef<HTMLElement>(null)
  const suppressClickUntilRef = useRef(0)

  const graph = useMemo(() => buildCanvasGraph(tasks, {
    searchQuery,
    filterStatus,
    filterFavorite,
    activeFavoriteCollectionId,
  }), [tasks, searchQuery, filterStatus, filterFavorite, activeFavoriteCollectionId])

  const visibleNodeIds = useMemo(() => graph.nodes.map((node) => node.id), [graph.nodes])
  const visibleNodeIdSet = useMemo(() => new Set(visibleNodeIds), [visibleNodeIds])
  const visibleSelectedTaskIds = useMemo(
    () => selectedTaskIds.filter((id) => visibleNodeIdSet.has(id)),
    [selectedTaskIds, visibleNodeIdSet],
  )

  const nodeTypes = useMemo(() => ({ canvasTask: CanvasNode }), [])
  const [layoutPositions, setLayoutPositions] = useState<CanvasLayoutPositions>(() => readCanvasLayoutPositions(getCanvasLayoutStorage()))
  const baseNodes = useMemo<CanvasNodeType[]>(
    () => graph.nodes.map((node) => ({
      ...node,
      selected: selectedTaskIds.includes(node.id),
      draggable: true,
    })),
    [graph.nodes, selectedTaskIds],
  )
  const mergedNodes = useMemo<CanvasNodeType[]>(
    () => mergeCanvasLayoutPositions(baseNodes, layoutPositions),
    [baseNodes, layoutPositions],
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeType>(mergedNodes)
  const hasGraph = nodes.length > 0
  const hasManualLayout = Object.keys(layoutPositions).length > 0

  useEffect(() => {
    setNodes(mergedNodes)
  }, [mergedNodes, setNodes])

  useEffect(() => {
    if (selectedTaskIds.length === 0) return
    const prunedVisibleIds = selectedTaskIds.filter((id) => visibleNodeIdSet.has(id))
    if (prunedVisibleIds.length === selectedTaskIds.length) return
    setSelectedTaskIds(prunedVisibleIds)
  }, [selectedTaskIds, setSelectedTaskIds, visibleNodeIdSet])

  useEffect(() => {
    if (appMode !== 'canvas') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectedTaskIds.length === 0) return
      event.preventDefault()
      clearSelection()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [appMode, clearSelection, selectedTaskIds.length])

  const handleNodeClick = useCallback((event: React.MouseEvent, node: CanvasNodeType) => {
    if (Date.now() < suppressClickUntilRef.current) {
      event.preventDefault()
      return
    }

    const target = event.target as HTMLElement | null
    if (target?.closest('button, input, label, a')) return

    const isMultiSelect = event.metaKey || event.ctrlKey
    if (isMultiSelect) {
      setSelectedTaskIds((current) => (
        current.includes(node.id)
          ? current.filter((id) => id !== node.id)
          : [...current, node.id]
      ))
      return
    }

    setDetailTaskId(node.id)
  }, [setDetailTaskId, setSelectedTaskIds])

  const handleNodeDragStop: OnNodeDrag<CanvasNodeType> = useCallback((_, node) => {
    setLayoutPositions((current) => {
      const next = setCanvasLayoutPosition(current, node.id, node.position)
      if (next === current) return current

      if (!writeCanvasLayoutPositions(getCanvasLayoutStorage(), next)) {
        setNodes(mergedNodes)
        return current
      }

      return next
    })
  }, [mergedNodes, setNodes])

  const handleResetLayout = useCallback(() => {
    setLayoutPositions((current) => {
      if (Object.keys(current).length === 0) return current
      clearCanvasLayoutPositions(getCanvasLayoutStorage())
      return {}
    })
  }, [])

  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if (event.defaultPrevented) return
    if (selectedTaskIds.length === 0) return
    clearSelection()
  }, [clearSelection, selectedTaskIds.length])

  const shouldStartCanvasSelection = useCallback((event: MouseEvent, target: Element) => {
    if (!event.shiftKey) return false
    if (target.closest('.react-flow__node, button, input, label, a, textarea, select')) return false
    return Boolean(target.closest('.react-flow__pane'))
  }, [])

  const handleCanvasSelectionChange = useCallback((ids: string[]) => {
    setSelectedTaskIds((current) => {
      const preserved = current.filter((id) => !visibleNodeIdSet.has(id))
      return [...preserved, ...ids]
    })
  }, [setSelectedTaskIds, visibleNodeIdSet])

  const { selectionBox } = useDragSelect({
    containerSelector: '[data-canvas-select-surface]',
    itemSelector: '.react-flow__node[data-id]',
    getItemId: (element) => element.getAttribute('data-id'),
    onSelectionChange: handleCanvasSelectionChange,
    initialSelectedIds: visibleSelectedTaskIds,
    onSuppressClick: () => {
      suppressClickUntilRef.current = Date.now() + 250
    },
    shouldStartSelection: shouldStartCanvasSelection,
  })

  const singleSelectedTask = useMemo(() => {
    if (visibleSelectedTaskIds.length !== 1) return null
    const selectedId = visibleSelectedTaskIds[0]
    return graph.nodes.find((node) => node.id === selectedId)?.data.task ?? null
  }, [graph.nodes, visibleSelectedTaskIds])

  return (
    <section
      ref={containerRef}
      data-canvas-select-surface
      className="canvas-shell relative mt-4 min-h-[calc(100vh-220px)] overflow-hidden rounded-[30px] border border-white/10 text-white shadow-[0_28px_110px_rgba(0,0,0,0.48)]"
    >
      <div className="pointer-events-none absolute inset-0 canvas-shell-backdrop" />
      <div className="pointer-events-none absolute inset-0 canvas-shell-grid opacity-55" />

      <div className="relative h-[calc(100vh-220px)] min-h-[36rem]">
        <ReactFlow
          nodes={nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          defaultViewport={DEFAULT_CANVAS_VIEWPORT}
          minZoom={0.1}
          nodesDraggable={hasGraph}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: {
              stroke: 'rgba(96, 165, 250, 0.28)',
              strokeWidth: 1.6,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'rgba(96, 165, 250, 0.35)',
            },
          }}
          className="canvas-flow h-full w-full bg-transparent"
        >
          <Background
            id="canvas-bg"
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1}
            color="rgba(148, 163, 184, 0.16)"
          />
          <Panel position="top-right" className="m-4">
            <CanvasViewportToolbar
              nodeCount={nodes.length}
              edgeCount={graph.edges.length}
              hasGraph={hasGraph}
              hasManualLayout={hasManualLayout}
              onResetLayout={handleResetLayout}
            />
          </Panel>
          <Panel position="top-left" className="m-4 max-w-[20rem]">
            <div className="pointer-events-auto rounded-[22px] border border-white/10 bg-[#0c0f15]/80 px-4 py-3 text-slate-200 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Canvas Mode</div>
              <div className="mt-1 text-sm font-semibold text-white">TaskRecord lineage board</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                拖拽节点做本地排布，点击节点打开详情。按住 Shift 在空白处框选，或用节点左上角选择任务。
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">{nodes.length} 节点</span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">{graph.edges.length} 边</span>
                {hasManualLayout && <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-sky-200">本地布局已启用</span>}
                {visibleSelectedTaskIds.length > 0 && (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                    已选 {visibleSelectedTaskIds.length}
                  </span>
                )}
                {searchQuery.trim() && <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">搜索中</span>}
                {filterFavorite && <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">收藏过滤</span>}
              </div>
            </div>
          </Panel>

          {singleSelectedTask && (
            <Panel position="bottom-left" className="m-4 mr-0 max-w-[calc(100%-2rem)]">
              <CanvasSelectionQuickActions
                task={singleSelectedTask}
                selectedCount={visibleSelectedTaskIds.length}
                onOpenDetail={() => setDetailTaskId(singleSelectedTask.id)}
              />
            </Panel>
          )}

          {!hasGraph && (
            <Panel position="bottom-center" className="pointer-events-none mb-6">
              <div className="pointer-events-auto max-w-md rounded-[28px] border border-white/10 bg-[#0c0f15]/90 px-6 py-5 text-center text-slate-300 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="text-sm font-semibold text-white">画布里还没有节点</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  这里会把现有任务展开成无限画布。若当前搜索或收藏筛选过窄，先放宽筛选再试。
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>

        {selectionBox && (
          <div
            className="pointer-events-none fixed z-[35] rounded-[18px] border border-sky-400/70 bg-sky-500/14 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
            style={{
              left: Math.min(selectionBox.startPageX, selectionBox.currentPageX) - window.scrollX,
              top: Math.min(selectionBox.startPageY, selectionBox.currentPageY) - window.scrollY,
              width: Math.abs(selectionBox.currentPageX - selectionBox.startPageX),
              height: Math.abs(selectionBox.currentPageY - selectionBox.startPageY),
            }}
          />
        )}
      </div>
    </section>
  )
}

export default function CanvasWorkspace() {
  return (
    <ReactFlowProvider>
      <CanvasWorkspaceSurface />
    </ReactFlowProvider>
  )
}
