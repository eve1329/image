import { describe, expect, it } from 'vitest'
import { createDefaultOpenAIProfile, normalizeSettings } from './apiProfiles'
import { buildInfiniteCanvasUrl } from './infiniteCanvasUrl'

describe('buildInfiniteCanvasUrl', () => {
  it('does not add the active API profile credentials to the canvas URL', () => {
    const profile = createDefaultOpenAIProfile({
      id: 'openai-a',
      baseUrl: 'https://gptch.cloud/v1',
      apiKey: 'secret-key',
    })
    const settings = normalizeSettings({
      profiles: [profile],
      activeProfileId: profile.id,
    })

    expect(buildInfiniteCanvasUrl(settings, 'http://localhost:3000/canvas')).toBe(
      'http://localhost:3000/canvas',
    )
  })

  it('preserves existing query parameters without appending credentials', () => {
    const profile = createDefaultOpenAIProfile({
      id: 'openai-a',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key with spaces',
    })
    const settings = normalizeSettings({
      profiles: [profile],
      activeProfileId: profile.id,
    })

    expect(buildInfiniteCanvasUrl(settings, 'http://localhost:3000/canvas?mode=recent')).toBe(
      'http://localhost:3000/canvas?mode=recent',
    )
  })

  it('omits empty credentials', () => {
    const profile = createDefaultOpenAIProfile({
      id: 'openai-a',
      baseUrl: '',
      apiKey: '',
    })
    const settings = normalizeSettings({
      profiles: [profile],
      activeProfileId: profile.id,
    })

    expect(buildInfiniteCanvasUrl(settings, 'http://localhost:3000/canvas')).toBe('http://localhost:3000/canvas')
  })
})
