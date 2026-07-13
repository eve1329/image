import { describe, expect, it } from 'vitest'
import {
  calculateVideoReferenceImageSize,
  shouldOptimizeVideoReferenceImage,
  VIDEO_REFERENCE_IMAGE_MAX_EDGE,
} from '../../vendor/infinite-canvas/web/src/lib/video-reference-preprocess'

describe('calculateVideoReferenceImageSize', () => {
  it('keeps images at or below the video reference edge unchanged', () => {
    expect(calculateVideoReferenceImageSize(512, VIDEO_REFERENCE_IMAGE_MAX_EDGE)).toEqual({
      width: 512,
      height: VIDEO_REFERENCE_IMAGE_MAX_EDGE,
      wasResized: false,
    })
  })

  it('scales oversized images so the longest edge is 1024px', () => {
    expect(calculateVideoReferenceImageSize(864, 1821)).toEqual({
      width: 486,
      height: VIDEO_REFERENCE_IMAGE_MAX_EDGE,
      wasResized: true,
    })
  })
})

describe('shouldOptimizeVideoReferenceImage', () => {
  it('optimizes non-jpeg images even when they are already small enough', () => {
    expect(shouldOptimizeVideoReferenceImage({ width: 800, height: 800, mimeType: 'image/png' })).toBe(true)
  })

  it('optimizes jpeg images when they exceed the video reference edge', () => {
    expect(shouldOptimizeVideoReferenceImage({ width: 2048, height: 1024, mimeType: 'image/jpeg' })).toBe(true)
  })

  it('leaves small jpeg images unchanged', () => {
    expect(shouldOptimizeVideoReferenceImage({ width: 800, height: 1024, mimeType: 'image/jpeg' })).toBe(false)
  })
})
