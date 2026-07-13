import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  'vendor/infinite-canvas/web/src/app/(user)/canvas/components/infinite-canvas.tsx',
  'utf-8',
)

describe('InfiniteCanvas wheel source guard', () => {
  it('does not prevent native scrolling inside canvas interaction surfaces', () => {
    expect(source).toContain('shouldPreventCanvasWheelDefault')
    expect(source).toContain('target?.closest(INTERACTIVE_WHEEL_SELECTOR)')
    expect(source).toContain('if (shouldPreventCanvasWheelDefault(event.target)) event.preventDefault()')
  })
})
