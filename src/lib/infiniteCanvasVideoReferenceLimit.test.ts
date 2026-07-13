import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const videoApiSource = readFileSync('vendor/infinite-canvas/web/src/services/api/video.ts', 'utf-8')

describe('Infinite Canvas video reference image limit', () => {
  it('uses the shared 9 image limit for OpenAI-compatible video requests', () => {
    expect(videoApiSource).not.toContain('references.slice(0, 7)')
    expect(videoApiSource).toContain('references.slice(0, SEEDANCE_REFERENCE_LIMITS.images)')
  })
})
