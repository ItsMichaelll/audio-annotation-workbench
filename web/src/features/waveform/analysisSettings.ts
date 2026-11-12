export const SPECTROGRAM_FFT_SIZES = [512, 1024, 2048, 4096] as const
export const SPECTROGRAM_DB_RANGES = [70, 90, 110] as const
/** WaveSurfer otherwise defaults waveform decode to 8 kHz, unsuitable for analysis. */
export const ANALYSIS_DECODE_SAMPLE_RATE = 48_000
export type SpectrogramScale = 'linear' | 'logarithmic'

export function spectrogramFrequencyPosition(
  frequency: number,
  maximum: number,
  scale: SpectrogramScale,
): number {
  if (!(maximum > 0)) return 1
  const bounded = Math.min(maximum, Math.max(0, frequency))
  if (scale === 'linear') return 1 - bounded / maximum
  return 1 - Math.log10(Math.max(1, bounded)) / Math.log10(Math.max(2, maximum))
}
