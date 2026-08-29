import { describe, expect, it } from 'vitest'
import {
  MEASUREMENT_STEP_SECONDS,
  MOMENTARY_WINDOW_SECONDS,
  measurementWindowFrames,
  SHORT_TERM_WINDOW_SECONDS,
} from './measurementConfig'

describe('EBU measurement windows', () => {
  it('uses a 400 ms momentary window and 100 ms step', () => {
    expect(MOMENTARY_WINDOW_SECONDS).toBe(0.4)
    expect(MEASUREMENT_STEP_SECONDS).toBe(0.1)
    expect(measurementWindowFrames(48_000, MOMENTARY_WINDOW_SECONDS)).toBe(
      19_200,
    )
  })

  it('uses a three-second short-term window', () => {
    expect(SHORT_TERM_WINDOW_SECONDS).toBe(3)
    expect(measurementWindowFrames(44_100, SHORT_TERM_WINDOW_SECONDS)).toBe(
      132_300,
    )
  })

  it('rejects invalid window inputs', () => {
    expect(measurementWindowFrames(0, 0.4)).toBe(0)
    expect(measurementWindowFrames(48_000, -1)).toBe(0)
  })
})
