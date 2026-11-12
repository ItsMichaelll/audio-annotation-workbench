import type { LoudnessSnapshot } from 'loudness-worklet'

/** loudness-worklet 2.x processes Web Audio's current 128-frame render quantum. */
export const LOUDNESS_RENDER_QUANTUM_FRAMES = 128

export function snapshotIsInitialized(snapshot: LoudnessSnapshot): boolean {
  // Non-shared LoudnessNode views are zero-filled until their first port update.
  return !(
    snapshot.currentFrame === 0 &&
    snapshot.currentTime === 0 &&
    snapshot.momentaryLoudness === 0 &&
    snapshot.shortTermLoudness === 0 &&
    snapshot.integratedLoudness === 0
  )
}

export function snapshotFitsScope(
  snapshot: LoudnessSnapshot,
  scopeFrames: number,
): boolean {
  return (
    Number.isFinite(snapshot.currentFrame) &&
    snapshot.currentFrame >= 0 &&
    snapshot.currentFrame + LOUDNESS_RENDER_QUANTUM_FRAMES <= scopeFrames
  )
}

export function mergeOfflineScopeSnapshot(
  scope: LoudnessSnapshot,
  maximumTruePeakLevel: number,
): LoudnessSnapshot {
  // The flush tail contributes exclusively to the FIR's maximum true peak.
  return { ...scope, maximumTruePeakLevel }
}
