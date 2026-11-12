import { describe, expect, it } from 'vitest'
import {
  clampNavigationTime,
  fitNavigationRange,
  navigationBounds,
} from './navigationRange'

describe('active navigation range', () => {
  it('fits the reviewed span while preserving source timeline offsets', () => {
    expect(fitNavigationRange(20, 1000, { start: 4, end: 9 })).toEqual({
      start: 4,
      end: 9,
      zoom: 200,
    })
  })
  it('clamps explicit seeks without changing stored intervals', () => {
    const range = { start: 4, end: 9 }
    expect(clampNavigationTime(2, 20, range)).toBe(4)
    expect(clampNavigationTime(12, 20, range)).toBe(9)
    expect(range).toEqual({ start: 4, end: 9 })
  })
  it('falls back to complete source bounds for absent or invalid ranges', () => {
    expect(navigationBounds(20, null)).toEqual({ start: 0, end: 20 })
    expect(navigationBounds(20, { start: 30, end: 35 })).toEqual({
      start: 0,
      end: 20,
    })
    expect(clampNavigationTime(NaN, 20, { start: 4, end: 9 })).toBe(4)
  })
})
