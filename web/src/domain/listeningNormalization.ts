export interface ListeningRange {
  id: string
  start: number
  end: number
}

export const SPEECH_REFERENCE_TARGET_LUFS = -23
export const MAX_LISTENING_GAIN_DB = 40

export function normalizeListeningRanges(
  ranges: readonly ListeningRange[],
  duration: number,
): ListeningRange[] {
  const sorted = ranges
    .filter(
      (range) =>
        Number.isFinite(range.start) &&
        Number.isFinite(range.end) &&
        range.start >= 0 &&
        range.end > range.start &&
        range.end <= duration,
    )
    .map((range) => ({ ...range }))
    .sort((a, b) => a.start - b.start)
  const merged: ListeningRange[] = []
  for (const range of sorted) {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end)
      previous.end = Math.max(previous.end, range.end)
    else merged.push(range)
  }
  return merged
}

export function listeningGainDb(
  measuredLufs: number,
  targetLufs: number,
): number | null {
  if (
    !Number.isFinite(measuredLufs) ||
    !Number.isFinite(targetLufs) ||
    targetLufs > 0 ||
    targetLufs < -70
  )
    return null
  const gain = targetLufs - measuredLufs
  return Math.abs(gain) <= MAX_LISTENING_GAIN_DB ? gain : null
}

/** Source sample crossings after gain. These intervals do not measure true peak. */
export function playbackClippingRanges(
  channels: readonly Float32Array[],
  sampleRate: number,
  gainDb: number,
): ListeningRange[] {
  if (!channels.length || !(sampleRate > 0) || !Number.isFinite(gainDb))
    return []
  const gain = 10 ** (gainDb / 20)
  const length = channels[0]?.length ?? 0
  const ranges: ListeningRange[] = []
  let start = -1
  // Join crossings within 10 ms to make the visual overlay readable.
  let lastClipped = -1
  for (let frame = 0; frame < length; frame++) {
    let clipped = false
    for (const channel of channels) {
      if (Math.abs((channel[frame] ?? 0) * gain) >= 1) {
        clipped = true
        break
      }
    }
    if (clipped) {
      if (start < 0) start = frame
      lastClipped = frame
    }
    if (
      start >= 0 &&
      ((!clipped && frame - lastClipped > sampleRate * 0.01) ||
        frame === length - 1)
    ) {
      ranges.push({
        id: `playback-clipping-${start}`,
        start: start / sampleRate,
        end: (lastClipped + 1) / sampleRate,
      })
      start = -1
    }
  }
  return ranges
}
