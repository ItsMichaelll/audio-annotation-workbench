export type LoudnessScope = 'file' | 'selection'

export interface LoudnessStatistics {
  integratedLoudness: number
  loudnessRange: number
  maximumMomentaryLoudness: number
  maximumShortTermLoudness: number
  maximumTruePeakLevel: number
  psr: number
  plr: number
  shortTermAvailable: boolean
  lraAvailable: boolean
}

export type OfflineAnalysisState =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; statistics: LoudnessStatistics }
