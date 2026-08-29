import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SPECTRUM_RESPONSE,
  SPECTRUM_FFT_SIZE,
  SPECTRUM_RESPONSES,
} from './spectrumConfig'

describe('spectrum response configuration', () => {
  it('uses the balanced response by default', () => {
    expect(DEFAULT_SPECTRUM_RESPONSE).toBe('balanced')
    expect(SPECTRUM_FFT_SIZE).toBe(8_192)
  })

  it('orders presets from most responsive to smoothest', () => {
    expect(SPECTRUM_RESPONSES.fast.smoothingTimeConstant).toBeLessThan(
      SPECTRUM_RESPONSES.balanced.smoothingTimeConstant,
    )
    expect(SPECTRUM_RESPONSES.balanced.smoothingTimeConstant).toBeLessThan(
      SPECTRUM_RESPONSES.smooth.smoothingTimeConstant,
    )
  })
})
