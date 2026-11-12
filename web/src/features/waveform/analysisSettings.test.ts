import { describe, expect, it } from 'vitest'
import { spectrogramFrequencyPosition } from './analysisSettings'

describe('spectrogram display scale', () => {
  it('maps linear Nyquist and middle frequency', () => {
    expect(spectrogramFrequencyPosition(24000, 24000, 'linear')).toBe(0)
    expect(spectrogramFrequencyPosition(12000, 24000, 'linear')).toBe(0.5)
  })
  it('clamps frequencies and handles unavailable sample rate', () => {
    expect(spectrogramFrequencyPosition(50000, 24000, 'logarithmic')).toBe(0)
    expect(spectrogramFrequencyPosition(0, 0, 'linear')).toBe(1)
  })
})
