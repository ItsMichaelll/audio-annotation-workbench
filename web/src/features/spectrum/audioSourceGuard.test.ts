import { describe, expect, it } from 'vitest'
import { AudioSourceGuard } from './audioSourceGuard'

describe('AudioSourceGuard', () => {
  it('allows exactly one successful claim per media object', () => {
    const guard = new AudioSourceGuard<object>()
    const media = {}

    expect(guard.claim(media)).toBe(true)
    expect(guard.claim(media)).toBe(false)
    expect(guard.has(media)).toBe(true)
  })

  it('allows retry after initialization fails before source creation', () => {
    const guard = new AudioSourceGuard<object>()
    const media = {}

    guard.claim(media)
    guard.releaseFailedClaim(media)
    expect(guard.claim(media)).toBe(true)
  })
})
