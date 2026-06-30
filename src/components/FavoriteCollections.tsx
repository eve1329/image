import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import type { TaskRecord, FavoriteCollection } from '../types'
import {
  ALL_FAVORITES_COLLECTION_ID,
  createFavoriteCollection,
  deleteFavoriteCollection,
  ensureImageThumbnailCached,
  getFavoriteCollectionTitle,
  getTaskFavoriteCollectionIds,
  renameFavoriteCollection,
  subscribeImageThumbnail,
  updateTasksFavoriteCollections,
  useStore,
} from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { useDragSelect } from '../hooks/useDragSelect'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { useTooltip } from '../hooks/useTooltip'
import { Checkbox } from './Checkbox'
import { EditIcon, FavoriteIcon, TrashIcon, CloseIcon, DragHandleIcon } from './icons'
import ViewportTooltip from './ViewportTooltip'

function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4.172a2 2 0 011.414.586L12 7h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}

function FavoriteActionButton({
  tooltip,
  className,
  wrapperClassName = 'relative inline-flex',
  disabled = false,
  onClick,
  onMouseDown,
  children,
}: {
  tooltip: string
  className: string
  wrapperClassName?: string
  disabled?: boolean
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onMouseDown?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  const tooltipState = useTooltip()

  return (
    <span className={wrapperClassName} {...tooltipState.handlers}>
      <button
        type="button"
        className={className}
        aria-label={tooltip}
        disabled={disabled}
        onClick={(e) => {
          tooltipState.dismiss()
          if (disabled) return
          onClick?.(e)
        }}
        onMouseDown={(e) => {
          tooltipState.dismiss()
          if (disabled) return
          onMouseDown?.(e)
        }}
      >
        {children}
      </button>
      <ViewportTooltip visible={tooltipState.visible} className="whitespace-nowrap">
        {tooltip}
      </ViewportTooltip>
    </span>
  )
}

function sameIdSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const bSet = new Set(b)
  return a.every((id) => bSet.has(id))
}

function getInitialCheckedCollectionIds(tasks: TaskRecord[], defaultFavoriteCollectionId: string | null) {
  if (!tasks.length) return defaultFavoriteCollectionId ? [defaultFavoriteCollectionId] : []
  const idSets = tasks.map(getTaskFavoriteCollectionIds)
  const hasFavorite = idSets.some((ids) => ids.length > 0)
  if (!hasFavorite) return defaultFavoriteCollectionId ? [defaultFavoriteCollectionId] : []
  const first = idSets[0] ?? []
  return idSets.every((ids) => sameIdSet(ids, first)) ? first : []
}

function getCollectionTasks(collectionId: string, tasks: TaskRecord[]) {
  const favoriteTasks = tasks.filter((task) => task.isFavorite)
  if (collectionId === ALL_FAVORITES_COLLECTION_ID) return favoriteTasks
  return favoriteTasks.filter((task) => getTaskFavoriteCollectionIds(task).includes(collectionId))
}

function getLatestCoverTask(tasks: TaskRecord[]) {
  return [...tasks]
    .filter((task) => task.outputImages?.length)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

function CoverThumbnail({ task }: { task?: TaskRecord }) {
  const [src, setSrc] = useState('')
  const imageId = task?.outputImages?.[0]

  useEffect(() => {
    setSrc('')
    if (!imageId) return
    let cancelled = false
    const unsubscribe = subscribeImageThumbnail(imageId, (thumbnail) => {
      if (!cancelled) setSrc(thumbnail.dataUrl)
    })
    ensureImageThumbnailCached(imageId).then((thumbnail) => {
      if (!cancelled && thumbnail) setSrc(thumbnail.dataUrl)
    }).catch(() => {})
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [imageId])

  if (src) return <img src={src} alt="" className="h-full w-full object-cover" />
  return (
    <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--wb-surface-2)/0.92)] text-[hsl(var(--wb-muted))]">
      <FavoriteIcon filled className="h-8 w-8 text-amber-300/80" />
    </div>
  )
}

type CollectionCard = {
  id: string
  name: string
  collection?: FavoriteCollection
  tasks: TaskRecord[]
}

