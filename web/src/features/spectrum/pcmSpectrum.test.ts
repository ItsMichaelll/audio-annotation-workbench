import { describe, expect, it } from 'vitest'
import { pcmSpectrum } from './pcmSpectrum'

describe('paused source spectrum', () => {
  it('retains a 10 kHz source peak above the former 8 kHz waveform-decode Nyquist', () => {
    const rate = 48000
    const size = 8192
    const audio = Float32Array.from(
      { length: rate },
      (_, i) => 0.5 * Math.sin((2 * Math.PI * 10000 * i) / rate),
    )
    const values = pcmSpectrum([audio], rate, 0.5, size)
    let peak = 0
    for (let bin = 1; bin < values.length; bin++)
      if ((values[bin] ?? -Infinity) > (values[peak] ?? -Infinity)) peak = bin
    expect((peak * rate) / size).toBeCloseTo(10000, -1)
  })
  it('locates a bin-centered sine at its calibrated amplitude', () => {
    const rate = 48000
    const size = 4096
    const frequency = (rate * 85) / size
    const audio = Float32Array.from(
      { length: rate },
      (_, i) => 0.5 * Math.sin((2 * Math.PI * frequency * i) / rate),
    )
    const values = pcmSpectrum([audio], rate, 0.5, size)
    expect(values[85]).toBeCloseTo(-6.0206, 2)
    expect(values[85]).toBe(Math.max(...values))
  })
  it('preserves opposite-phase stereo and handles out-of-file silence', () => {
    const audio = Float32Array.from({ length: 4800 }, (_, i) =>
      Math.sin((i * Math.PI) / 4),
    )
    const opposite = audio.map((sample) => -sample)
    expect(pcmSpectrum([audio, opposite], 48000, 0.05, 2048)[256]).toBeCloseTo(
      0,
      2,
    )
    expect(
      pcmSpectrum([audio], 48000, 10, 2048).every(
        (value) => value === -Infinity,
      ),
    ).toBe(true)
  })
  it('rejects unsupported FFT lengths', () => {
    expect(() => pcmSpectrum([], 48000, 0, 33)).toThrow(/power-of-two/)
  })
})
