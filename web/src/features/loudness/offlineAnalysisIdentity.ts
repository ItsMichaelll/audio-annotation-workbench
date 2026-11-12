import type { LoudnessScope } from './loudnessTypes'

export interface OfflineAnalysisIdentity<TBuffer> {
  buffer: TBuffer | null
  scope: LoudnessScope
  start: number | undefined
  end: number | undefined
}

export function sameOfflineScope<TBuffer>(
  result: OfflineAnalysisIdentity<TBuffer>,
  request: OfflineAnalysisIdentity<TBuffer>,
): boolean {
  return (
    result.buffer === request.buffer &&
    result.scope === request.scope &&
    result.start === request.start &&
    result.end === request.end
  )
}
