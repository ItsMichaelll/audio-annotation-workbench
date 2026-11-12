import { useEffect, useRef, useState } from 'react'
import type { RegionMetadata } from '../../domain/region'
import { analyzeAudioBuffer } from './offlineLoudness'
import type { LoudnessScope, OfflineAnalysisState } from './loudnessTypes'
import { sameOfflineScope } from './offlineScope'

export function useOfflineLoudness(
  enabled: boolean,
  buffer: AudioBuffer | null,
  scope: LoudnessScope,
  selectedRegion: RegionMetadata | null,
): OfflineAnalysisState {
  const generationRef = useRef(0)
  const start = scope !== 'file' ? selectedRegion?.start : undefined
  const end = scope !== 'file' ? selectedRegion?.end : undefined
  const [result, setResult] = useState<{
    buffer: AudioBuffer | null
    scope: LoudnessScope
    start: number | undefined
    end: number | undefined
    state: OfflineAnalysisState
  }>({
    buffer: null,
    scope: 'file',
    start: undefined,
    end: undefined,
    state: { status: 'idle' },
  })

  useEffect(() => {
    const generation = ++generationRef.current
    if (
      !enabled ||
      !buffer ||
      (scope !== 'file' && (start === undefined || end === undefined))
    )
      return
    const publish = (state: OfflineAnalysisState) => {
      if (generationRef.current === generation)
        setResult({ buffer, scope, start, end, state })
    }
    const timer = window.setTimeout(
      () => {
        publish({ status: 'analyzing' })
        void analyzeAudioBuffer(
          buffer,
          start !== undefined && end !== undefined ? { start, end } : null,
        )
          .then((statistics) => {
            if (generationRef.current === generation)
              publish({ status: 'ready', statistics })
          })
          .catch((error: unknown) => {
            if (generationRef.current !== generation) return
            const message =
              error instanceof Error && error.message
                ? error.message
                : 'Offline loudness analysis failed.'
            publish({ status: 'error', message })
          })
      },
      scope !== 'file' ? 180 : 0,
    )
    return () => {
      window.clearTimeout(timer)
      generationRef.current += 1
    }
  }, [buffer, enabled, scope, start, end])

  if (!enabled || !buffer) return { status: 'idle' }
  if (scope !== 'file' && !selectedRegion) {
    return {
      status: 'unavailable',
      message:
        scope === 'range'
          ? 'The active review range is unavailable.'
          : 'Select a region to analyze this scope.',
    }
  }
  if (!sameOfflineScope(result, { buffer, scope, start, end })) {
    return { status: 'analyzing' }
  }
  return result.state
}
