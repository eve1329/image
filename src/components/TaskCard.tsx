import { useEffect, useState, useRef, type ReactNode } from 'react'
import type { TaskRecord } from '../types'
import { useStore, ensureImageThumbnailCached, subscribeImageThumbnail, retryTask } from '../store'
import { formatImageRatio } from '../lib/size'
import { getParamDisplay, ActualValueBadge } from '../lib/paramDisplay'
import { DEFAULT_IMAGES_MODEL, DEFAULT_FAL_MODEL } from '../lib/apiProfiles'
import { isAgentTaskPromptPending } from '../lib/taskPromptDisplay'
import { CodeIcon, TransparentBgIcon } from './icons'
import ViewportTooltip from './ViewportTooltip'

interface Props {
  task: TaskRecord
  onReuse: () => void
  onEditOutputs: () => void
  onDelete: () => void
  onClick: (e: React.MouseEvent | React.TouchEvent) => void
  isSelected?: boolean
  disableSwipe?: boolean
}

function TaskActionButton({
  tooltip,
  className,
  disabled = false,
  onClick,
  children,
}: {
  tooltip: string
  className: string
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className={className}
        disabled={disabled}
        aria-label={tooltip}
      >
        {children}
      </button>
      <ViewportTooltip visible={tooltipVisible} className="whitespace-nowrap">
        {tooltip}
      </ViewportTooltip>
    </span>
  )
}