function FavoriteCollectionOverviewCard({
  card,
  coverTask,
  isVirtualAll,
  isDefault,
  canDelete,
  isSelected,
  editingId,
  editingName,
  setEditingName,
  confirmRename,
  handleRenameKeyDown,
  startRename,
  handleSetDefault,
  handleDelete,
  onOpen,
  onToggleSelection,
  suppressClickUntilRef,
}: {
  card: CollectionCard
  coverTask?: TaskRecord
  isVirtualAll: boolean
  isDefault: boolean
  canDelete: boolean
  isSelected: boolean
  editingId: string | null
  editingName: string
  setEditingName: (value: string) => void
  confirmRename: () => void
  handleRenameKeyDown: (e: React.KeyboardEvent) => void
  startRename: (e: React.MouseEvent, collection: FavoriteCollection) => void
  handleSetDefault: (collection: FavoriteCollection) => void
  handleDelete: (collection: FavoriteCollection, collectionTasks: TaskRecord[]) => void
  onOpen: () => void
  onToggleSelection: () => void
  suppressClickUntilRef: { current: number }
}) {
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeStartedSelected, setSwipeStartedSelected] = useState(false)
  const [swipeActionActive, setSwipeActionActive] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<-1 | 0 | 1>(0)
  const cardRef = useRef<HTMLElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const horizontalSwipeRef = useRef(false)
  const suppressSwipeClickUntilRef = useRef(0)
  const swipeResetTimerRef = useRef<number | null>(null)
  const swipeFrameRef = useRef<number | null>(null)
  const swipeOffsetRef = useRef(0)
  const pendingSwipeOffsetRef = useRef(0)

  const applySwipeOffset = (offset: number) => {
    swipeOffsetRef.current = offset
    if (cardRef.current) cardRef.current.style.transform = offset ? `translateX(${offset}px)` : ''
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

  const resetSwipe = () => {
    touchStartRef.current = null
    horizontalSwipeRef.current = false
    setIsSwiping(false)
    setSwipeDirection(0)
    setSwipeActionActive(false)
    cancelSwipeFrame()
    applySwipeOffset(0)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) {
      resetSwipe()
      return
    }
    if (swipeResetTimerRef.current != null) {
      window.clearTimeout(swipeResetTimerRef.current)
      swipeResetTimerRef.current = null
    }
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    horizontalSwipeRef.current = false
    setSwipeStartedSelected(isSelected)
    setSwipeActionActive(false)
    setSwipeDirection(0)
    cancelSwipeFrame()
    applySwipeOffset(0)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const deltaX = e.touches[0].clientX - touchStartRef.current.x
    const deltaY = e.touches[0].clientY - touchStartRef.current.y
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      horizontalSwipeRef.current = true
      e.preventDefault()
      const boundedOffset = Math.max(-60, Math.min(60, deltaX))
      setSwipeDirection(boundedOffset > 0 ? 1 : boundedOffset < 0 ? -1 : 0)
      setSwipeActionActive(Math.abs(deltaX) >= 40)
      scheduleSwipeOffset(boundedOffset)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsSwiping(false)
    cancelSwipeFrame()
    setSwipeDirection(0)
    if (!touchStartRef.current) return
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    touchStartRef.current = null
    const isSwipeAction = horizontalSwipeRef.current && Math.abs(deltaX) > 40
    horizontalSwipeRef.current = false
    setSwipeActionActive(isSwipeAction)
    swipeResetTimerRef.current = window.setTimeout(() => {
      setSwipeActionActive(false)
      swipeResetTimerRef.current = null
    }, 220)
    if (isSwipeAction) {
      suppressSwipeClickUntilRef.current = Date.now() + 350
      e.preventDefault()
      e.stopPropagation()
      onToggleSelection()
    }
  }

  useEffect(() => () => {
    if (swipeResetTimerRef.current != null) window.clearTimeout(swipeResetTimerRef.current)
    cancelSwipeFrame()
  }, [])

  useEffect(() => {
    if (!isSwiping) applySwipeOffset(0)
  }, [isSwiping])

  const showSwipeAction = swipeActionActive
  const swipeBgClass = showSwipeAction
    ? swipeStartedSelected
      ? 'bg-[hsl(var(--wb-line-strong)/0.78)]'
      : 'bg-[hsl(var(--wb-accent)/0.78)]'
    : 'bg-[hsl(var(--wb-surface-3)/0.9)]'

  return (
    <div className="relative rounded-[18px]">
      <div className={`absolute inset-0 flex items-center rounded-[18px] transition-opacity duration-200 pointer-events-none ${isSwiping || swipeDirection !== 0 || swipeActionActive ? 'opacity-100' : 'opacity-0'} ${swipeBgClass} ${swipeDirection > 0 ? 'justify-start pl-6' : 'justify-end pr-6'}`}>
        <svg className={`w-8 h-8 transition-transform duration-150 ${showSwipeAction ? 'scale-110 text-white' : 'scale-90 text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {swipeStartedSelected && showSwipeAction ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          )}
        </svg>
      </div>
      <article
        ref={cardRef}
        className={`workbench-panel relative overflow-hidden rounded-[18px] border cursor-pointer touch-pan-y will-change-transform duration-200 ${!isSwiping ? 'transition-[box-shadow,border-color,background-color,transform]' : 'transition-[box-shadow,border-color,background-color]'} ${isSelected ? 'workbench-panel--strong ring-1 ring-[hsl(var(--wb-accent)/0.24)]' : 'hover:border-[hsl(var(--wb-line-strong)/0.86)]'} ${isSwiping ? '!bg-[hsl(var(--wb-surface)/0.96)]' : ''}`}
        onClick={(e) => {
          if (Date.now() < suppressClickUntilRef.current || Date.now() < suppressSwipeClickUntilRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return
          }
          const isCtrl = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? e.metaKey : e.ctrlKey
          if (isCtrl) {
            e.preventDefault()
            onToggleSelection()
            return
          }
          onOpen()
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetSwipe}
      >
        <div className="flex h-40">
          <div className="relative flex h-full w-40 min-w-[10rem] flex-shrink-0 items-center justify-center overflow-hidden border-r border-[hsl(var(--wb-line)/0.5)] bg-[hsl(var(--wb-surface-2)/0.92)]">
            <CoverThumbnail task={coverTask} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-4">
            <div className="flex-1 min-h-0 mb-2 overflow-hidden">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[hsl(var(--wb-ink))]">
                {isVirtualAll ? <FavoriteIcon filled className="h-4 w-4 shrink-0 text-amber-300" /> : <FolderIcon className="h-4 w-4 shrink-0 text-[hsl(var(--wb-muted))]" />}
                {editingId === card.id ? (
                  <input
                    type="text"
                    className="workbench-control h-6 min-w-0 flex-1 rounded-[10px] px-1.5 py-0 text-[14px] leading-6"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    onBlur={confirmRename}
                  />
                ) : (
                  <span className="truncate" title={card.name}>{card.name}</span>
                )}
              </div>
              <p className="mt-2 text-xs text-[hsl(var(--wb-muted))]">{card.tasks.length} 条任务</p>
            </div>
            <div className="mt-auto flex items-center justify-end gap-1">
              {!isVirtualAll && card.collection && (
                <>
                  <FavoriteActionButton
                    tooltip={isDefault ? '取消默认收藏夹' : '设为默认收藏夹'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSetDefault(card.collection!)
                    }}
                    className={`rounded-md p-1.5 transition hover:bg-[hsl(var(--wb-accent)/0.12)] ${isDefault ? 'text-amber-300' : 'text-[hsl(var(--wb-muted))] hover:text-amber-300'}`}
                  >
                    <FavoriteIcon filled={isDefault} className="w-4 h-4" />
                  </FavoriteActionButton>
                  {editingId === card.id ? (
                    <FavoriteActionButton
                      tooltip="确认"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        confirmRename()
                      }}
                      className="rounded-md p-1.5 text-emerald-300 transition hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-[hsl(var(--wb-ink))]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </FavoriteActionButton>
                  ) : (
                    <FavoriteActionButton
                      tooltip="编辑名称"
                      onClick={(e) => startRename(e, card.collection!)}
                      className="rounded-md p-1.5 text-[hsl(var(--wb-muted))] transition hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-emerald-300"
                    >
                      <EditIcon className="w-4 h-4" />
                    </FavoriteActionButton>
                  )}
                  <FavoriteActionButton
                    tooltip={canDelete ? '删除收藏夹' : '至少保留一个收藏夹'}
                    disabled={!canDelete}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(card.collection!, card.tasks)
                    }}
                    className={`rounded-md p-1.5 transition hover:bg-[hsl(var(--wb-accent)/0.12)] ${canDelete ? 'text-[hsl(var(--wb-muted))] hover:text-rose-300' : 'text-[hsl(var(--wb-muted)/0.45)] cursor-not-allowed'}`}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </FavoriteActionButton>
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}

export function FavoriteCollectionsView() {
  const tasks = useStore((s) => s.tasks)
  const collections = useStore((s) => s.favoriteCollections)
  const defaultFavoriteCollectionId = useStore((s) => s.defaultFavoriteCollectionId)
  const setDefaultFavoriteCollectionId = useStore((s) => s.setDefaultFavoriteCollectionId)
  const searchQuery = useStore((s) => s.searchQuery)
  const setActiveFavoriteCollectionId = useStore((s) => s.setActiveFavoriteCollectionId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const selectedFavoriteCollectionIds = useStore((s) => s.selectedFavoriteCollectionIds)
  const setSelectedFavoriteCollectionIds = useStore((s) => s.setSelectedFavoriteCollectionIds)
  const toggleFavoriteCollectionSelection = useStore((s) => s.toggleFavoriteCollectionSelection)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const suppressClickUntilRef = useRef(0)
  
  const cards = useMemo<CollectionCard[]>(() => {
    const allTasks = getCollectionTasks(ALL_FAVORITES_COLLECTION_ID, tasks)
    return [
      { id: ALL_FAVORITES_COLLECTION_ID, name: '全部', tasks: allTasks },
      ...collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        collection,
        tasks: getCollectionTasks(collection.id, tasks),
      })),
    ]
  }, [collections, tasks])

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards
    const lowerQuery = searchQuery.toLowerCase()
    return cards.filter(c => c.name.toLowerCase().includes(lowerQuery))
  }, [cards, searchQuery])

  const handleCollectionSelectionChange = useCallback((ids: string[]) => {
    setSelectedFavoriteCollectionIds(ids)
  }, [setSelectedFavoriteCollectionIds])

  const { selectionBox } = useDragSelect({
    containerSelector: '[data-drag-select-surface]',
    itemSelector: '.favorite-collection-card-wrapper',
    getItemId: (element) => element.getAttribute('data-favorite-collection-id'),
    onSelectionChange: handleCollectionSelectionChange,
    initialSelectedIds: selectedFavoriteCollectionIds,
    onSuppressClick: () => {
      suppressClickUntilRef.current = Date.now() + 250
    },
  })

  const startRename = (e: React.MouseEvent, collection: FavoriteCollection) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(collection.id)
    setEditingName(collection.name)
  }

  const confirmRename = () => {
    if (editingId && editingName.trim()) renameFavoriteCollection(editingId, editingName.trim())
    setEditingId(null)
    setEditingName('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingId(null)
      setEditingName('')
    }
  }

  const handleDelete = (collection: FavoriteCollection, collectionTasks: TaskRecord[]) => {
    if (collections.length <= 1) return
    const imageCount = new Set(collectionTasks.flatMap((task) => task.outputImages || [])).size
    setConfirmDialog({
      title: '删除收藏夹',
      message: `确定要删除收藏夹「${collection.name}」吗？`,
      checkbox: imageCount > 0
        ? {
            label: `同时删除收藏夹中的图片（${imageCount} 张）`,
            tone: 'danger',
          }
        : undefined,
      action: (deleteImages = false) => {
        void deleteFavoriteCollection(collection.id, deleteImages)
      },
    })
  }

  const handleSetDefault = (collection: FavoriteCollection) => {
    if (collection.id === defaultFavoriteCollectionId) {
      setDefaultFavoriteCollectionId(null)
      return
    }
    const current = collections.find((item) => item.id === defaultFavoriteCollectionId)
    if (!current) {
      setDefaultFavoriteCollectionId(collection.id)
      return
    }
    setConfirmDialog({
      title: '修改默认收藏夹',
      message: `确定要将默认收藏夹从「${current.name}」改为「${collection.name}」吗？`,
      action: () => setDefaultFavoriteCollectionId(collection.id),
    })
  }

  return (
    <div data-favorite-collections-root className="relative min-h-[50vh]">
      {filteredCards.length === 0 ? (
        <div className="workbench-panel mx-auto max-w-xl rounded-[18px] px-6 py-14 text-center text-[hsl(var(--wb-muted))]">
          <FavoriteIcon className="mx-auto mb-4 h-12 w-12 text-[hsl(var(--wb-line)/0.72)]" />
          <p className="text-sm">{cards.length === 0 ? '还没有收藏的图片' : '没有找到匹配的收藏夹'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 pb-12 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((card) => {
            const coverTask = getLatestCoverTask(card.tasks)
            const isVirtualAll = card.id === ALL_FAVORITES_COLLECTION_ID
            const isDefault = card.id === defaultFavoriteCollectionId
            const canDelete = collections.length > 1
            return (
              <div
                key={card.id}
                className="favorite-collection-card-wrapper"
                data-favorite-collection-id={card.id}
              >
                <FavoriteCollectionOverviewCard
                  card={card}
                  coverTask={coverTask}
                  isVirtualAll={isVirtualAll}
                  isDefault={isDefault}
                  canDelete={canDelete}
                  isSelected={selectedFavoriteCollectionIds.includes(card.id)}
                  editingId={editingId}
                  editingName={editingName}
                  setEditingName={setEditingName}
                  confirmRename={confirmRename}
                  handleRenameKeyDown={handleRenameKeyDown}
                  startRename={startRename}
                  handleSetDefault={handleSetDefault}
                  handleDelete={handleDelete}
                  onOpen={() => setActiveFavoriteCollectionId(card.id)}
                  onToggleSelection={() => toggleFavoriteCollectionSelection(card.id)}
                  suppressClickUntilRef={suppressClickUntilRef}
                />
              </div>
            )
          })}
        </div>
      )}
      {selectionBox && (
        <div
          className="fixed z-[30] pointer-events-none rounded-sm border border-[hsl(var(--wb-accent)/0.55)] bg-[hsl(var(--wb-accent)/0.12)] backdrop-blur-[2px]"
          style={{
            left: Math.min(selectionBox.startPageX, selectionBox.currentPageX) - window.scrollX,
            top: Math.min(selectionBox.startPageY, selectionBox.currentPageY) - window.scrollY,
            width: Math.abs(selectionBox.currentPageX - selectionBox.startPageX),
            height: Math.abs(selectionBox.currentPageY - selectionBox.startPageY),
          }}
        />
      )}
    </div>
  )
}

export function FavoriteCollectionPickerModal() {
  const taskIds = useStore((s) => s.favoritePickerTaskIds)
  const tasks = useStore((s) => s.tasks)
  const collections = useStore((s) => s.favoriteCollections)
  const defaultFavoriteCollectionId = useStore((s) => s.defaultFavoriteCollectionId)
  const setDefaultFavoriteCollectionId = useStore((s) => s.setDefaultFavoriteCollectionId)
  const setFavoriteCollections = useStore((s) => s.setFavoriteCollections)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const closePicker = useStore((s) => s.closeFavoritePicker)
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const open = Boolean(taskIds?.length)

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragDropPosition, setDragDropPosition] = useState<'before' | 'after' | null>(null)

  const [touchDragPreview, setTouchDragPreview] = useState<{
    label: string
    x: number
    y: number
    width: number
    height: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const touchDragRef = useRef<{ id: string, startX: number, startY: number, moved: boolean } | null>(null)

  const selectedTasks = useMemo(() => tasks.filter((task) => taskIds?.includes(task.id)), [tasks, taskIds])
  const selectableCollections = collections

  useEffect(() => {
    if (!open) return
    setCheckedIds(getInitialCheckedCollectionIds(selectedTasks, defaultFavoriteCollectionId))
    setDraft('')
    setEditingId(null)
    setEditingName('')
  }, [defaultFavoriteCollectionId, open, selectedTasks])

  useCloseOnEscape(open, closePicker)
  usePreventBackgroundScroll(open, modalRef)

  useEffect(() => {
    if (!touchDragPreview) return

    const preventTouchScroll = (event: TouchEvent) => {
      event.preventDefault()
    }
    const listenerOptions = { passive: false, capture: true } as AddEventListenerOptions
    const previousOverflow = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    window.addEventListener('touchmove', preventTouchScroll, listenerOptions)

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior = previousOverscroll
      window.removeEventListener('touchmove', preventTouchScroll, listenerOptions)
    }
  }, [touchDragPreview])

  if (!open || !taskIds) return null

  const toggleChecked = (id: string, checked: boolean) => {
    setCheckedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id))
  }

  const handleCreate = () => {
    const collection = createFavoriteCollection(draft)
    if (!collection) return
    setCheckedIds((current) => Array.from(new Set([...current, collection.id])))
    setDraft('')
  }

  const handleConfirm = () => {
    void updateTasksFavoriteCollections(taskIds, checkedIds)
    closePicker()
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const targetElement = e.currentTarget as HTMLElement
    const rect = targetElement.getBoundingClientRect()
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'

    if (dragOverId !== targetId || dragDropPosition !== position) {
      setDragOverId(targetId)
      setDragDropPosition(position)
    }

    const scrollContainer = targetElement.closest('.custom-scrollbar')
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const scrollThreshold = 30
      if (e.clientY < containerRect.top + scrollThreshold) {
        scrollContainer.scrollTop -= 10
      } else if (e.clientY > containerRect.bottom - scrollThreshold) {
        scrollContainer.scrollTop += 10
      }
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
    setDragDropPosition(null)
    setTouchDragPreview(null)
    touchDragRef.current = null
  }

  const handleTouchStart = (e: React.TouchEvent, collection: FavoriteCollection) => {
    if (!(e.target as HTMLElement).closest('[data-drag-handle]')) return
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()

    e.preventDefault()
    e.stopPropagation()
    touchDragRef.current = { id: collection.id, startX: touch.clientX, startY: touch.clientY, moved: false }
    setDraggedId(collection.id)
    setTouchDragPreview({
      label: collection.name,
      x: touch.clientX,
      y: touch.clientY,
      width: rect.width,
      height: rect.height,
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const drag = touchDragRef.current
    if (!drag) return
    const touch = e.touches[0]

    if (!drag.moved) {
      if (Math.abs(touch.clientX - drag.startX) > 5 || Math.abs(touch.clientY - drag.startY) > 5) {
        drag.moved = true
      } else {
        return
      }
    }

    e.preventDefault()
    setTouchDragPreview((current) => current ? { ...current, x: touch.clientX, y: touch.clientY } : current)

    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const targetElement = el?.closest('[data-collection-id]') as HTMLElement | null
    if (!targetElement) return

    const targetId = targetElement.getAttribute('data-collection-id')
    if (!targetId) return

    const rect = targetElement.getBoundingClientRect()
    const position = touch.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDragOverId(targetId)
    setDragDropPosition(position)

    const scrollContainer = targetElement.closest('.custom-scrollbar') as HTMLElement | null
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const scrollThreshold = 30
      if (touch.clientY < containerRect.top + scrollThreshold) {
        scrollContainer.scrollTop -= 10
      } else if (touch.clientY > containerRect.bottom - scrollThreshold) {
        scrollContainer.scrollTop += 10
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const drag = touchDragRef.current
    if (!drag) return
    if (drag.moved && dragOverId && dragOverId !== drag.id) {
      e.preventDefault()
      const sourceId = drag.id
      const targetId = dragOverId
      
      const sourceIndex = selectableCollections.findIndex((c) => c.id === sourceId)
      const targetIndex = selectableCollections.findIndex((c) => c.id === targetId)
      if (sourceIndex >= 0 && targetIndex >= 0) {
        const newCollections = [...selectableCollections]
        const [removed] = newCollections.splice(sourceIndex, 1)

        let newTargetIndex = targetIndex
        if (dragDropPosition === 'after') newTargetIndex++
        if (sourceIndex < targetIndex) newTargetIndex--

        newCollections.splice(newTargetIndex, 0, removed)
        setFavoriteCollections(newCollections)
      }
    }
    handleDragEnd()
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const sourceId = draggedId || e.dataTransfer.getData('text/plain')
    if (!sourceId || sourceId === targetId) return handleDragEnd()

    const sourceIndex = selectableCollections.findIndex((c) => c.id === sourceId)
    const targetIndex = selectableCollections.findIndex((c) => c.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return handleDragEnd()

    const newCollections = [...selectableCollections]
    const [removed] = newCollections.splice(sourceIndex, 1)

    let newTargetIndex = targetIndex
    if (dragDropPosition === 'after') newTargetIndex++
    if (sourceIndex < targetIndex) newTargetIndex--

    newCollections.splice(newTargetIndex, 0, removed)
    setFavoriteCollections(newCollections)
    handleDragEnd()
  }

  const startRename = (e: React.MouseEvent, collection: FavoriteCollection) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(collection.id)
    setEditingName(collection.name)
  }

  const confirmRename = () => {
    if (editingId && editingName.trim()) renameFavoriteCollection(editingId, editingName.trim())
    setEditingId(null)
    setEditingName('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingId(null)
      setEditingName('')
    }
  }

  const handleDelete = (e: React.MouseEvent, collection: FavoriteCollection) => {
    e.preventDefault()
    e.stopPropagation()
    if (collections.length <= 1) return
    const collectionTasks = tasks.filter(t => getTaskFavoriteCollectionIds(t).includes(collection.id))
    const imageCount = new Set(collectionTasks.flatMap((task) => task.outputImages || [])).size
    setConfirmDialog({
      title: '删除收藏夹',
      message: `确定要删除收藏夹「${collection.name}」吗？`,
      checkbox: imageCount > 0
        ? {
            label: `同时删除收藏夹中的图片（${imageCount} 张）`,
            tone: 'danger',
          }
        : undefined,
      action: (deleteImages = false) => {
        void deleteFavoriteCollection(collection.id, deleteImages)
      },
    })
  }

  const handleSetDefault = (e: React.MouseEvent, collection: FavoriteCollection) => {
    e.preventDefault()
    e.stopPropagation()
    if (collection.id === defaultFavoriteCollectionId) {
      setDefaultFavoriteCollectionId(null)
      return
    }
    const current = collections.find((item) => item.id === defaultFavoriteCollectionId)
    if (!current) {
      setDefaultFavoriteCollectionId(collection.id)
      return
    }
    setConfirmDialog({
      title: '修改默认收藏夹',
      message: `确定要将默认收藏夹从「${current.name}」改为「${collection.name}」吗？`,
      action: () => setDefaultFavoriteCollectionId(collection.id),
    })
  }

  return createPortal(
    <div data-no-drag-select className="fixed inset-0 z-[105] flex items-center justify-center p-4 sm:p-0" onClick={closePicker}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-overlay-in" />
      <div ref={modalRef} className="workbench-panel relative z-10 flex max-h-[85vh] w-full max-w-[400px] flex-col overflow-hidden rounded-[22px] animate-modal-in" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 shrink-0 relative border-b border-[hsl(var(--wb-line)/0.55)]">
          <FavoriteActionButton tooltip="关闭" onClick={closePicker} wrapperClassName="absolute right-5 top-5 inline-flex" className="shrink-0 rounded-full p-1.5 text-[hsl(var(--wb-muted))] transition hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-[hsl(var(--wb-ink))]">
            <CloseIcon className="h-5 w-5" />
          </FavoriteActionButton>
          <h2 className="mb-2 pr-8 flex items-center gap-2.5 text-lg font-semibold text-[hsl(var(--wb-ink))] leading-snug">
            <FavoriteIcon filled className="h-5 w-5 shrink-0 text-amber-300" />
            保存到收藏夹
          </h2>
          <p className="text-[13px] text-[hsl(var(--wb-muted))] leading-relaxed">
            取消勾选会将任务从对应的收藏夹中移除。
          </p>
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5 px-6 shrink-0">
            <span className="text-[13px] font-medium text-[hsl(var(--wb-muted))]">选择要保存的收藏夹</span>
            <div className="flex gap-4">
              <button type="button" onClick={() => setCheckedIds(selectableCollections.map((collection) => collection.id))} className="text-[13px] font-medium text-[hsl(var(--wb-accent))] transition-colors hover:text-[hsl(var(--wb-ink))]">全选</button>
              <button type="button" onClick={() => setCheckedIds([])} className="text-[13px] font-medium text-[hsl(var(--wb-muted))] transition-colors hover:text-[hsl(var(--wb-ink))]">取消</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {selectableCollections.length === 0 ? (
              <div className="py-8 text-center text-sm text-[hsl(var(--wb-muted))]">暂无收藏夹</div>
            ) : selectableCollections.map((collection) => {
              const isDefault = collection.id === defaultFavoriteCollectionId
              const canDelete = collections.length > 1
              return (
              <div 
                key={collection.id} 
                data-collection-id={collection.id}
                draggable={editingId !== collection.id}
                onDragStart={(e) => handleDragStart(e, collection.id)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, collection)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleDragEnd}
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (editingId === collection.id || target.closest('button,input,[data-drag-handle]')) return
                  toggleChecked(collection.id, !checkedIds.includes(collection.id))
                }}
                className={`group relative flex items-center justify-between transition-colors ${
                  draggedId === collection.id ? 'opacity-40 bg-[hsl(var(--wb-accent)/0.08)]' : 'hover:bg-[hsl(var(--wb-accent)/0.06)]'
                }`}
                onDragOver={(e) => handleDragOver(e, collection.id)}
                onDrop={(e) => handleDrop(e, collection.id)}
              >
                {dragOverId === collection.id && dragDropPosition === 'before' && draggedId !== collection.id && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-[hsl(var(--wb-accent))] z-40 pointer-events-none" />
                )}
                {dragOverId === collection.id && dragDropPosition === 'after' && draggedId !== collection.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[hsl(var(--wb-accent))] z-40 pointer-events-none" />
                )}
                <div className="flex h-12 cursor-pointer items-center flex-1 min-w-0 gap-3 pl-4 pr-3">
                  <div 
                    data-drag-handle
                    className="flex cursor-grab active:cursor-grabbing items-center justify-center text-[hsl(var(--wb-muted))] opacity-60 transition-opacity hover:opacity-100 shrink-0"
                    style={{ touchAction: 'none' }}
                  >
                    <DragHandleIcon className="h-3.5 w-3.5" />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checkedIds.includes(collection.id)}
                      onChange={(checked) => toggleChecked(collection.id, checked)}
                      className="shrink-0 scale-110"
                    />
                  </div>
                  {editingId === collection.id ? (
                    <input
                      type="text"
                      className="workbench-control h-6 min-w-0 flex-1 rounded-[10px] px-1.5 py-0 text-[15px] leading-6"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      onBlur={confirmRename}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[hsl(var(--wb-ink))]" title={collection.name}>{collection.name}</span>
                  )}
                </div>
                <div className={`flex shrink-0 items-center justify-end gap-2 overflow-hidden pr-4 transition-all duration-150 ${editingId === collection.id ? 'w-12' : 'w-28'}`}>
                    {editingId === collection.id ? (
                      <FavoriteActionButton
                        tooltip="确认"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          confirmRename()
                        }}
                        className="rounded-md p-1.5 text-emerald-300 transition-colors hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-[hsl(var(--wb-ink))]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </FavoriteActionButton>
                    ) : (
                      <>
                        <FavoriteActionButton tooltip={isDefault ? '取消默认收藏夹' : '设为默认收藏夹'} onClick={(e) => handleSetDefault(e, collection)} className={`rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--wb-accent)/0.12)] ${isDefault ? 'text-amber-300' : 'text-[hsl(var(--wb-muted))] hover:text-amber-300'}`}><FavoriteIcon filled={isDefault} className="w-3.5 h-3.5" /></FavoriteActionButton>
                        <FavoriteActionButton tooltip="重命名" onClick={(e) => startRename(e, collection)} className="rounded-md p-1.5 text-[hsl(var(--wb-muted))] transition-colors hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-emerald-300"><EditIcon className="w-3.5 h-3.5" /></FavoriteActionButton>
                        <FavoriteActionButton tooltip={canDelete ? '删除' : '至少保留一个收藏夹'} disabled={!canDelete} onClick={(e) => handleDelete(e, collection)} className={`rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--wb-accent)/0.12)] ${canDelete ? 'text-[hsl(var(--wb-muted))] hover:text-rose-300' : 'text-[hsl(var(--wb-muted)/0.45)] cursor-not-allowed'}`}><TrashIcon className="w-3.5 h-3.5" /></FavoriteActionButton>
                      </>
                    )}
                  </div>
              </div>
            )})}
          </div>
        </div>
        <div className="border-t border-[hsl(var(--wb-line)/0.55)] p-6 shrink-0">
          <div className="flex gap-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate()
              }}
              type="text"
              placeholder="新建收藏夹..."
              className="workbench-control min-w-0 flex-1 rounded-xl px-4 py-2 text-sm outline-none"
            />
            <button 
              type="button" 
              onClick={handleCreate} 
              disabled={!draft.trim()}
              className="inline-flex items-center justify-center rounded-xl border border-[hsl(var(--wb-line)/0.6)] bg-[hsl(var(--wb-accent))] px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-[hsl(var(--wb-accent)/0.88)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              新建
            </button>
          </div>
          <div className="mt-5 flex gap-4">
            <button type="button" onClick={closePicker} className="flex-1 rounded-xl border border-[hsl(var(--wb-line)/0.6)] bg-transparent px-4 py-2.5 text-sm font-medium text-[hsl(var(--wb-ink))] transition-colors hover:bg-[hsl(var(--wb-accent)/0.08)]">取消</button>
            <button type="button" onClick={handleConfirm} className="flex-1 rounded-xl border border-[hsl(var(--wb-accent)/0.45)] bg-[hsl(var(--wb-accent))] px-4 py-2.5 text-sm font-medium text-slate-950 transition-colors hover:bg-[hsl(var(--wb-accent)/0.88)]">确认</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function useFavoriteCollectionTitle() {
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const collections = useStore((s) => s.favoriteCollections)
  return activeFavoriteCollectionId ? getFavoriteCollectionTitle(activeFavoriteCollectionId, collections) : ''
}

export function ManageCollectionsModal() {
  const open = useStore((s) => s.isManageCollectionsModalOpen)
  const closeManage = useStore((s) => s.closeManageCollectionsModal)
  const collections = useStore((s) => s.favoriteCollections)
  const defaultFavoriteCollectionId = useStore((s) => s.defaultFavoriteCollectionId)
  const setDefaultFavoriteCollectionId = useStore((s) => s.setDefaultFavoriteCollectionId)
  const setFavoriteCollections = useStore((s) => s.setFavoriteCollections)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const tasks = useStore((s) => s.tasks)
  
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragDropPosition, setDragDropPosition] = useState<'before' | 'after' | null>(null)

  const [touchDragPreview, setTouchDragPreview] = useState<{
    label: string
    x: number
    y: number
    width: number
    height: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const touchDragRef = useRef<{ id: string, startX: number, startY: number, moved: boolean } | null>(null)

  const selectableCollections = collections

  useCloseOnEscape(open, closeManage)
  usePreventBackgroundScroll(open, modalRef)

  useEffect(() => {
    if (!open) return
    setDraft('')
    setEditingId(null)
    setEditingName('')
  }, [open])

  useEffect(() => {
    if (!touchDragPreview) return

    const preventTouchScroll = (event: TouchEvent) => {
      event.preventDefault()
    }
    const listenerOptions = { passive: false, capture: true } as AddEventListenerOptions
    const previousOverflow = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    window.addEventListener('touchmove', preventTouchScroll, listenerOptions)

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior = previousOverscroll
      window.removeEventListener('touchmove', preventTouchScroll, listenerOptions)
    }
  }, [touchDragPreview])

  if (!open) return null

  const handleCreate = () => {
    if (!draft.trim()) return
    createFavoriteCollection(draft)
    setDraft('')
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const targetElement = e.currentTarget as HTMLElement
    const rect = targetElement.getBoundingClientRect()
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'

    if (dragOverId !== targetId || dragDropPosition !== position) {
      setDragOverId(targetId)
      setDragDropPosition(position)
    }

    const scrollContainer = targetElement.closest('.custom-scrollbar')
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const scrollThreshold = 30
      if (e.clientY < containerRect.top + scrollThreshold) {
        scrollContainer.scrollTop -= 10
      } else if (e.clientY > containerRect.bottom - scrollThreshold) {
        scrollContainer.scrollTop += 10
      }
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
    setDragDropPosition(null)
    setTouchDragPreview(null)
    touchDragRef.current = null
  }

  const handleTouchStart = (e: React.TouchEvent, collection: FavoriteCollection | { id: string, name: string }) => {
    if (!(e.target as HTMLElement).closest('[data-drag-handle]')) return
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()

    e.preventDefault()
    e.stopPropagation()
    touchDragRef.current = { id: collection.id, startX: touch.clientX, startY: touch.clientY, moved: false }
    setDraggedId(collection.id)
    setTouchDragPreview({
      label: collection.name,
      x: touch.clientX,
      y: touch.clientY,
      width: rect.width,
      height: rect.height,
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const drag = touchDragRef.current
    if (!drag) return
    const touch = e.touches[0]

    if (!drag.moved) {
      if (Math.abs(touch.clientX - drag.startX) > 5 || Math.abs(touch.clientY - drag.startY) > 5) {
        drag.moved = true
      } else {
        return
      }
    }

    e.preventDefault()
    setTouchDragPreview((current) => current ? { ...current, x: touch.clientX, y: touch.clientY } : current)

    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const targetElement = el?.closest('[data-collection-id]') as HTMLElement | null
    if (!targetElement) return

    const targetId = targetElement.getAttribute('data-collection-id')
    if (!targetId) return

    const rect = targetElement.getBoundingClientRect()
    const position = touch.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDragOverId(targetId)
    setDragDropPosition(position)

    const scrollContainer = targetElement.closest('.custom-scrollbar') as HTMLElement | null
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const scrollThreshold = 30
      if (touch.clientY < containerRect.top + scrollThreshold) {
        scrollContainer.scrollTop -= 10
      } else if (touch.clientY > containerRect.bottom - scrollThreshold) {
        scrollContainer.scrollTop += 10
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const drag = touchDragRef.current
    if (!drag) return
    if (drag.moved && dragOverId && dragOverId !== drag.id) {
      e.preventDefault()
      const sourceId = drag.id
      const targetId = dragOverId
      
      const sourceIndex = selectableCollections.findIndex((c) => c.id === sourceId)
      const targetIndex = selectableCollections.findIndex((c) => c.id === targetId)
      if (sourceIndex >= 0 && targetIndex >= 0) {
        const newCollections = [...selectableCollections]
        const [removed] = newCollections.splice(sourceIndex, 1)

        let newTargetIndex = targetIndex
        if (dragDropPosition === 'after') newTargetIndex++
        if (sourceIndex < targetIndex) newTargetIndex--

        newCollections.splice(newTargetIndex, 0, removed)
        setFavoriteCollections(newCollections)
      }
    }
    handleDragEnd()
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const sourceId = draggedId || e.dataTransfer.getData('text/plain')
    if (!sourceId || sourceId === targetId) return handleDragEnd()

    const sourceIndex = selectableCollections.findIndex((c) => c.id === sourceId)
    const targetIndex = selectableCollections.findIndex((c) => c.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return handleDragEnd()

    const newCollections = [...selectableCollections]
    const [removed] = newCollections.splice(sourceIndex, 1)

    let newTargetIndex = targetIndex
    if (dragDropPosition === 'after') newTargetIndex++
    if (sourceIndex < targetIndex) newTargetIndex--

    newCollections.splice(newTargetIndex, 0, removed)
    setFavoriteCollections(newCollections)
    handleDragEnd()
  }

  const startRename = (e: React.MouseEvent, collection: { id: string, name: string }) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(collection.id)
    setEditingName(collection.name)
  }

  const confirmRename = () => {
    if (editingId && editingName.trim()) renameFavoriteCollection(editingId, editingName.trim())
    setEditingId(null)
    setEditingName('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingId(null)
      setEditingName('')
    }
  }

  const handleDelete = (e: React.MouseEvent, collection: { id: string, name: string }) => {
    e.preventDefault()
    e.stopPropagation()
    if (collections.length <= 1) return
    const collectionTasks = tasks.filter(t => getTaskFavoriteCollectionIds(t).includes(collection.id))
    const imageCount = new Set(collectionTasks.flatMap((task) => task.outputImages || [])).size
    setConfirmDialog({
      title: '删除收藏夹',
      message: `确定要删除收藏夹「${collection.name}」吗？`,
      checkbox: imageCount > 0
        ? {
            label: `同时删除收藏夹中的图片（${imageCount} 张）`,
            tone: 'danger',
          }
        : undefined,
      action: (deleteImages = false) => {
        void deleteFavoriteCollection(collection.id, deleteImages)
      },
    })
  }

  const handleSetDefault = (e: React.MouseEvent, collection: { id: string, name: string }) => {
    e.preventDefault()
    e.stopPropagation()
    if (collection.id === defaultFavoriteCollectionId) {
      setDefaultFavoriteCollectionId(null)
      return
    }
    const current = collections.find((item) => item.id === defaultFavoriteCollectionId)
    if (!current) {
      setDefaultFavoriteCollectionId(collection.id)
      return
    }
    setConfirmDialog({
      title: '修改默认收藏夹',
      message: `确定要将默认收藏夹从「${current.name}」改为「${collection.name}」吗？`,
      action: () => setDefaultFavoriteCollectionId(collection.id),
    })
  }

  return createPortal(
    <div data-no-drag-select className="fixed inset-0 z-[105] flex items-center justify-center p-4 sm:p-0" onClick={closeManage}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-overlay-in" />
      <div ref={modalRef} className="workbench-panel relative z-10 flex max-h-[85vh] w-full max-w-[400px] flex-col overflow-hidden rounded-[22px] animate-modal-in" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 shrink-0 relative border-b border-[hsl(var(--wb-line)/0.55)]">
          <FavoriteActionButton tooltip="关闭" onClick={closeManage} wrapperClassName="absolute right-5 top-5 inline-flex" className="shrink-0 rounded-full p-1.5 text-[hsl(var(--wb-muted))] transition hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-[hsl(var(--wb-ink))]">
            <CloseIcon className="h-5 w-5" />
          </FavoriteActionButton>
          <h2 className="mb-2 pr-8 flex items-center gap-2.5 text-lg font-semibold text-[hsl(var(--wb-ink))] leading-snug">
            <FavoriteIcon filled className="h-5 w-5 shrink-0 text-amber-300" />
            管理收藏夹
          </h2>
          <p className="text-[13px] text-[hsl(var(--wb-muted))] leading-relaxed">
            在这里管理你的收藏夹列表及排序。
          </p>
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-3 pb-1">
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {selectableCollections.length === 0 ? (
              <div className="py-8 text-center text-sm text-[hsl(var(--wb-muted))]">暂无收藏夹</div>
            ) : selectableCollections.map((collection) => {
              const isDefault = collection.id === defaultFavoriteCollectionId
              const canDelete = collections.length > 1
              return (
              <div 
                key={collection.id} 
                data-collection-id={collection.id}
                draggable={editingId !== collection.id}
                onDragStart={(e) => handleDragStart(e, collection.id)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, collection)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleDragEnd}
                className={`group relative flex items-center justify-between transition-colors ${
                  draggedId === collection.id ? 'opacity-40 bg-[hsl(var(--wb-accent)/0.08)]' : 'hover:bg-[hsl(var(--wb-accent)/0.06)]'
                }`}
                onDragOver={(e) => handleDragOver(e, collection.id)}
                onDrop={(e) => handleDrop(e, collection.id)}
              >
                {dragOverId === collection.id && dragDropPosition === 'before' && draggedId !== collection.id && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-[hsl(var(--wb-accent))] z-40 pointer-events-none" />
                )}
                {dragOverId === collection.id && dragDropPosition === 'after' && draggedId !== collection.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[hsl(var(--wb-accent))] z-40 pointer-events-none" />
                )}
                <div className="flex h-12 items-center flex-1 min-w-0 gap-3 pl-4 pr-3">
                  <div 
                    data-drag-handle
                    className="flex cursor-grab active:cursor-grabbing items-center justify-center text-[hsl(var(--wb-muted))] opacity-60 transition-opacity hover:opacity-100 shrink-0"
                    style={{ touchAction: 'none' }}
                  >
                    <DragHandleIcon className="h-3.5 w-3.5" />
                  </div>
                  {editingId === collection.id ? (
                    <input
                      type="text"
                      className="workbench-control h-6 min-w-0 flex-1 rounded-[10px] px-1.5 py-0 text-[15px] leading-6"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      onBlur={confirmRename}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[hsl(var(--wb-ink))]" title={collection.name}>{collection.name}</span>
                  )}
                </div>
                <div className={`flex shrink-0 items-center justify-end gap-2 overflow-hidden pr-4 transition-all duration-150 ${editingId === collection.id ? 'w-12' : 'w-28'}`}>
                    {editingId === collection.id ? (
                      <FavoriteActionButton
                        tooltip="确认"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          confirmRename()
                        }}
                        className="rounded-md p-1.5 text-emerald-300 transition-colors hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-[hsl(var(--wb-ink))]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </FavoriteActionButton>
                    ) : (
                      <>
                        <FavoriteActionButton tooltip={isDefault ? '取消默认收藏夹' : '设为默认收藏夹'} onClick={(e) => handleSetDefault(e, collection)} className={`rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--wb-accent)/0.12)] ${isDefault ? 'text-amber-300' : 'text-[hsl(var(--wb-muted))] hover:text-amber-300'}`}><FavoriteIcon filled={isDefault} className="w-3.5 h-3.5" /></FavoriteActionButton>
                        <FavoriteActionButton tooltip="重命名" onClick={(e) => startRename(e, collection)} className="rounded-md p-1.5 text-[hsl(var(--wb-muted))] transition-colors hover:bg-[hsl(var(--wb-accent)/0.12)] hover:text-[hsl(var(--wb-ink))]"><EditIcon className="w-3.5 h-3.5" /></FavoriteActionButton>
                        <FavoriteActionButton tooltip={canDelete ? '删除' : '至少保留一个收藏夹'} disabled={!canDelete} onClick={(e) => handleDelete(e, collection)} className={`rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--wb-accent)/0.12)] ${canDelete ? 'text-[hsl(var(--wb-muted))] hover:text-rose-300' : 'text-[hsl(var(--wb-muted)/0.45)] cursor-not-allowed'}`}><TrashIcon className="w-3.5 h-3.5" /></FavoriteActionButton>
                      </>
                    )}
                  </div>
              </div>
            )})}
          </div>
        </div>
        <div className="border-t border-[hsl(var(--wb-line)/0.55)] p-6 shrink-0">
          <div className="flex gap-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate()
              }}
              type="text"
              placeholder="新建收藏夹..."
              className="workbench-control min-w-0 flex-1 rounded-xl px-4 py-2 text-sm outline-none"
            />
            <button 
              type="button" 
              onClick={handleCreate} 
              disabled={!draft.trim()}
              className="inline-flex items-center justify-center rounded-xl border border-[hsl(var(--wb-line)/0.6)] bg-[hsl(var(--wb-accent))] px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-[hsl(var(--wb-accent)/0.88)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              新建
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
