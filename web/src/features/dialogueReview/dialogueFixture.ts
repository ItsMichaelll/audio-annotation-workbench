import type { DialogueReviewInput } from '../../domain/dialogueReview'

export const SYNTHETIC_DIALOGUE_REVIEW: DialogueReviewInput = {
  schemaVersion: 1,
  sessionId: 'synthetic-dialogue',
  exportId: 'synthetic-export-v1',
  handoffId: 'synthetic-pair',
  title: 'Paired timing review · generated fixture',
  activeRange: { start: 0, end: 12 },
  tracks: [
    {
      id: 'track-a',
      sourceId: 'synthetic-a-v1',
      name: 'Speaker A',
      offsetSeconds: 0,
    },
    {
      id: 'track-b',
      sourceId: 'synthetic-b-v1',
      name: 'Speaker B',
      offsetSeconds: 0,
    },
  ],
  proposals: [
    {
      id: 'handoff-one',
      trackId: 'track-b',
      original: { start: 3.2, end: 4.8 },
      proposed: { start: 3, end: 4.6 },
      shiftSeconds: -0.2,
      provenance: 'Synthetic timing proposal',
    },
    {
      id: 'handoff-two',
      trackId: 'track-b',
      original: { start: 7.4, end: 9 },
      proposed: { start: 7.55, end: 9.15 },
      shiftSeconds: 0.15,
      provenance: 'Synthetic timing proposal',
    },
  ],
}

export function createSyntheticDialogueBuffers(
  context: AudioContext,
): readonly [AudioBuffer, AudioBuffer] {
  const rate = 48000
  const buffers = [
    context.createBuffer(1, rate * 12, rate),
    context.createBuffer(1, rate * 12, rate),
  ] as const
  for (let track = 0; track < buffers.length; track++) {
    const buffer = buffers[track]
    if (!buffer) continue
    const samples = buffer.getChannelData(0)
    const ranges =
      track === 0
        ? [
            [0.8, 2.7],
            [5, 7],
            [9.5, 11.2],
          ]
        : [
            [3.2, 4.8],
            [7.4, 9],
          ]
    for (let frame = 0; frame < samples.length; frame++) {
      const time = frame / rate
      let envelope = 0
      for (const range of ranges) {
        const start = range[0] ?? 0
        const end = range[1] ?? 0
        if (time >= start && time < end)
          envelope = Math.min(1, (time - start) / 0.025, (end - time) / 0.04)
      }
      const frequency = track === 0 ? 180 : 270
      samples[frame] =
        envelope *
        0.12 *
        (Math.sin(2 * Math.PI * frequency * time) +
          0.25 * Math.sin(2 * Math.PI * frequency * 3 * time))
    }
  }
  return buffers
}

/** Visual-only aligned PCM. Original source buffers remain unchanged. */
export function alignedWaveformWav(
  buffer: AudioBuffer,
  offsetSeconds: number,
  duration: number,
): ArrayBuffer {
  const rate = buffer.sampleRate
  const frames = Math.ceil(duration * rate)
  const channelCount = buffer.numberOfChannels
  const bytes = frames * channelCount * 2
  const wav = new ArrayBuffer(44 + bytes)
  const view = new DataView(wav)
  const text = (position: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(position + index, value.charCodeAt(index))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * channelCount * 2, true)
  view.setUint16(32, channelCount * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, bytes, true)
  const shiftFrames = Math.round(offsetSeconds * rate)
  const channels = Array.from({ length: channelCount }, (_, channel) =>
    buffer.getChannelData(channel),
  )
  for (let frame = 0; frame < frames; frame++) {
    const sourceFrame = frame - shiftFrames
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = channels[channel]?.[sourceFrame] ?? 0
      view.setInt16(
        44 + (frame * channelCount + channel) * 2,
        Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
        true,
      )
    }
  }
  return wav
}
