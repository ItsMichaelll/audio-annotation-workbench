import { describe, expect, it } from 'vitest'
import { displayAmplitude, plainWheelPans } from './waveformDisplay'

describe('display-only waveform amplitude', () => {
  it('keeps AAW wheel zoom and enables trackpad pan with command-wheel zoom', () => {
    expect(plainWheelPans('aaw', false)).toBe(false)
    expect(plainWheelPans('trackpad', false)).toBe(true)
    expect(plainWheelPans('trackpad', true)).toBe(false)
  })
  it('preserves sign, zero and unity for both scales', () => {
    for (const scale of ['linear', 'logarithmic'] as const) {
      expect(displayAmplitude(0, scale)).toBe(0)
      expect(displayAmplitude(1, scale)).toBeCloseTo(1)
      expect(displayAmplitude(-1, scale)).toBeCloseTo(-1)
    }
  })
  it('expands quiet display samples without touching source buffers', () => {
    expect(displayAmplitude(0.01, 'logarithmic')).toBeGreaterThan(0.01)
    expect(displayAmplitude(NaN, 'linear')).toBe(0)
  })
})
