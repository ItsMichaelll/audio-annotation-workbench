import LoudnessNode, { type LoudnessSnapshot } from 'loudness-worklet'
import { LOUDNESS_WORKLET_URL } from '../analysis/useAnalysisAudio'
import {
  peakToLoudnessRatio,
  peakToShortTermRatio,
  resolveScopeBounds,
} from './loudnessMath'
import type { LoudnessStatistics } from './loudnessTypes'
import {
  LOUDNESS_RENDER_QUANTUM_FRAMES,
  mergeOfflineScopeSnapshot,
  snapshotFitsScope,
  snapshotIsInitialized,
} from './offlineScope'

const TAIL_SECONDS = 0.12

function snapshotFromMessage(data: unknown): LoudnessSnapshot | null {
  if (!Array.isArray(data) || !(data[0] instanceof Float32Array)) return null
  return LoudnessNode.from(data[0])
}

export async function analyzeAudioBuffer(
  buffer: AudioBuffer,
  selection?: { start: number; end: number } | null,
): Promise<LoudnessStatistics> {
  if (buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2) {
    throw new Error(
      'Offline loudness analysis currently supports mono and stereo audio.',
    )
  }
  const bounds = resolveScopeBounds(buffer.sampleRate, buffer.length, selection)
  if (!bounds) throw new Error('The selected analysis scope is empty.')
  const scopeFrames = bounds.endFrame - bounds.startFrame
  const tailFrames = Math.ceil(TAIL_SECONDS * buffer.sampleRate)
  const context = new OfflineAudioContext(
    buffer.numberOfChannels,
    scopeFrames + tailFrames,
    buffer.sampleRate,
  )
  await context.audioWorklet.addModule(LOUDNESS_WORKLET_URL)
  const source = new AudioBufferSourceNode(context, { buffer })
  // Observe each quantum so the scope's final 100 ms gate update cannot be missed.
  const loudness = new LoudnessNode(context, {
    interval: 1 / buffer.sampleRate,
  })
  // An ended source can produce an empty worklet input rather than zero samples.
  // Keep the channel layout active so the FIR processes its silent flush tail.
  const silentInput = new AudioBufferSourceNode(context, {
    buffer: new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: LOUDNESS_RENDER_QUANTUM_FRAMES,
      sampleRate: buffer.sampleRate,
    }),
    loop: true,
  })
  silentInput.connect(loudness)
  silentInput.start(0)
  let scoped: LoudnessSnapshot | null = null
  let maximumTruePeak = Number.NEGATIVE_INFINITY
  let finalMessage: (() => void) | undefined
  const finalMessageReceived = new Promise<void>((resolve) => {
    finalMessage = resolve
  })
  const finalQuantumFrame =
    (Math.ceil(context.length / LOUDNESS_RENDER_QUANTUM_FRAMES) - 1) *
    LOUDNESS_RENDER_QUANTUM_FRAMES
  const readSnapshot = (snapshot: LoudnessSnapshot) => {
    if (!snapshotIsInitialized(snapshot)) return
    if (
      snapshotFitsScope(snapshot, scopeFrames) &&
      (!scoped || snapshot.currentFrame >= scoped.currentFrame)
    )
      scoped = snapshot
    maximumTruePeak = Math.max(maximumTruePeak, snapshot.maximumTruePeakLevel)
    if (snapshot.currentFrame >= finalQuantumFrame) finalMessage?.()
  }
  loudness.port.onmessage = (event: MessageEvent<unknown>) => {
    const snapshot = snapshotFromMessage(event.data)
    if (snapshot) readSnapshot(snapshot)
  }
  source.connect(loudness).connect(context.destination)
  source.start(
    0,
    bounds.startFrame / buffer.sampleRate,
    scopeFrames / buffer.sampleRate,
  )
  const values = new Float32Array(loudness.metricCount)
  const completedScopeFrames =
    Math.floor(scopeFrames / LOUDNESS_RENDER_QUANTUM_FRAMES) *
    LOUDNESS_RENDER_QUANTUM_FRAMES
  // A suspended context gives shared-memory hosts a sample-boundary snapshot too.
  const scopeSuspension =
    completedScopeFrames > 0
      ? context
          // Web Audio quantizes suspend times upward to the render boundary.
          .suspend((completedScopeFrames - 0.5) / buffer.sampleRate)
          .then(async () => {
            loudness.getFloatLoudnessData(values)
            readSnapshot(LoudnessNode.from(values))
            await context.resume()
          })
      : Promise.resolve()
  let messageTimeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.all([context.startRendering(), scopeSuspension])
    if (!globalThis.crossOriginIsolated) {
      await Promise.race([
        finalMessageReceived,
        new Promise<never>((_resolve, reject) => {
          messageTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  'The offline loudness processor did not deliver its final measurement.',
                ),
              ),
            5000,
          )
        }),
      ])
    }
    loudness.getFloatLoudnessData(values)
    readSnapshot(LoudnessNode.from(values))
  } finally {
    clearTimeout(messageTimeout)
    loudness.port.close()
    source.disconnect()
    silentInput.disconnect()
    loudness.disconnect()
  }
  if (!scoped)
    throw new Error(
      'The scope is too short for a complete loudness processing quantum.',
    )
  const snapshot: LoudnessSnapshot = mergeOfflineScopeSnapshot(
    scoped,
    maximumTruePeak,
  )
  const shortTermAvailable = scopeFrames >= 3 * buffer.sampleRate
  const lraAvailable =
    shortTermAvailable &&
    Number.isFinite(snapshot.integratedLoudness) &&
    Number.isFinite(snapshot.loudnessRange)
  return {
    integratedLoudness: snapshot.integratedLoudness,
    loudnessRange: snapshot.loudnessRange,
    maximumMomentaryLoudness: snapshot.maximumMomentaryLoudness,
    maximumShortTermLoudness: snapshot.maximumShortTermLoudness,
    maximumTruePeakLevel: snapshot.maximumTruePeakLevel,
    psr: peakToShortTermRatio(
      snapshot.maximumTruePeakLevel,
      snapshot.maximumShortTermLoudness,
    ),
    plr: peakToLoudnessRatio(
      snapshot.maximumTruePeakLevel,
      snapshot.integratedLoudness,
    ),
    shortTermAvailable,
    lraAvailable,
  }
}