export default function TaskCard({
  task,
  onReuse,
  onEditOutputs,
  onDelete,
  onClick,
  isSelected,
  disableSwipe,
}: Props) {
  const [thumbSrc, setThumbSrc] = useState<string>('')
  const [coverRatio, setCoverRatio] = useState<string>('')
  const [coverSize, setCoverSize] = useState<string>('')
  const [now, setNow] = useState(Date.now())
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeStartedSelected, setSwipeStartedSelected] = useState(false)
  const [swipeActionActive, setSwipeActionActive] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<-1 | 0 | 1>(0)
  const [streamPreviewLoaded, setStreamPreviewLoaded] = useState(false)
  const toggleTaskSelection = useStore((s) => s.toggleTaskSelection)
  const settings = useStore((s) => s.settings)
  const openFavoritePicker = useStore((s) => s.openFavoritePicker)
  const streamPreviewSrc = useStore((s) => s.streamPreviews[task.id] || '')
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipeResetTimerRef = useRef<number | null>(null)
  const suppressClickUntilRef = useRef(0)
  const horizontalSwipeRef = useRef(false)
  const swipeDirectionRef = useRef<-1 | 0 | 1>(0)
  const swipeActionActiveRef = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const swipeOffsetRef = useRef(0)
  const pendingSwipeOffsetRef = useRef(0)
  const swipeFrameRef = useRef<number | null>(null)

  const updateSwipeDirection = (nextDirection: -1 | 0 | 1) => {
    if (swipeDirectionRef.current === nextDirection) return
    swipeDirectionRef.current = nextDirection
    setSwipeDirection(nextDirection)
  }

  const updateSwipeActionActive = (nextActive: boolean) => {
    if (swipeActionActiveRef.current === nextActive) return
    swipeActionActiveRef.current = nextActive
    setSwipeActionActive(nextActive)
  }

  const applySwipeOffset = (offset: number) => {
    swipeOffsetRef.current = offset
    if (cardRef.current) {
      cardRef.current.style.transform = offset ? `translateX(${offset}px)` : ''
    }
  }

  const cancelSwipeFrame = () => {
    if (swipeFrameRef.current != null) {
      window.cancelAnimationFrame(swipeFrameRef.current)
      swipeFrameRef.current = null
    }
  }

  const scheduleSwipeOffset = (offset: number) => {
    if (swipeFrameRef.current == null && swipeOffsetRef.current === offset) return
    pendingSwipeOffsetRef.current = offset
    if (swipeFrameRef.current != null) return
    swipeFrameRef.current = window.requestAnimationFrame(() => {
      swipeFrameRef.current = null
      applySwipeOffset(pendingSwipeOffsetRef.current)
    })
  }

  const isTagScrollTarget = (target: EventTarget | null) => {
    return target instanceof Element && Boolean(target.closest('[data-tag-scroll-area]'))
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disableSwipe || isTagScrollTarget(e.target)) {
      touchStartRef.current = null
      horizontalSwipeRef.current = false
      setIsSwiping(false)
      cancelSwipeFrame()
      applySwipeOffset(0)
      updateSwipeDirection(0)
      updateSwipeActionActive(false)
      return
    }

    if (swipeResetTimerRef.current != null) {
      window.clearTimeout(swipeResetTimerRef.current)
      swipeResetTimerRef.current = null
    }
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    horizontalSwipeRef.current = false
    setSwipeStartedSelected(Boolean(isSelected))
    updateSwipeActionActive(false)
    updateSwipeDirection(0)
    cancelSwipeFrame()
    applySwipeOffset(0)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isTagScrollTarget(e.target)) return
    if (!touchStartRef.current) return
    const deltaX = e.touches[0].clientX - touchStartRef.current.x
    const deltaY = e.touches[0].clientY - touchStartRef.current.y
    
    // 如果主要是水平滑动
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      horizontalSwipeRef.current = true
      e.preventDefault()
      // 限制滑动距离，例如最大 60px
      const boundedOffset = Math.max(-60, Math.min(60, deltaX))
      const nextDirection = boundedOffset > 0 ? 1 : boundedOffset < 0 ? -1 : 0
      const nextActionActive = Math.abs(deltaX) >= 40
      scheduleSwipeOffset(boundedOffset)
      updateSwipeDirection(nextDirection)
      updateSwipeActionActive(nextActionActive)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isTagScrollTarget(e.target)) {
      touchStartRef.current = null
      horizontalSwipeRef.current = false
      setIsSwiping(false)
      cancelSwipeFrame()
      updateSwipeDirection(0)
      updateSwipeActionActive(false)
      return
    }

    setIsSwiping(false)
    cancelSwipeFrame()
    updateSwipeDirection(0)
    
    if (!touchStartRef.current) return
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    touchStartRef.current = null
    const isSwipeAction = horizontalSwipeRef.current && Math.abs(deltaX) > 40
    horizontalSwipeRef.current = false
    updateSwipeActionActive(isSwipeAction)
    swipeResetTimerRef.current = window.setTimeout(() => {
      updateSwipeActionActive(false)
      swipeResetTimerRef.current = null
    }, 220)

    // 如果是水平滑动，且垂直偏移较小，认为是滑动选择
    if (isSwipeAction) {
      suppressClickUntilRef.current = Date.now() + 350
      e.preventDefault()
      e.stopPropagation()
      toggleTaskSelection(task.id)
    }
  }

  const handleTouchCancel = () => {
    touchStartRef.current = null
    horizontalSwipeRef.current = false
    setIsSwiping(false)
    cancelSwipeFrame()
    updateSwipeDirection(0)
    updateSwipeActionActive(false)
  }

  useEffect(() => () => {
    if (swipeResetTimerRef.current != null) {
      window.clearTimeout(swipeResetTimerRef.current)
    }
    cancelSwipeFrame()
  }, [])

  useEffect(() => {
    if (!isSwiping) {
      applySwipeOffset(0)
    }
  }, [isSwiping])

  useEffect(() => {
    setStreamPreviewLoaded(false)
  }, [streamPreviewSrc, task.id])

  // 定时更新运行中任务的计时
  useEffect(() => {
    if (task.status !== 'running' && !(task.status === 'error' && (task.falRecoverable || task.customRecoverable))) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    setNow(Date.now())
    return () => clearInterval(id)
  }, [task.customRecoverable, task.falRecoverable, task.status])

  // 加载缩略图
  useEffect(() => {
    setCoverRatio('')
    setCoverSize('')
    setThumbSrc('')

    let cancelled = false
    const imageId = task.outputImages?.[0]
    let unsubscribe: (() => void) | undefined

    const applyThumbnail = (thumbnail: { dataUrl: string; width?: number; height?: number }) => {
      if (cancelled) return
      setThumbSrc(thumbnail.dataUrl)
      if (thumbnail.width && thumbnail.height) {
        setCoverRatio(formatImageRatio(thumbnail.width, thumbnail.height))
        setCoverSize(`${thumbnail.width}×${thumbnail.height}`)
      }
    }

    if (imageId) {
      unsubscribe = subscribeImageThumbnail(imageId, applyThumbnail)
      ensureImageThumbnailCached(imageId).then((thumbnail) => {
        if (cancelled || !thumbnail) return
        applyThumbnail(thumbnail)
      }).catch(() => {
        if (!cancelled) setThumbSrc('')
      })
    }

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [task.outputImages])

  const duration = (() => {
    let seconds: number
    if (task.status === 'running' || task.falRecoverable || task.customRecoverable) {
      seconds = Math.floor((now - task.createdAt) / 1000)
    } else if (task.elapsed != null) {
      seconds = Math.floor(task.elapsed / 1000)
    } else {
      return '00:00'
    }
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })()
  const showSwipeAction = swipeActionActive
  const isFalReconnecting = task.status === 'error' && task.falRecoverable
  const isCustomReconnecting = task.status === 'error' && task.customRecoverable
  const showRunningTimer = task.status === 'running' || isFalReconnecting || isCustomReconnecting
  const qualityDisplay = getParamDisplay(task, 'quality')
  const showQuality = task.params.quality !== 'auto' || qualityDisplay.isMismatch

  const sizeDisplay = getParamDisplay(task, 'size')
  const showSize = task.params.size !== 'auto' || sizeDisplay.isMismatch

  const formatDisplay = getParamDisplay(task, 'output_format')
  const showFormat = task.params.output_format !== 'png' || formatDisplay.isMismatch
  const showTransparentOutput = task.transparentOutput || task.params.transparent_output

  const nDisplay = getParamDisplay(task, 'n')
  const isAgentTask = task.sourceMode === 'agent' || Boolean(task.agentConversationId || task.agentRoundId)
  const showPendingPrompt = isAgentTaskPromptPending(task)
  const showN = !isAgentTask && (task.params.n > 1 || nDisplay.isMismatch)
  const outputErrorCount = task.outputErrors?.length ?? 0
  const outputSuccessCount = task.outputImages?.length ?? 0
  const requestedOutputCount = Math.max(task.params.n, outputSuccessCount + outputErrorCount)
  const hasPartialOutputFailure = task.status === 'done' && outputErrorCount > 0

  const defaultModelForProvider = task.apiProvider === 'fal' ? DEFAULT_FAL_MODEL : DEFAULT_IMAGES_MODEL
  const showModel = task.apiModel && task.apiModel !== defaultModelForProvider
  const isInterrupted = task.status === 'error' && task.error === '已停止生成。'
  const swipeAccentClass = showSwipeAction
    ? swipeStartedSelected
      ? 'bg-[hsl(var(--wb-line-strong)/0.78)]'
      : 'bg-[hsl(var(--wb-accent)/0.78)]'
    : 'bg-[hsl(var(--wb-surface-3)/0.9)]'
  const cardFrameClassName = [
    'relative overflow-hidden rounded-[18px] border cursor-pointer touch-pan-y will-change-transform',
    'workbench-panel',
    !isSwiping
      ? 'transition-[box-shadow,border-color,background-color,transform] duration-200'
      : 'transition-[box-shadow,border-color,background-color] duration-200',
    task.status === 'running'
      ? 'border-[hsl(var(--wb-accent)/0.6)] generating'
      : isSelected
      ? 'workbench-panel--strong ring-1 ring-[hsl(var(--wb-accent)/0.24)]'
      : 'hover:border-[hsl(var(--wb-line-strong)/0.86)]',
    isSwiping ? '!bg-[hsl(var(--wb-surface)/0.96)]' : '',
  ].join(' ')

  return (
    <div className="relative rounded-[18px]">
      <div
        className={`absolute inset-0 flex items-center rounded-[18px] transition-opacity duration-200 pointer-events-none ${
          isSwiping || swipeDirection !== 0 || swipeActionActive ? 'opacity-100' : 'opacity-0'
        } ${swipeAccentClass} ${
          swipeDirection > 0 ? 'justify-start pl-6' : 'justify-end pr-6'
        }`}
      >
        <svg className={`h-8 w-8 transition-transform duration-150 ${showSwipeAction ? 'scale-110 text-white' : 'scale-90 text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {swipeStartedSelected && showSwipeAction ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          )}
        </svg>
      </div>

      <div
        ref={cardRef}
        className={cardFrameClassName}
        onClick={(e) => {
          if (Date.now() < suppressClickUntilRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return
          }
          onClick(e)
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        draggable={task.status === 'done' && task.outputImages?.length > 0}
        onDragStart={(e) => {
          if (task.status !== 'done' || !task.outputImages?.length) return
          const imageIds = task.outputImages
          e.dataTransfer.setData('text/plain', `agent-images:${imageIds.join(',')}`)
          e.dataTransfer.effectAllowed = 'copy'
          if (thumbSrc) {
            const preview = document.createElement('div')
            preview.style.cssText = 'position:fixed;left:-1000px;top:-1000px;width:100px;height:100px;border-radius:14px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,0.35);'
            const previewImg = document.createElement('img')
            previewImg.src = thumbSrc
            previewImg.style.cssText = 'width:100px;height:100px;object-fit:cover;display:block;'
            preview.appendChild(previewImg)
            document.body.appendChild(preview)
            e.dataTransfer.setDragImage(preview, 50, 50)
            setTimeout(() => preview.remove(), 0)
          }
        }}
      >
        {isSelected && (
          <div className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--wb-accent)/0.7)] bg-[hsl(var(--wb-accent)/0.92)] shadow-[0_8px_24px_rgba(0,0,0,0.32)]">
            <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        <div className="flex h-40">
          <div className="relative flex h-full w-40 min-w-[10rem] flex-shrink-0 items-center justify-center overflow-hidden border-r border-[hsl(var(--wb-line)/0.5)] bg-[hsl(var(--wb-surface-2)/0.92)]">
          {task.status === 'running' && streamPreviewSrc && (
            <>
              <img
                src={streamPreviewSrc}
                className={`h-full w-full object-cover ${streamPreviewLoaded ? '' : 'hidden'}`}
                alt=""
                onLoad={() => setStreamPreviewLoaded(true)}
                onError={() => setStreamPreviewLoaded(false)}
              />
              {streamPreviewLoaded && (
                <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full border border-[hsl(var(--wb-accent)/0.35)] bg-[hsl(var(--wb-accent)/0.84)] px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm sm:text-xs">
                  预览
                </span>
              )}
            </>
          )}
              {task.status === 'running' && (!streamPreviewSrc || !streamPreviewLoaded) && (
            <div className="flex flex-col items-center gap-2">
              <svg
                className="h-8 w-8 animate-spin text-[hsl(var(--wb-accent))]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-xs text-[hsl(var(--wb-muted))]">生成中...</span>
            </div>
          )}
          {task.status === 'error' && isFalReconnecting && (
            <div className="flex flex-col items-center gap-1 px-2">
              <svg
                className="h-7 w-7 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="text-center text-xs leading-tight text-amber-300">
                重连中
              </span>
            </div>
          )}
          {task.status === 'error' && !isFalReconnecting && (
            <div className="flex flex-col items-center gap-1 px-2">
              <svg
                className={`h-7 w-7 ${isInterrupted ? 'text-amber-400' : 'text-rose-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className={`text-center text-xs leading-tight ${isInterrupted ? 'text-amber-300' : 'text-rose-300'}`}>
                {isInterrupted ? '已停止' : '失败'}
              </span>
            </div>
          )}
          {task.status === 'done' && thumbSrc && (
            <>
              {task.mediaType === 'video' ? (
                <div className="relative w-full h-full">
                  <img
                    src={thumbSrc}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    alt=""
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/22">
                    <svg className="h-12 w-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  {task.videoDuration && (
                    <span className="absolute bottom-1 right-1 rounded-full border border-white/10 bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white">
                      {Math.floor(task.videoDuration)}s
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <img
                    src={thumbSrc}
                    data-image-id={task.outputImages[0]}
                    data-output-image-ids={task.outputImages.join(',')}
                    className="saveable-image w-full h-full object-cover"
                    loading="lazy"
                    alt=""
                  />
                  {(hasPartialOutputFailure || task.outputImages.length > 1) && (
                    <span className="absolute bottom-1 right-1 rounded-full border border-white/10 bg-black/65 px-1.5 py-0.5 text-xs text-white">
                      {hasPartialOutputFailure ? <>{requestedOutputCount} | <span className="font-semibold text-yellow-300">{outputSuccessCount}</span></> : task.outputImages.length}
                    </span>
                  )}
                </>
              )}
            </>
          )}
          {task.status === 'done' && !thumbSrc && (
            <svg
              className="h-8 w-8 text-[hsl(var(--wb-line)/0.78)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
          <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
            {showRunningTimer || task.status !== 'done' ? (
              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm sm:text-xs">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {duration}
              </span>
            ) : task.mediaType === 'video' && task.videoAspectRatio ? (
              <>
                <span className="rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm sm:text-xs">
                  {task.videoAspectRatio}
                </span>
                {task.videoDuration && (
                  <span className="rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm sm:text-xs">
                    {Math.floor(task.videoDuration)}s
                  </span>
                )}
              </>
            ) : coverRatio && coverSize ? (
              <>
                <span className="rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm sm:text-xs">
                  {coverRatio}
                </span>
                <span className="rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm sm:text-xs">
                  {coverSize}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex-1 min-h-0 mb-2 overflow-hidden">
            {showPendingPrompt ? (
              <div className="leading-relaxed">
                <p className="text-sm text-[hsl(var(--wb-ink))]">正在生成……</p>
                <p className="mt-1 text-xs text-[hsl(var(--wb-muted))]">输入内容将在响应完成时接收</p>
              </div>
            ) : (
              <p className="line-clamp-3 text-sm leading-relaxed text-[hsl(var(--wb-ink)/0.9)]">
                {task.prompt || '(无提示词)'}
              </p>
            )}
          </div>
          <div className="mt-auto flex flex-col gap-1.5">
            <div 
              data-tag-scroll-area
              className="mask-edge-r flex min-w-0 gap-1.5 whitespace-nowrap overflow-x-auto pt-0.5 pr-2 hide-scrollbar"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onTouchCancel={(e) => e.stopPropagation()}
            >
              {(task.apiProfileName || task.apiProvider) && (
                <span 
                  className="workbench-chip flex-shrink-0 px-1.5 py-0.5 text-xs"
                  title={task.apiProfileName || task.apiProvider}
                >
                  <CodeIcon className="h-3 w-3 flex-shrink-0 text-[hsl(var(--wb-muted))]" />
                  <span className="truncate max-w-[8rem]">
                    {task.apiProfileName || task.apiProvider}
                  </span>
                </span>
              )}
              {showModel && (
                <span 
                  className="workbench-chip flex-shrink-0 px-1.5 py-0.5 text-xs"
                  title={task.apiModel}
                >
                  <svg className="h-3 w-3 flex-shrink-0 text-[hsl(var(--wb-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="truncate max-w-[8rem]">
                    {task.apiModel}
                  </span>
                </span>
              )}
              {task.maskImageId && (
                <span className="workbench-chip flex-shrink-0 px-1.5 py-0.5 text-xs text-[hsl(var(--wb-accent))]">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  局部重绘
                </span>
              )}
              {showTransparentOutput && (
                <span className="workbench-chip flex-shrink-0 px-1.5 py-0.5 text-xs text-emerald-300">
                  <TransparentBgIcon className="h-3 w-3 flex-shrink-0" />
                  透明背景
                </span>
              )}
              {showQuality && (
                <span className="workbench-chip flex-shrink-0 px-1.5 py-0.5 text-xs">
                  <span className="text-[hsl(var(--wb-muted))]">质量</span>
                  {qualityDisplay.isMismatch ? <ActualValueBadge value={qualityDisplay.displayValue} className="rounded-sm px-1" /> : <span className="text-[hsl(var(--wb-ink)/0.9)]">{qualityDisplay.displayValue}</span>}
                </span>
              )}
              {showSize && (
                <span className="workbench-chip flex-shrink-0 px-1.5 py-0.5 text-xs">
                  <span className="text-[hsl(var(--wb-muted))]">尺寸</span>
                  {sizeDisplay.isMismatch ? <ActualValueBadge value={sizeDisplay.displayValue} className="rounded-sm px-1" /> : <span className="text-[hsl(var(--wb-ink)/0.9)]">{sizeDisplay.displayValue}</span>}
                </span>
              )}
              {showFormat && (
                <span className="workbench-chip flex-shrink-0 px-1.5 py-0.5 text-xs">
                  <span className="text-[hsl(var(--wb-muted))]">格式</span>
                  {formatDisplay.isMismatch ? <ActualValueBadge value={formatDisplay.displayValue} className="rounded-sm px-1" /> : <span className="text-[hsl(var(--wb-ink)/0.9)]">{formatDisplay.displayValue}</span>}
                </span>
              )}
              {showN && (
                <span className="workbench-chip flex-shrink-0 px-1.5 py-0.5 text-xs">
                  <span className="text-[hsl(var(--wb-muted))]">数量</span>
                  {nDisplay.isMismatch ? <ActualValueBadge value={nDisplay.displayValue} className="rounded-sm px-1" /> : <span className="text-[hsl(var(--wb-ink)/0.9)]">{nDisplay.displayValue}</span>}
                </span>
              )}
            </div>
            <div
              data-tag-scroll-area
              className="mask-edge-r mt-0.5 ml-auto flex max-w-full flex-shrink-0 items-center gap-1 overflow-x-auto pr-2 hide-scrollbar"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onTouchCancel={(e) => e.stopPropagation()}
            >
              {((task.status === 'error' && !isFalReconnecting) || settings.alwaysShowRetryButton) && (
              <TaskActionButton
                tooltip="重试任务"
                onClick={() => retryTask(task)}
                className="rounded-lg p-1.5 text-[hsl(var(--wb-muted))] transition hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-[hsl(var(--wb-accent))]"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </TaskActionButton>
              )}
              <TaskActionButton
                tooltip={task.isFavorite ? '编辑收藏夹' : '收藏任务'}
                onClick={() => openFavoritePicker([task.id])}
                className={`rounded-lg p-1.5 transition ${
                  task.isFavorite
                    ? 'text-amber-300 hover:bg-[hsl(var(--wb-accent)/0.12)]'
                    : 'text-[hsl(var(--wb-muted))] hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-amber-300'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill={task.isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </TaskActionButton>
              <TaskActionButton
                tooltip="复用配置"
                onClick={onReuse}
                className="rounded-lg p-1.5 text-[hsl(var(--wb-muted))] transition hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-[hsl(var(--wb-accent))]"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </TaskActionButton>
              <TaskActionButton
                tooltip="编辑输出"
                onClick={onEditOutputs}
                className="rounded-lg p-1.5 text-[hsl(var(--wb-muted))] transition hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-30"
                disabled={!task.outputImages?.length}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </TaskActionButton>
              <TaskActionButton
                tooltip="删除任务"
                onClick={onDelete}
                className="rounded-lg p-1.5 text-[hsl(var(--wb-muted))] transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </TaskActionButton>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
