import { describe, expect, it } from 'vitest'
import {
  adjacentRegion,
  clampRegionEdit,
  maximumAudioScroll,
  normalizeRegion,
  regionDragBounds,
  regionVisualColors,
  translateRegion,
  viewportAutoScrollDelta,
} from './region'

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

  it('preserves duration while movement crosses either audio boundary', () => {
    expect(clampRegionEdit({ start: 2, end: 4 }, -3, -1, 10)).toEqual({
      start: 0,
      end: 2,
    })
    expect(clampRegionEdit({ start: 7, end: 9 }, 11, 13, 10)).toEqual({
      start: 8,
      end: 10,
    })
    expect(
      clampRegionEdit({ start: 2, end: 4 }, 2.2500001, 4.2500002, 10),
    ).toEqual({ start: 2.2500001, end: 2.2500001 + 2 })
  })

  it('clamps resized edges without inversion or disappearance', () => {
    expect(clampRegionEdit({ start: 2, end: 4 }, -2, 4, 10)).toEqual({
      start: 0,
      end: 4,
    })
    expect(clampRegionEdit({ start: 2, end: 4 }, 2, 12, 10)).toEqual({
      start: 2,
      end: 10,
    })
    expect(clampRegionEdit({ start: 2, end: 4 }, 5, 4, 10)).toEqual({
      start: 3.999,
      end: 4,
    })
    expect(clampRegionEdit({ start: 2, end: 4 }, 2, 1, 10)).toEqual({
      start: 2,
      end: 2.001,
    })
  })

  it('keeps nudged and restored regions inside the audio', () => {
    expect(translateRegion(0, 2, -0.5, 10)).toEqual({ start: 0, end: 2 })
    expect(translateRegion(8, 10, 0.5, 10)).toEqual({ start: 8, end: 10 })
    expect(normalizeRegion(-3, 14, 10)).toEqual({ start: 0, end: 10 })
  })

  it('preserves boundary overshoot until the pointer crosses back', () => {
    const leftOrigin = {
      start: 1,
      end: 3,
      pointerX: 100,
      scrollLeft: 0,
      pixelsPerSecond: 10,
    }
    expect(regionDragBounds(leftOrigin, 80, 0, 10)).toEqual({
      start: 0,
      end: 2,
    })
    expect(regionDragBounds(leftOrigin, 85, 0, 10)).toEqual({
      start: 0,
      end: 2,
    })
    expect(regionDragBounds(leftOrigin, 95, 0, 10)).toEqual({
      start: 0.5,
      end: 2.5,
    })

    const rightOrigin = { ...leftOrigin, start: 7, end: 9 }
    expect(regionDragBounds(rightOrigin, 120, 0, 10)).toEqual({
      start: 8,
      end: 10,
    })
    expect(regionDragBounds(rightOrigin, 115, 0, 10)).toEqual({
      start: 8,
      end: 10,
    })
    expect(regionDragBounds(rightOrigin, 105, 0, 10)).toEqual({
      start: 7.5,
      end: 9.5,
    })
  })

  it('auto-scrolls only toward audio beyond a viewport edge', () => {
    expect(viewportAutoScrollDelta(500, 100, 500, 200, 800)).toBe(1)
    expect(viewportAutoScrollDelta(102, 100, 500, 200, 800)).toBeLessThan(0)
    expect(viewportAutoScrollDelta(498, 100, 500, 800, 800)).toBe(0)
    expect(viewportAutoScrollDelta(102, 100, 500, 0, 800)).toBe(0)

    const origin = {
      start: 4,
      end: 6,
      pointerX: 490,
      scrollLeft: 100,
      pixelsPerSecond: 10,
    }
    expect(regionDragBounds(origin, 490, 120, 20)).toEqual({
      start: 6,
      end: 8,
    })
  })

  it('derives the scroll limit from audio content instead of rendered regions', () => {
    expect(maximumAudioScroll(100, 50, 1_000)).toBe(4_000)
    expect(maximumAudioScroll(10, 50, 1_000)).toBe(0)
    expect(
      viewportAutoScrollDelta(
        1_000,
        0,
        1_000,
        3_998,
        maximumAudioScroll(100, 50, 1_000),
      ),
    ).toBe(1)
  })

  it('navigates chronologically without wrapping', () => {
    const regions = [
      { id: 'later', start: 4, end: 5, data: {} },
      { id: 'first', start: 1, end: 2, data: {} },
      { id: 'middle', start: 3, end: 4, data: {} },
    ]
    expect(adjacentRegion(regions, null, 'next')?.id).toBe('first')
    expect(adjacentRegion(regions, null, 'previous')?.id).toBe('later')
    expect(adjacentRegion(regions, 'middle', 'previous')?.id).toBe('first')
    expect(adjacentRegion(regions, 'middle', 'next')?.id).toBe('later')
    expect(adjacentRegion(regions, 'first', 'previous')).toBeNull()
    expect(adjacentRegion(regions, 'later', 'next')).toBeNull()
  })

  it('derives transparent region colors from taxonomy YAML colors', () => {
    expect(regionVisualColors('#4f8cff', false)).toEqual({
      fill: 'rgba(79, 140, 255, 0.14)',
      border: 'rgba(79, 140, 255, 0.78)',
    })
    expect(regionVisualColors('#4f8cff', true)).toEqual({
      fill: 'rgba(79, 140, 255, 0.24)',
      border: 'rgba(79, 140, 255, 0.95)',
    })
    expect(regionVisualColors(undefined, false).fill).toBe(
      'rgba(70, 144, 255, 0.28)',
    )
  })
})
