export type SpectrumResponse = 'fast' | 'balanced' | 'smooth'

export const SPECTRUM_FFT_SIZE = 8192
export const SPECTRUM_MIN_FREQUENCY = 20
export const SPECTRUM_MAX_FREQUENCY = 20_000
export const SPECTRUM_MIN_DB = -100
export const SPECTRUM_MAX_DB = 0

export const PEAK_HOLD_DURATION_MS = 400
export const PEAK_DECAY_DB_PER_SECOND = 12

export const SPECTRUM_RESPONSES: Readonly<
  Record<SpectrumResponse, { label: string; smoothingTimeConstant: number }>
> = {
  fast: { label: 'Fast', smoothingTimeConstant: 0.35 },
  balanced: { label: 'Balanced', smoothingTimeConstant: 0.72 },
  smooth: { label: 'Smooth', smoothingTimeConstant: 0.88 },
}

export const DEFAULT_SPECTRUM_RESPONSE: SpectrumResponse = 'balanced'

export function isSpectrumResponse(value: string): value is SpectrumResponse {
  return value === 'fast' || value === 'balanced' || value === 'smooth'
}

export const FREQUENCY_GRID_HZ = [
  20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000,
] as const

export const DECIBEL_GRID = [0, -12, -24, -48, -72, -96] as const
