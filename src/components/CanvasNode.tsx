import { memo, useEffect, useMemo, useState } from 'react'
import { Handle, Position, useViewport, type Node, type NodeProps } from '@xyflow/react'
import type { CanvasGraphNodeData } from '../lib/canvasGraph'
import { buildCanvasNodeViewModel } from '../lib/canvasNodeViewModel'
import { formatImageRatio } from '../lib/size'
import { ensureImageThumbnailCached, subscribeImageThumbnail, useStore } from '../store'
import { Checkbox } from './Checkbox'
import { CodeIcon, TransparentBgIcon } from './icons'

type Thumbnail = {
  dataUrl: string
  width?: number
  height?: number
}

function useThumbnailMap(ids: string[]) {
  const [thumbnailMap, setThumbnailMap] = useState<Record<string, Thumbnail>>({})

  useEffect(() => {
    let cancelled = false
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (uniqueIds.length === 0) {
      setThumbnailMap({})
      return
    }

    const unsubs: Array<() => void> = []
    setThumbnailMap({})

    for (const id of uniqueIds) {
      ensureImageThumbnailCached(id)
        .then((thumbnail) => {
          if (!cancelled && thumbnail) {
            setThumbnailMap((prev) => ({ ...prev, [id]: thumbnail }))
          }
        })
        .catch(() => {})

      unsubs.push(subscribeImageThumbnail(id, (thumbnail) => {
        if (cancelled) return
        setThumbnailMap((prev) => ({ ...prev, [id]: thumbnail }))
      }))
    }

    return () => {
      cancelled = true
      for (const unsubscribe of unsubs) unsubscribe()
    }
  }, [ids.join('|')])

  return thumbnailMap
}

function formatElapsedLabel(task: CanvasGraphNodeData['task']) {
  if (task.status === 'running' && task.createdAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - task.createdAt) / 1000))
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }
  if (task.elapsed != null) {
    const seconds = Math.max(0, Math.floor(task.elapsed / 1000))
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }
  return '--:--'
}

type CanvasTaskNode = Node<CanvasGraphNodeData, 'canvasTask'>

