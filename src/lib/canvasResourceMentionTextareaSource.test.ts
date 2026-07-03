import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  'vendor/infinite-canvas/web/src/app/(user)/canvas/components/canvas-resource-mention-textarea.tsx',
  'utf-8',
)

describe('CanvasResourceMentionTextarea source guard', () => {
  it('keeps the native textarea caret visible while focused', () => {
    expect(source).toContain('const [isFocused, setIsFocused] = useState(false)')
    expect(source).toContain('!isFocused')
    expect(source).toContain('setIsFocused(true)')
    expect(source).toContain('setIsFocused(false)')
  })
})
