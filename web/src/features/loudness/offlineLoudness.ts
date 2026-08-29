import LoudnessNode, { type LoudnessSnapshot } from 'loudness-worklet'
import { LOUDNESS_WORKLET_URL } from '../analysis/useAnalysisAudio'
import {
  peakToLoudnessRatio,
  peakToShortTermRatio,
  resolveScopeBounds,
} from './loudnessMath'
import type { LoudnessStatistics } from './loudnessTypes'

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
  const loudness = new LoudnessNode(context, { interval: 0.05 })
  let latest: LoudnessSnapshot | null = null
  loudness.port.onmessage = (event: MessageEvent<unknown>) => {
    latest = snapshotFromMessage(event.data) ?? latest
  }
  source.connect(loudness).connect(context.destination)
  source.start(
    0,
    bounds.startFrame / buffer.sampleRate,
    scopeFrames / buffer.sampleRate,
  )
  await context.startRendering()
  loudness.port.close()
  source.disconnect()
  loudness.disconnect()
  if (!latest)
    throw new Error('The offline loudness processor returned no measurements.')
  const snapshot: LoudnessSnapshot = latest
  const shortTermAvailable = scopeFrames >= 3 * buffer.sampleRate
  const lraAvailable =
    shortTermAvailable && Number.isFinite(snapshot.loudnessRange)
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
