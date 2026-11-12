import { describe, expect, it } from 'vitest'
import {
  ANALYSIS_DECODE_SAMPLE_RATE,
  spectrogramFrequencyPosition,
} from './analysisSettings'

describe('spectrogram display scale', () => {
  it('keeps decoded PCM wide-band for source FFT and loudness inspection', () => {
    expect(ANALYSIS_DECODE_SAMPLE_RATE).toBe(48000)
  })
  it('maps linear Nyquist and middle frequency', () => {
    expect(spectrogramFrequencyPosition(24000, 24000, 'linear')).toBe(0)
    expect(spectrogramFrequencyPosition(12000, 24000, 'linear')).toBe(0.5)
  })
  it('clamps frequencies and handles unavailable sample rate', () => {
    expect(spectrogramFrequencyPosition(50000, 24000, 'logarithmic')).toBe(0)
    expect(spectrogramFrequencyPosition(0, 0, 'linear')).toBe(1)
  })
})
