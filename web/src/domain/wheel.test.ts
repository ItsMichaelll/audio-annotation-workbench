import { describe, expect, it } from 'vitest'
import { clampedWheelScroll, shiftWheelMode } from './wheel'

describe('Shift+wheel behavior', () => {
  it('uses selection state alone to choose between panning and movement', () => {
    expect(shiftWheelMode(null)).toBe('pan')
    expect(shiftWheelMode('selected-region')).toBe('move-region')
  })

  it('keeps waveform panning within the true scroll bounds', () => {
    expect(clampedWheelScroll(40, 15, 100)).toBe(55)
    expect(clampedWheelScroll(5, -20, 100)).toBe(0)
    expect(clampedWheelScroll(95, 20, 100)).toBe(100)
  })
})
