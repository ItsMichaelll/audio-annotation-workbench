import { describe, expect, it } from 'vitest'
import {
  cursorCenteredScroll,
  fitZoom,
  MAX_VERTICAL_SCALE,
  MIN_VERTICAL_SCALE,
  steppedVerticalScale,
  steppedZoom,
} from './zoom'

describe('zoom calculations', () => {
  it('fits the entire duration to the viewport', () => {
    expect(fitZoom(100, 1200)).toBe(12)
    expect(fitZoom(0, 1200)).toBe(0)
  })

  it('steps in and never zooms below fit', () => {
    expect(steppedZoom(12, 'in', 12)).toBeCloseTo(16.2)
    expect(steppedZoom(12, 'out', 12)).toBe(12)
  })

  it('steps and clamps vertical waveform scale', () => {
    expect(steppedVerticalScale(1, 'in')).toBeCloseTo(1.2)
    expect(steppedVerticalScale(1, 'out')).toBeCloseTo(1 / 1.2)
    expect(steppedVerticalScale(MAX_VERTICAL_SCALE, 'in')).toBe(
      MAX_VERTICAL_SCALE,
    )
    expect(steppedVerticalScale(MIN_VERTICAL_SCALE, 'out')).toBe(
      MIN_VERTICAL_SCALE,
    )
  })

  it('snaps to the original vertical scale when crossing it', () => {
    expect(steppedVerticalScale(0.9, 'in')).toBe(1)
    expect(steppedVerticalScale(1.08, 'out')).toBe(1)
  })

  it('preserves time beneath the cursor while zooming', () => {
    const nextScroll = cursorCenteredScroll({
      currentZoom: 20,
      currentScroll: 400,
      pointerX: 300,
      nextZoom: 40,
      viewportWidth: 1000,
      duration: 100,
    })

    expect(nextScroll).toBe(1100)
    expect((nextScroll + 300) / 40).toBe((400 + 300) / 20)
  })

  it('clamps cursor-centered scroll at file edges', () => {
    expect(
      cursorCenteredScroll({
        currentZoom: 10,
        currentScroll: 0,
        pointerX: 0,
        nextZoom: 20,
        viewportWidth: 500,
        duration: 50,
      }),
    ).toBe(0)
  })
})
