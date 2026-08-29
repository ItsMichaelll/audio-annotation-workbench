import { describe, expect, it } from 'vitest'
import {
  combineChannelEnergy,
  energyToLufs,
  gatedIntegratedLoudness,
  loudnessRange,
  lufsToEnergy,
  maximumFinite,
  peakToLoudnessRatio,
  peakToShortTermRatio,
  resolveScopeBounds,
  validateTargetRange,
} from './loudnessMath'

describe('loudness math', () => {
  it('converts mean-square energy to LUFS and preserves digital silence', () => {
    expect(energyToLufs(1)).toBeCloseTo(-0.691, 6)
    expect(energyToLufs(0)).toBe(Number.NEGATIVE_INFINITY)
    expect(lufsToEnergy(energyToLufs(0.125))).toBeCloseTo(0.125, 8)
  })

  it('aggregates mono and stereo channel energies without averaging channels', () => {
    expect(combineChannelEnergy([0.1])).toBeCloseTo(0.1)
    expect(combineChannelEnergy([0.1, 0.1])).toBeCloseTo(0.2)
  })

  it('applies the integrated absolute gate', () => {
    const audible = lufsToEnergy(-30)
    expect(gatedIntegratedLoudness([lufsToEnergy(-80), audible])).toBeCloseTo(
      -30,
      6,
    )
    expect(gatedIntegratedLoudness([0, lufsToEnergy(-80)])).toBe(
      Number.NEGATIVE_INFINITY,
    )
  })

  it('applies the integrated relative gate', () => {
    const result = gatedIntegratedLoudness([
      lufsToEnergy(-20),
      lufsToEnergy(-20),
      lufsToEnergy(-45),
    ])
    expect(result).toBeCloseTo(-20, 3)
  })

  it('calculates LRA from the gated 10th and 95th percentiles', () => {
    const values = Array.from({ length: 20 }, (_, index) => -30 + index)
    expect(loudnessRange(values)).toBeGreaterThan(10)
    expect(Number.isNaN(loudnessRange([]))).toBe(true)
  })

  it('calculates PSR and PLR using their distinct loudness references', () => {
    expect(peakToShortTermRatio(-1, -14)).toBe(13)
    expect(peakToLoudnessRatio(-1, -23)).toBe(22)
  })

  it('resolves complete-file and clamped selected-region bounds', () => {
    expect(resolveScopeBounds(48_000, 480_000)).toEqual({
      startFrame: 0,
      endFrame: 480_000,
    })
    expect(resolveScopeBounds(48_000, 480_000, { start: -1, end: 12 })).toEqual(
      { startFrame: 0, endFrame: 480_000 },
    )
    expect(resolveScopeBounds(48_000, 480_000, { start: 2, end: 1 })).toBeNull()
  })

  it('validates optional target ranges without imposing a default target', () => {
    expect(
      validateTargetRange({ enabled: true, target: -23, tolerance: 1 }),
    ).toBeNull()
    expect(
      validateTargetRange({ enabled: true, target: 2, tolerance: 1 }),
    ).toMatch(/Target/)
    expect(
      validateTargetRange({ enabled: true, target: -23, tolerance: 0 }),
    ).toMatch(/Tolerance/)
  })

  it('finds maxima without turning silence into a finite value', () => {
    expect(maximumFinite([-20, Number.NEGATIVE_INFINITY, -10])).toBe(-10)
    expect(maximumFinite([])).toBe(Number.NEGATIVE_INFINITY)
  })
})
