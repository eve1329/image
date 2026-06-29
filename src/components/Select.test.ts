import { describe, expect, it } from 'vitest'
import { getNextActiveOptionIndex } from './Select'

describe('getNextActiveOptionIndex', () => {
  it('moves through the list without leaving bounds', () => {
    expect(getNextActiveOptionIndex(0, 'ArrowUp', 3)).toBe(0)
    expect(getNextActiveOptionIndex(0, 'ArrowDown', 3)).toBe(1)
    expect(getNextActiveOptionIndex(2, 'ArrowDown', 3)).toBe(2)
  })

  it('jumps to the first or last option', () => {
    expect(getNextActiveOptionIndex(1, 'Home', 4)).toBe(0)
    expect(getNextActiveOptionIndex(1, 'End', 4)).toBe(3)
  })

  it('returns -1 when there are no options', () => {
    expect(getNextActiveOptionIndex(0, 'ArrowDown', 0)).toBe(-1)
  })
})
