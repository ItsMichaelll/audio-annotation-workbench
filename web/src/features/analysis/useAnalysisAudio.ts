import { useCallback, useEffect, useRef, useState } from 'react'
import LoudnessNode, { type LoudnessSnapshot } from 'loudness-worklet'
import { AudioSourceGuard } from '../spectrum/audioSourceGuard'
import { MAX_LISTENING_GAIN_DB } from '../../domain/listeningNormalization'
import {
  DEFAULT_SPECTRUM_RESPONSE,
  SPECTRUM_FFT_SIZE,
  SPECTRUM_MAX_DB,
  SPECTRUM_MIN_DB,
  SPECTRUM_RESPONSES,
  type SpectrumResponse,
} from '../spectrum/spectrumConfig'

const LOUDNESS_UPDATE_INTERVAL_SECONDS = 0.1
export const LOUDNESS_WORKLET_URL = new URL(
  '../../../node_modules/loudness-worklet/packages/lib/dist/loudness.worklet.js',
  import.meta.url,
).href

interface AnalysisGraph {
  mediaElement: HTMLMediaElement
  context: AudioContext
  source: MediaElementAudioSourceNode
  analyser: AnalyserNode
  playbackGain: GainNode
  silentBus: GainNode
  loudness: LoudnessNode | null
  loudnessConnected: boolean
  loudnessInitialization: Promise<void> | null
  directPlaybackFallback: boolean
  disposed: boolean
}

interface AnalysisState {
  mediaElement: HTMLMediaElement | null
  analyserNode: AnalyserNode | null
  loudnessSnapshot: LoudnessSnapshot | null
  error: string | null
  sampleRate: number
}

interface UseAnalysisAudioOptions {
  mediaElement: HTMLMediaElement | null
  meterEnabled: boolean
  isPlaying: boolean
  onError(message: string): void
}

const mediaElementSourceGuard = new AudioSourceGuard<HTMLMediaElement>()

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'The browser could not initialize Web Audio analysis.'
}

function configureAnalyser(
  analyser: AnalyserNode,
  response: SpectrumResponse,
): void {
  analyser.fftSize = SPECTRUM_FFT_SIZE
  analyser.minDecibels = SPECTRUM_MIN_DB
  analyser.maxDecibels = SPECTRUM_MAX_DB
  analyser.smoothingTimeConstant =
    SPECTRUM_RESPONSES[response].smoothingTimeConstant
}

function disposeGraph(graph: AnalysisGraph): void {
  if (graph.disposed) return
  graph.disposed = true
  graph.source.disconnect()
  graph.analyser.disconnect()
  graph.playbackGain.disconnect()
  graph.loudness?.disconnect()
  graph.silentBus.disconnect()
  graph.loudness?.port.close()
  if (graph.context.state !== 'closed') {
    void graph.context.close().catch((error: unknown) => {
      console.error('Unable to close the analysis AudioContext.', error)
    })
  }
}

export interface AnalysisAudioController {
  analyserNode: AnalyserNode | null
  error: string | null
  fftSize: number
  loudnessSnapshot: LoudnessSnapshot | null
  sampleRate: number
  activateSpectrum(): Promise<void>
  activateMeter(): Promise<void>
  setSpectrumResponse(response: SpectrumResponse): void
  setPlaybackGain(decibels: number): Promise<boolean>
}

