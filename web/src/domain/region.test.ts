import { describe, expect, it } from 'vitest'
import { normalizeRegion, translateRegion } from './region'

describe('region normalization', () => {
  it('orders and clamps region boundaries', () => {
    expect(normalizeRegion(8, -2, 10)).toEqual({ start: 0, end: 8 })
    expect(normalizeRegion(20, 3, 10)).toEqual({ start: 3, end: 10 })
  })

  it('rejects invalid and sub-millisecond regions', () => {
    expect(normalizeRegion(1, 1.0005, 10)).toBeNull()
    expect(normalizeRegion(Number.NaN, 2, 10)).toBeNull()
  })

  it('translates a region while preserving its length', () => {
    expect(translateRegion(2, 4, 1.5, 10)).toEqual({
      start: 3.5,
      end: 5.5,
    })
  })

  it('clamps translated regions at file boundaries', () => {
    expect(translateRegion(2, 4, -5, 10)).toEqual({ start: 0, end: 2 })
    expect(translateRegion(7, 9, 5, 10)).toEqual({ start: 8, end: 10 })
  })
})
