import { describe, expect, it } from 'vitest'
import type { LoudnessSnapshot } from 'loudness-worklet'
import {
  mergeOfflineScopeSnapshot,
  snapshotFitsScope,
  snapshotIsInitialized,
} from './offlineScope'

function snapshot(frame: number): LoudnessSnapshot {
  return {
    currentFrame: frame,
    currentTime: frame / 48000,
    integratedLoudness: -23,
    momentaryLoudness: -23,
    shortTermLoudness: -23,
    loudnessRange: 2,
    maximumMomentaryLoudness: -22,
    maximumShortTermLoudness: -22.5,
    maximumTruePeakLevel: -3,
  }
}

describe('offline scope quantum boundaries', () => {
  it('rejects uninitialized zero-filled main-thread views without rejecting true silence', () => {
    expect(
      snapshotIsInitialized({
        ...snapshot(0),
        momentaryLoudness: 0,
        shortTermLoudness: 0,
        integratedLoudness: 0,
      }),
    ).toBe(false)
    expect(
      snapshotIsInitialized({
        ...snapshot(0),
        momentaryLoudness: -Infinity,
        shortTermLoudness: -Infinity,
        integratedLoudness: -Infinity,
        maximumTruePeakLevel: -Infinity,
      }),
    ).toBe(true)
  })
  it('includes the exact 400 ms and three-second terminal quantum at 48 kHz', () => {
    expect(snapshotFitsScope(snapshot(19200 - 128), 19200)).toBe(true)
    expect(snapshotFitsScope(snapshot(144000 - 128), 144000)).toBe(true)
    expect(snapshotFitsScope(snapshot(19200), 19200)).toBe(false)
  })
  it('rejects a quantum padded beyond a fractional scope boundary', () => {
    expect(snapshotFitsScope(snapshot(19200), 19201)).toBe(false)
    expect(snapshotFitsScope(snapshot(19200 - 128), 19201)).toBe(true)
  })
  it('bounds 44.1 kHz truncation to less than one render quantum', () => {
    const scopeFrames = 44100 * 0.4
    const completeFrames = Math.floor(scopeFrames / 128) * 128
    expect(scopeFrames - completeFrames).toBeLessThan(128)
    expect(snapshotFitsScope(snapshot(completeFrames - 128), scopeFrames)).toBe(
      true,
    )
    expect(snapshotFitsScope(snapshot(completeFrames), scopeFrames)).toBe(false)
  })
  it('takes only true peak from flushing while retaining all scoped loudness fields', () => {
    const scope = snapshot(19200 - 128)
    expect(mergeOfflineScopeSnapshot(scope, -2.8)).toEqual({
      ...scope,
      maximumTruePeakLevel: -2.8,
    })
    expect(scope.maximumTruePeakLevel).toBe(-3)
  })
})