export function useAnalysisAudio({
  mediaElement,
  meterEnabled,
  isPlaying,
  onError,
}: UseAnalysisAudioOptions): AnalysisAudioController {
  const graphRef = useRef<AnalysisGraph | null>(null)
  const mediaElementRef = useRef(mediaElement)
  const initializationRef = useRef<{
    mediaElement: HTMLMediaElement
    promise: Promise<AnalysisGraph | null>
  } | null>(null)
  const responseRef = useRef<SpectrumResponse>(DEFAULT_SPECTRUM_RESPONSE)
  const onErrorRef = useRef(onError)
  const [state, setState] = useState<AnalysisState>({
    mediaElement: null,
    analyserNode: null,
    loudnessSnapshot: null,
    error: null,
    sampleRate: 0,
  })
  const [loudnessVersion, setLoudnessVersion] = useState(0)

  useEffect(() => {
    mediaElementRef.current = mediaElement
    onErrorRef.current = onError
  }, [mediaElement, onError])

  const reportError = useCallback(
    (message: string, target: HTMLMediaElement) => {
      if (mediaElementRef.current !== target) return
      setState((current) => ({ ...current, error: message }))
      onErrorRef.current(message)
    },
    [],
  )

  const ensureGraph = useCallback(
    async function ensureCurrentGraph(): Promise<AnalysisGraph | null> {
      const target = mediaElementRef.current
      if (!target) return null
      const existing = graphRef.current
      if (existing && existing.mediaElement === target && !existing.disposed) {
        try {
          if (existing.context.state === 'suspended')
            await existing.context.resume()
        } catch (error) {
          reportError(
            `Audio analysis could not resume: ${describeError(error)}`,
            target,
          )
          return null
        }
        return existing
      }
      if (initializationRef.current) {
        const pending = initializationRef.current
        if (pending.mediaElement === target) return pending.promise
        await pending.promise
        return ensureCurrentGraph()
      }

      const initialization = (async () => {
        let context: AudioContext | null = null
        try {
          context = new AudioContext({ latencyHint: 'interactive' })
          if (context.state === 'suspended') await context.resume()
          if (context.state !== 'running')
            throw new Error(`AudioContext remained ${context.state}.`)
          if (mediaElementRef.current !== target) {
            await context.close()
            return null
          }
          // Configure fallible analysis nodes before permanently wrapping the element.
          const analyser = context.createAnalyser()
          configureAnalyser(analyser, responseRef.current)
          const silentBus = context.createGain()
          silentBus.gain.value = 0
          const playbackGain = context.createGain()
          playbackGain.gain.value = 1
          playbackGain.connect(context.destination)
          analyser.connect(silentBus)
          silentBus.connect(context.destination)
          if (!mediaElementSourceGuard.claim(target)) {
            throw new Error(
              'This audio element already has an analysis source.',
            )
          }
          let source: MediaElementAudioSourceNode
          try {
            source = context.createMediaElementSource(target)
          } catch (error) {
            mediaElementSourceGuard.releaseFailedClaim(target)
            throw error
          }
          const graph: AnalysisGraph = {
            mediaElement: target,
            context,
            source,
            analyser,
            playbackGain,
            silentBus,
            loudness: null,
            loudnessConnected: false,
            loudnessInitialization: null,
            directPlaybackFallback: false,
            disposed: false,
          }
          graphRef.current = graph
          // Exactly one audible route. Analysis taps terminate at the zero-gain bus.
          try {
            source.connect(playbackGain)
          } catch (error) {
            source.disconnect()
            playbackGain.disconnect()
            source.connect(context.destination)
            graph.directPlaybackFallback = true
            onErrorRef.current(
              `Listening gain is unavailable. Playback uses the direct audio route: ${describeError(error)}`,
            )
          }
          let analysisError: string | null = null
          try {
            source.connect(analyser)
          } catch (error) {
            analysisError = `Spectrum analysis unavailable: ${describeError(error)}`
            onErrorRef.current(analysisError)
          }
          setState({
            mediaElement: target,
            analyserNode: analysisError ? null : analyser,
            loudnessSnapshot: null,
            error: analysisError,
            sampleRate: context.sampleRate,
          })
          return graph
        } catch (error) {
          const ownsSource = graphRef.current?.mediaElement === target
          if (!ownsSource && context && context.state !== 'closed')
            await context.close()
          reportError(
            ownsSource
              ? `The browser could not connect audio. Reload this file to restore playback: ${describeError(error)}`
              : `Audio analysis unavailable; normal playback is preserved: ${describeError(error)}`,
            target,
          )
          return null
        }
      })()
      initializationRef.current = {
        mediaElement: target,
        promise: initialization,
      }
      try {
        return await initialization
      } finally {
        if (initializationRef.current?.promise === initialization)
          initializationRef.current = null
      }
    },
    [reportError],
  )

  const activateSpectrum = useCallback(async () => {
    await ensureGraph()
  }, [ensureGraph])

  const activateMeter = useCallback(async () => {
    const graph = await ensureGraph()
    if (!graph || graph.disposed || graph.loudness) return
    if (graph.loudnessInitialization) {
      await graph.loudnessInitialization
      return
    }
    const initialization = (async () => {
      try {
        await graph.context.audioWorklet.addModule(LOUDNESS_WORKLET_URL)
        if (graph.disposed) return
        const loudness = new LoudnessNode(graph.context, {
          interval: LOUDNESS_UPDATE_INTERVAL_SECONDS,
        })
        graph.loudness = loudness
        graph.source.connect(loudness)
        loudness.connect(graph.silentBus)
        graph.loudnessConnected = true
        setLoudnessVersion((version) => version + 1)
      } catch (error) {
        reportError(
          `Loudness meter unavailable; playback remains unmodified: ${describeError(error)}`,
          graph.mediaElement,
        )
      } finally {
        graph.loudnessInitialization = null
      }
    })()
    graph.loudnessInitialization = initialization
    await initialization
  }, [ensureGraph, reportError])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph?.loudness || graph.disposed) return
    if (meterEnabled && !graph.loudnessConnected) {
      graph.source.connect(graph.loudness)
      graph.loudness.connect(graph.silentBus)
      graph.loudnessConnected = true
    } else if (!meterEnabled && graph.loudnessConnected) {
      graph.source.disconnect(graph.loudness)
      graph.loudness.disconnect()
      graph.loudnessConnected = false
    }
  }, [loudnessVersion, meterEnabled, state.sampleRate])

  useEffect(() => {
    const graph = graphRef.current
    if (!meterEnabled || !isPlaying || !graph?.loudness) return
    const values = new Float32Array(graph.loudness.metricCount)
    const timer = window.setInterval(() => {
      if (graph.disposed || !graph.loudness) return
      graph.loudness.getFloatLoudnessData(values)
      const snapshot = LoudnessNode.from(values)
      setState((current) =>
        current.mediaElement === graph.mediaElement
          ? { ...current, loudnessSnapshot: snapshot }
          : current,
      )
    }, LOUDNESS_UPDATE_INTERVAL_SECONDS * 1000)
    return () => window.clearInterval(timer)
  }, [isPlaying, loudnessVersion, meterEnabled, state.sampleRate])

  const setSpectrumResponse = useCallback((response: SpectrumResponse) => {
    responseRef.current = response
    const graph = graphRef.current
    if (graph && !graph.disposed) {
      graph.analyser.smoothingTimeConstant =
        SPECTRUM_RESPONSES[response].smoothingTimeConstant
    }
  }, [])

  const setPlaybackGain = useCallback(
    async (decibels: number) => {
      if (
        !Number.isFinite(decibels) ||
        Math.abs(decibels) > MAX_LISTENING_GAIN_DB
      )
        return false
      const graph = await ensureGraph()
      if (!graph || graph.disposed || graph.directPlaybackFallback) return false
      const now = graph.context.currentTime
      graph.playbackGain.gain.cancelScheduledValues(now)
      graph.playbackGain.gain.setTargetAtTime(10 ** (decibels / 20), now, 0.01)
      return true
    },
    [ensureGraph],
  )

  useEffect(() => {
    responseRef.current = DEFAULT_SPECTRUM_RESPONSE
    return () => {
      const graph = graphRef.current
      if (graph && graph.mediaElement === mediaElement) {
        disposeGraph(graph)
        graphRef.current = null
      }
    }
  }, [mediaElement])

  const current = state.mediaElement === mediaElement
  return {
    analyserNode: current ? state.analyserNode : null,
    error: current ? state.error : null,
    fftSize: SPECTRUM_FFT_SIZE,
    loudnessSnapshot: current ? state.loudnessSnapshot : null,
    sampleRate: current ? state.sampleRate : 0,
    activateSpectrum,
    activateMeter,
    setSpectrumResponse,
    setPlaybackGain,
  }
}
