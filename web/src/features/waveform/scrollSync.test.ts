import { describe, expect, it } from 'vitest'
import { scrollWidthsMatch } from './scrollSync'

describe('waveform scrollbar synchronization', () => {
  it('allows position synchronization after track geometry matches', () => {
    expect(scrollWidthsMatch(4000, 4000)).toBe(true)
    expect(scrollWidthsMatch(4000, 3999.5)).toBe(true)
  })

  it('blocks a stale scrollbar track from feeding a clamped position back', () => {
    expect(scrollWidthsMatch(4000, 2000)).toBe(false)
  })

  it('rejects invalid geometry', () => {
    expect(scrollWidthsMatch(Number.NaN, 2000)).toBe(false)
    expect(scrollWidthsMatch(2000, -1)).toBe(false)
  })
})
