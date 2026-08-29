import { useEffect, useRef, useState } from 'react'
import type { RegionMetadata } from '../../domain/region'
import { analyzeAudioBuffer } from './offlineLoudness'
import type { LoudnessScope, OfflineAnalysisState } from './loudnessTypes'

export function useOfflineLoudness(
  enabled: boolean,
  buffer: AudioBuffer | null,
  scope: LoudnessScope,
  selectedRegion: RegionMetadata | null,
): OfflineAnalysisState {
  const generationRef = useRef(0)
  const [state, setState] = useState<OfflineAnalysisState>({ status: 'idle' })

  useEffect(() => {
    const generation = ++generationRef.current
    if (!enabled || !buffer || (scope === 'selection' && !selectedRegion))
      return
    const timer = window.setTimeout(
      () => {
        setState({ status: 'analyzing' })
        void analyzeAudioBuffer(
          buffer,
          scope === 'selection' ? selectedRegion : null,
        )
          .then((statistics) => {
            if (generationRef.current === generation)
              setState({ status: 'ready', statistics })
          })
          .catch((error: unknown) => {
            if (generationRef.current !== generation) return
            const message =
              error instanceof Error && error.message
                ? error.message
                : 'Offline loudness analysis failed.'
            setState({ status: 'error', message })
          })
      },
      scope === 'selection' ? 180 : 0,
    )
    return () => window.clearTimeout(timer)
  }, [buffer, enabled, scope, selectedRegion])

  if (!enabled || !buffer) return { status: 'idle' }
  if (scope === 'selection' && !selectedRegion) {
    return {
      status: 'unavailable',
      message: 'Select a region to analyze this scope.',
    }
  }
  return state
}
