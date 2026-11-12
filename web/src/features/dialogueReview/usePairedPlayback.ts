import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DialogueReviewInput,
  ReviewRange,
} from '../../domain/dialogueReview'
import {
  PairedAudioEngine,
  type PairedPlaybackTrack,
} from './PairedAudioEngine'
import { createSyntheticDialogueBuffers } from './dialogueFixture'
import type { LoudnessSnapshot } from 'loudness-worklet'

export interface DialogueAudioSource {
  sourceId: string
  file?: File
  /** A browser-readable URL served by the host's local Python service. */
  url?: string
}

export function usePairedPlayback(
  input: DialogueReviewInput,
  sources?: readonly DialogueAudioSource[],
  meterVisible = false,
) {
  const engineRef = useRef<PairedAudioEngine | null>(null)
  const initializationRef = useRef<Promise<void> | null>(null)
  const generationRef = useRef(0)
  const [buffers, setBuffers] = useState<
    readonly [AudioBuffer, AudioBuffer] | null
  >(null)
  const [state, setState] = useState({
    time: input.activeRange.start,
    playing: false,
    rate: 1,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analysers, setAnalysers] = useState<Record<string, AnalyserNode>>({})
  const [liveLoudness, setLiveLoudness] = useState<
    Record<string, LoudnessSnapshot | null>
  >({})
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const meterVisibleRef = useRef(meterVisible)
  useEffect(() => {
    meterVisibleRef.current = meterVisible
    engineRef.current?.setLoudnessEnabled(meterVisible)
  }, [meterVisible])

  const initialize = useCallback(async () => {
    if (engineRef.current) return
    if (initializationRef.current) return initializationRef.current
    const generation = generationRef.current
    const job = (async () => {
      setLoading(true)
      setError(null)
      const context = new AudioContext()
      try {
        await context.resume()
        let decoded: readonly [AudioBuffer, AudioBuffer]
        if (!sources) decoded = createSyntheticDialogueBuffers(context)
        else {
          const decode = async (sourceId: string) => {
            const source = sources.find((item) => item.sourceId === sourceId)
            if (!source)
              throw new Error(
                `Audio source ${sourceId} is unavailable. Relink it through the host adapter.`,
              )
            let bytes: ArrayBuffer
            if (source.file) bytes = await source.file.arrayBuffer()
            else if (source.url) {
              const url = new URL(source.url, window.location.href)
              if (
                url.origin !== window.location.origin &&
                !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
              )
                throw new Error(
                  'Dialogue audio URLs must use the application origin or a local loopback service.',
                )
              const response = await fetch(url)
              if (!response.ok)
                throw new Error(
                  `Audio source could not be opened (${response.status}).`,
                )
              bytes = await response.arrayBuffer()
            } else throw new Error('Audio source has no file or local URL.')
            return context.decodeAudioData(bytes)
          }
          decoded = [
            await decode(input.tracks[0].sourceId),
            await decode(input.tracks[1].sourceId),
          ]
        }
        if (generation !== generationRef.current) {
          await context.close()
          return
        }
        const engine = new PairedAudioEngine(context, input.activeRange)
        engineRef.current = engine
        engine.setTracks(
          input.tracks.map((track, index) => ({
            id: track.id,
            buffer: decoded[index] ?? decoded[0],
            offsetSeconds: track.offsetSeconds,
            muted: false,
          })),
        )
        try {
          await engine.initializeAnalysis()
          engine.setLoudnessEnabled(meterVisibleRef.current)
        } catch (cause) {
          setError(
            `Live loudness unavailable: ${cause instanceof Error ? cause.message : 'AudioWorklet failed to initialize.'}`,
          )
        }
        if (generation !== generationRef.current) {
          engine.dispose()
          return
        }
        const nodes: Record<string, AnalyserNode> = {}
        for (const track of input.tracks) {
          const node = engine.getAnalyser(track.id)
          if (node) nodes[track.id] = node
        }
        setAnalysers(nodes)
        unsubscribeRef.current = engine.subscribe(() => {
          setState(engine.state)
          if (!meterVisibleRef.current) return
          const snapshots: Record<string, LoudnessSnapshot | null> = {}
          for (const track of input.tracks)
            snapshots[track.id] = engine.getLoudness(track.id)
          setLiveLoudness(snapshots)
        })
        setBuffers(decoded)
      } catch (cause) {
        await context.close()
        if (generation === generationRef.current)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Paired audio could not be opened.',
          )
      } finally {
        if (generation === generationRef.current) setLoading(false)
        initializationRef.current = null
      }
    })()
    initializationRef.current = job
    return job
  }, [input, sources])

  useEffect(
    () => () => {
      generationRef.current++
      unsubscribeRef.current?.()
      engineRef.current?.dispose()
      engineRef.current = null
    },
    [input, sources],
  )

  const setTracks = useCallback(
    (tracks: readonly PairedPlaybackTrack[]) =>
      engineRef.current?.setTracks(tracks),
    [],
  )
  const playPause = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    if (engine.state.playing) engine.pause()
    else
      void engine
        .play()
        .catch((cause: unknown) =>
          setError(
            cause instanceof Error
              ? cause.message
              : 'Playback could not start.',
          ),
        )
  }, [])
  const seek = useCallback((time: number) => engineRef.current?.seek(time), [])
  const setLoop = useCallback(
    (range: ReviewRange | null) => engineRef.current?.setLoop(range),
    [],
  )
  const setRate = useCallback(
    (rate: number) => engineRef.current?.setRate(rate),
    [],
  )
  const setTrackGain = useCallback(
    async (trackId: string, decibels: number): Promise<boolean> => {
      const engine = engineRef.current
      if (!engine) return false
      engine.setTrackGain(trackId, decibels)
      return true
    },
    [],
  )

  return {
    initialize,
    buffers,
    state,
    loading,
    error,
    analysers,
    liveLoudness,
    setTracks,
    playPause,
    seek,
    setLoop,
    setRate,
    setTrackGain,
  }
}
