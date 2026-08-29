export interface SpectrogramViewportGeometry {
  contentWidth: number
  scrollLeft: number
}

export function spectrogramViewportGeometry(
  waveformScrollWidth: number,
  waveformClientWidth: number,
  waveformScrollLeft: number,
): SpectrogramViewportGeometry {
  const clientWidth = Number.isFinite(waveformClientWidth)
    ? Math.max(0, waveformClientWidth)
    : 0
  const contentWidth = Number.isFinite(waveformScrollWidth)
    ? Math.max(clientWidth, waveformScrollWidth)
    : clientWidth
  const requestedScroll = Number.isFinite(waveformScrollLeft)
    ? waveformScrollLeft
    : 0

  return {
    contentWidth,
    scrollLeft: Math.min(
      Math.max(requestedScroll, 0),
      contentWidth - clientWidth,
    ),
  }
}

export function logarithmicFrequencyY(
  frequency: number,
  maxFrequency: number,
): number {
  if (
    !Number.isFinite(frequency) ||
    !Number.isFinite(maxFrequency) ||
    frequency <= 0 ||
    maxFrequency <= 1
  ) {
    return Number.NaN
  }

  const clampedFrequency = Math.min(Math.max(frequency, 1), maxFrequency)
  return 1 - Math.log10(clampedFrequency) / Math.log10(maxFrequency)
}
