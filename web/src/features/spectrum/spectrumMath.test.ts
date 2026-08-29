import { describe, expect, it } from 'vitest'
import {
  aggregateLogFrequencyBins,
  dbToY,
  displayMaxFrequency,
  fftBinFrequency,
  frequencyToX,
  resetPeakHold,
  updatePeakHold,
  xToFrequency,
} from './spectrumMath'

describe('spectrum coordinate mapping', () => {
  it('maps frequency to a logarithmic x coordinate', () => {
    expect(frequencyToX(20, 1_000, 20, 20_000)).toBe(0)
    expect(frequencyToX(20_000, 1_000, 20, 20_000)).toBe(1_000)
    expect(frequencyToX(200, 1_000, 20, 20_000)).toBeCloseTo(1_000 / 3)
  })

  it('inverts logarithmic x coordinates', () => {
    const x = frequencyToX(1_000, 940, 20, 20_000)
    expect(xToFrequency(x, 940, 20, 20_000)).toBeCloseTo(1_000)
  })

  it('maps the decibel range vertically', () => {
    expect(dbToY(0, 200)).toBe(0)
    expect(dbToY(-48, 200)).toBe(96)
    expect(dbToY(-100, 200)).toBe(200)
  })

  it('clamps the display maximum to Nyquist', () => {
    expect(displayMaxFrequency(48_000)).toBe(20_000)
    expect(displayMaxFrequency(32_000)).toBe(16_000)
    expect(displayMaxFrequency(Number.NaN)).toBe(0)
  })

  it('calculates FFT-bin frequencies', () => {
    expect(fftBinFrequency(1_024, 48_000, 8_192)).toBe(6_000)
    expect(fftBinFrequency(-1, 48_000, 8_192)).toBeNaN()
  })
})

describe('logarithmic pixel-bin aggregation', () => {
  it('preserves a narrow peak near its logarithmic position', () => {
    const fftSize = 8_192
    const sampleRate = 48_000
    const input = new Float32Array(fftSize / 2)
    input.fill(-100)
    const peakBin = Math.round((1_000 * fftSize) / sampleRate)
    input[peakBin] = -6
    const output = new Float32Array(1_000)

    expect(
      aggregateLogFrequencyBins(input, output, sampleRate, fftSize, 20, 20_000),
    ).toBe(true)

    const expectedColumn = Math.round(
      frequencyToX(1_000, output.length, 20, 20_000),
    )
    const nearbyPeak = Math.max(
      ...output.slice(expectedColumn - 2, expectedColumn + 3),
    )
    expect(nearbyPeak).toBeGreaterThan(-7)
  })

  it('places 100 Hz, 1 kHz, and 10 kHz peaks at their logarithmic columns', () => {
    const fftSize = 8_192
    const sampleRate = 48_000
    const frequencies = [100, 1_000, 10_000]
    const input = new Float32Array(fftSize / 2)
    const output = new Float32Array(1_000)
    input.fill(-100)

    for (const frequency of frequencies) {
      input[Math.round((frequency * fftSize) / sampleRate)] = -9
    }

    expect(
      aggregateLogFrequencyBins(input, output, sampleRate, fftSize, 20, 20_000),
    ).toBe(true)

    for (const frequency of frequencies) {
      const expectedColumn = Math.round(
        frequencyToX(frequency, output.length, 20, 20_000),
      )
      expect(
        Math.max(...output.slice(expectedColumn - 2, expectedColumn + 3)),
      ).toBeGreaterThan(-10)
    }
  })

  it('handles invalid or empty ranges without stale output', () => {
    const output = new Float32Array([1, 2, 3])
    expect(
      aggregateLogFrequencyBins(
        new Float32Array(),
        output,
        48_000,
        8_192,
        20,
        20_000,
      ),
    ).toBe(false)
    expect(Array.from(output)).toEqual([-100, -100, -100])

    expect(frequencyToX(1_000, 0, 20, 20_000)).toBeNaN()
    expect(xToFrequency(10, 100, 20_000, 20)).toBeNaN()
  })
})

describe('peak hold', () => {
  it('holds a peak before decay begins', () => {
    const live = new Float32Array([-20])
    const peaks = new Float32Array([-100])
    const holdUntil = new Float64Array(1)

    updatePeakHold(live, peaks, holdUntil, 1_000, 16, 400, 12)
    live[0] = -40
    updatePeakHold(live, peaks, holdUntil, 1_300, 300, 400, 12)

    expect(peaks[0]).toBe(-20)
  })

  it('decays smoothly after the hold interval', () => {
    const live = new Float32Array([-60])
    const peaks = new Float32Array([-20])
    const holdUntil = new Float64Array([1_400])

    updatePeakHold(live, peaks, holdUntil, 1_900, 500, 400, 12)
    expect(peaks[0]).toBe(-26)
  })

  it('resets held values and timestamps', () => {
    const peaks = new Float32Array([-4, -8])
    const holdUntil = new Float64Array([400, 500])
    resetPeakHold(peaks, holdUntil)
    expect(Array.from(peaks)).toEqual([-100, -100])
    expect(Array.from(holdUntil)).toEqual([0, 0])
  })
})
