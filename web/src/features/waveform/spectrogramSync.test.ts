import { describe, expect, it } from 'vitest'
import {
  logarithmicFrequencyY,
  spectrogramViewportGeometry,
} from './spectrogramSync'

describe('spectrogram viewport synchronization', () => {
  it('matches the waveform content width and scroll offset', () => {
    expect(spectrogramViewportGeometry(12_000, 1_000, 4_250)).toEqual({
      contentWidth: 12_000,
      scrollLeft: 4_250,
    })
  })

  it('clamps scroll and never makes content narrower than the viewport', () => {
    expect(spectrogramViewportGeometry(800, 1_000, 500)).toEqual({
      contentWidth: 1_000,
      scrollLeft: 0,
    })
    expect(spectrogramViewportGeometry(3_000, 1_000, 9_000)).toEqual({
      contentWidth: 3_000,
      scrollLeft: 2_000,
    })
  })

  it('uses the same logarithmic vertical mapping as the spectrogram', () => {
    expect(logarithmicFrequencyY(24_000, 24_000)).toBe(0)
    expect(logarithmicFrequencyY(1, 24_000)).toBe(1)
    expect(logarithmicFrequencyY(1_000, 24_000)).toBeGreaterThan(0)
    expect(logarithmicFrequencyY(1_000, 24_000)).toBeLessThan(1)
    expect(logarithmicFrequencyY(0, 24_000)).toBeNaN()
  })
})
