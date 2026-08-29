import { describe, expect, it } from 'vitest'
import {
  COARSE_STEP_SECONDS,
  FINE_STEP_SECONDS,
  arrowStep,
  clampTime,
  movePlayhead,
} from './transport'

describe('transport calculations', () => {
  it('clamps playhead time to valid audio bounds', () => {
    expect(clampTime(-4, 12)).toBe(0)
    expect(clampTime(30, 12)).toBe(12)
    expect(clampTime(3.25, 12)).toBe(3.25)
    expect(clampTime(Number.NaN, 12)).toBe(0)
  })

  it('uses fine and coarse arrow increments', () => {
    expect(arrowStep(false)).toBe(FINE_STEP_SECONDS)
    expect(arrowStep(true)).toBe(COARSE_STEP_SECONDS)
    expect(movePlayhead(1, -FINE_STEP_SECONDS, 5)).toBeCloseTo(0.95)
    expect(movePlayhead(4.9, COARSE_STEP_SECONDS, 5)).toBe(5)
  })
})
