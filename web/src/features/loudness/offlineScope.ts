import type { LoudnessScope } from './loudnessTypes'

export interface OfflineScopeIdentity<TBuffer> {
  buffer: TBuffer | null
  scope: LoudnessScope
  start: number | undefined
  end: number | undefined
}

export function sameOfflineScope<TBuffer>(
  result: OfflineScopeIdentity<TBuffer>,
  request: OfflineScopeIdentity<TBuffer>,
): boolean {
  return (
    result.buffer === request.buffer &&
    result.scope === request.scope &&
    result.start === request.start &&
    result.end === request.end
  )
}
