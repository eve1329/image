import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Header from './Header'

vi.mock('../store', () => ({
  useStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      appMode: 'gallery',
      setAppMode: () => {},
      setShowSettings: () => {},
      setConfirmDialog: () => {},
      agentMobileHeaderVisible: true,
      agentConversations: [],
      activeAgentConversationId: null,
      filterFavorite: false,
      activeFavoriteCollectionId: null,
      createAgentConversation: () => 'conversation-1',
    }),
}))

vi.mock('../hooks/useVersionCheck', () => ({
  useVersionCheck: () => ({
    hasUpdate: false,
    latestRelease: null,
    dismiss: () => {},
  }),
}))

vi.mock('../hooks/useTooltip', () => ({
  useTooltip: () => ({
    visible: false,
    handlers: {},
    dismiss: () => {},
  }),
}))

vi.mock('./ViewportTooltip', () => ({
  default: () => null,
}))

vi.mock('./HelpModal', () => ({
  default: () => null,
}))

vi.mock('./HistoryModal', () => ({
  default: () => null,
}))

vi.mock('./FavoriteCollections', () => ({
  useFavoriteCollectionTitle: () => '',
}))

describe('Header', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      writable: true,
      value: {
        navigator: {},
        matchMedia: vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      },
    })
  })

  it('renders cherry image as plain title text without the old external link', () => {
    const html = renderToStaticMarkup(<Header />)

    expect(html).toContain('cherry image')
    expect(html).not.toContain('GPT Image Playground')
    expect(html).not.toContain('https://github.com/CookSleep/gpt_image_playground')
  })
})
