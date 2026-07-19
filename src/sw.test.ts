import swSource from '../public/sw.js?raw'
import { describe, expect, it, vi } from 'vitest'

function loadFetchHandler(overrides?: {
  fetchImpl?: typeof fetch
  cachesImpl?: CacheStorage
}) {
  const handlers: Record<string, (event: any) => void> = {}
  const self = {
    location: { origin: 'https://artworkers.online' },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    addEventListener: vi.fn((type: string, handler: (event: any) => void) => {
      handlers[type] = handler
    }),
  }

  const factory = new Function(
    'self',
    'fetch',
    'caches',
    'URL',
    'Request',
    'Response',
    'console',
    `${swSource}\nreturn self;`,
  )

  factory(
    self,
    overrides?.fetchImpl ?? fetch,
    overrides?.cachesImpl ?? {
      open: vi.fn(),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
      match: vi.fn(async () => undefined),
    },
    URL,
    Request,
    Response,
    console,
  )

  return handlers.fetch
}

describe('service worker fetch policy', () => {
  it('bypasses cache for async task polling endpoints so completed tasks are not stuck on stale status', async () => {
    const cachedPending = new Response(JSON.stringify({ data: { status: 'IN_PROGRESS' } }), {
      headers: { 'Content-Type': 'application/json' },
    })
    const networkSuccess = new Response(JSON.stringify({ data: { status: 'SUCCESS' } }), {
      headers: { 'Content-Type': 'application/json' },
    })
    const fetchImpl = vi.fn(async () => networkSuccess)
    const cachesImpl = {
      open: vi.fn(),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
      match: vi.fn(async () => cachedPending),
    } as unknown as CacheStorage
    const fetchHandler = loadFetchHandler({ fetchImpl, cachesImpl })

    let responsePromise: Promise<Response> | undefined
    fetchHandler({
      request: new Request('https://artworkers.online/v1/images/tasks/task_123'),
      respondWith: (promise: Promise<Response>) => {
        responsePromise = promise
      },
    })

    const response = await responsePromise
    expect(response).toBeDefined()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(await response!.json()).toEqual({ data: { status: 'SUCCESS' } })
  })
})