function CanvasNode({ data, selected }: NodeProps<CanvasTaskNode>) {
  const { zoom } = useViewport()
  const isCompact = zoom < 0.62
  const task = data.task as CanvasGraphNodeData['task']
  const toggleTaskSelection = useStore((s) => s.toggleTaskSelection)
  const viewModel = useMemo(() => buildCanvasNodeViewModel(task), [task])
  const inputThumbnails = useThumbnailMap(task.inputImageIds ?? [])
  const outputThumbnails = useThumbnailMap(task.outputImages ?? [])
  const duration = useMemo(() => formatElapsedLabel(task), [task, task.status, task.createdAt, task.elapsed])

  return (
    <div
      data-canvas-task-node
      data-task-id={task.id}
      className={`canvas-task-node group relative overflow-hidden rounded-[28px] border shadow-[0_26px_90px_rgba(0,0,0,0.45)] transition-all duration-200 ${
        selected
          ? 'border-sky-400/60 ring-1 ring-sky-400/50 shadow-[0_32px_120px_rgba(14,165,233,0.18)]'
          : 'border-white/10 hover:border-white/18'
      }`}
      style={{
        width: '720px',
        maxWidth: 'calc(100vw - 3rem)',
        background: 'linear-gradient(180deg, rgba(17,20,28,0.96) 0%, rgba(9,11,16,0.98) 100%)',
      }}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-0 !bg-sky-400/70" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-0 !bg-sky-400/70" />

      <div className="canvas-task-drag-handle border-b border-white/8 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="pt-0.5">
              <div
                className="nodrag nopan rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1.5 transition hover:border-white/15 hover:bg-white/[0.06]"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Checkbox
                  checked={selected}
                  onChange={(checked) => toggleTaskSelection(task.id, checked)}
                  aria-label={selected ? '取消选择任务' : '选择任务'}
                />
              </div>
            </div>
            <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">
              <span>{viewModel.statusLabel}</span>
              <span className="text-slate-600">/</span>
              <span>{viewModel.providerLabel}</span>
              <span className="text-slate-600">/</span>
              <span>{duration}</span>
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-sky-400 via-cyan-300 to-indigo-500" />
              <div className="min-w-0">
                <h3 className="line-clamp-1 text-[15px] font-semibold tracking-tight text-white">
                  {task.sourceMode === 'agent' ? 'Agent 任务' : '生成任务'}
                </h3>
                <p className="line-clamp-1 text-xs text-slate-400">{viewModel.requestedModel}</p>
              </div>
            </div>
          </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {task.maskImageId && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                局部重绘
              </span>
            )}
            {viewModel.hasTransparentOutput && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                <TransparentBgIcon className="h-3.5 w-3.5" />
                透明背景
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`grid gap-0 ${isCompact ? 'grid-cols-1' : 'grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]'}`}>
        <div data-canvas-prompt-rail className="border-b border-white/8 p-4 sm:border-b-0 sm:border-r sm:border-white/8">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Prompt Rail</div>
            <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
              {viewModel.hasInputs ? `${task.inputImageIds.length} 张输入` : '无输入'}
            </div>
          </div>

          <p className="mt-3 line-clamp-5 text-[15px] leading-6 text-slate-100">{viewModel.promptText}</p>

          <div className="mt-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">输入图</div>
            <div className="flex flex-wrap gap-2">
              {viewModel.visibleInputIds.length > 0 ? viewModel.visibleInputIds.map((imageId) => {
                const thumb = inputThumbnails[imageId]
                return (
                  <div
                    key={imageId}
                    className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
                    title={imageId}
                  >
                    {thumb ? (
                      <img src={thumb.dataUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-[10px] text-slate-500">…</span>
                    )}
                  </div>
                )
              }) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">
                  没有可追溯的输入图
                </div>
              )}
              {viewModel.hiddenInputCount > 0 && (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-slate-300">
                  +{viewModel.hiddenInputCount}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">来源</div>
              <div className="mt-1 truncate text-slate-200">{task.sourceMode || 'gallery'}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">输出数</div>
              <div className="mt-1 truncate text-slate-200">{viewModel.outputCount}</div>
            </div>
          </div>
        </div>

        <div data-canvas-thumbnail-matrix className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Output Matrix</div>
            <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
              {viewModel.outputCount > 0 ? `${viewModel.outputCount} 张输出` : '暂无输出'}
            </div>
          </div>

          {viewModel.outputCount > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {viewModel.visibleOutputIds.map((imageId, index) => {
                const thumb = outputThumbnails[imageId]
                return (
                  <div
                    key={imageId}
                    className="group/thumb relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0f1118] shadow-[0_14px_30px_rgba(0,0,0,0.3)]"
                  >
                    <div className="absolute left-2 top-2 z-10 rounded-full border border-black/20 bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      {index + 1}
                    </div>
                    {thumb ? (
                      <img
                        src={thumb.dataUrl}
                        alt=""
                        className="aspect-square w-full object-cover transition-transform duration-300 group-hover/thumb:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),rgba(9,11,16,0.95))] text-xs text-slate-500">
                        加载中
                      </div>
                    )}
                    {thumb?.width && thumb?.height && (
                      <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
                        {formatImageRatio(thumb.width, thumb.height)}
                      </div>
                    )}
                  </div>
                )
              })}
              {viewModel.hiddenOutputCount > 0 && (
                <div className="flex aspect-square items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-300">
                  +{viewModel.hiddenOutputCount}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 text-center text-sm text-slate-500">
              {task.status === 'running'
                ? '生成中的任务节点会在这里显示输出占位。'
                : '这个任务当前还没有输出图。'}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              <CodeIcon className="h-3.5 w-3.5 text-slate-500" />
              {viewModel.providerLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              {viewModel.statusLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              深度 {data.depth}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              层 {data.lane + 1}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(CanvasNode)
