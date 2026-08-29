import { useCallback, useEffect, useRef, useState } from 'react'
import LoudnessNode, { type LoudnessSnapshot } from 'loudness-worklet'
import { AudioSourceGuard } from '../spectrum/audioSourceGuard'
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
  silentBus: GainNode
  loudness: LoudnessNode | null
  loudnessConnected: boolean
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
}

export function useAnalysisAudio({
  mediaElement,
  meterEnabled,
  isPlaying,
  onError,
}: UseAnalysisAudioOptions): AnalysisAudioController {
  const graphRef = useRef<AnalysisGraph | null>(null)
  const mediaElementRef = useRef(mediaElement)
  const initializationRef = useRef<Promise<AnalysisGraph | null> | null>(null)
  const loudnessInitializationRef = useRef<Promise<void> | null>(null)
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

  const ensureGraph = useCallback(async (): Promise<AnalysisGraph | null> => {
    const target = mediaElementRef.current
    if (!target) return null
    const existing = graphRef.current
    if (existing && existing.mediaElement === target && !existing.disposed) {
      if (existing.context.state === 'suspended')
        await existing.context.resume()
      return existing
    }
    if (initializationRef.current) return initializationRef.current

    const initialization = (async () => {
      let context: AudioContext | null = null
      try {
        context = new AudioContext({ latencyHint: 'interactive' })
        if (context.state === 'suspended') await context.resume()
        if (mediaElementRef.current !== target) {
          await context.close()
          return null
        }
        if (!mediaElementSourceGuard.claim(target)) {
          throw new Error('This audio element already has an analysis source.')
        }
        let source: MediaElementAudioSourceNode
        try {
          source = context.createMediaElementSource(target)
        } catch (error) {
          mediaElementSourceGuard.releaseFailedClaim(target)
          throw error
        }
        const analyser = context.createAnalyser()
        configureAnalyser(analyser, responseRef.current)
        const silentBus = context.createGain()
        silentBus.gain.value = 0

        // Exactly one audible route. Analysis taps terminate at the zero-gain bus.
        source.connect(context.destination)
        source.connect(analyser)
        analyser.connect(silentBus)
        silentBus.connect(context.destination)

        const graph: AnalysisGraph = {
          mediaElement: target,
          context,
          source,
          analyser,
          silentBus,
          loudness: null,
          loudnessConnected: false,
          disposed: false,
        }
        graphRef.current = graph
        setState({
          mediaElement: target,
          analyserNode: analyser,
          loudnessSnapshot: null,
          error: null,
          sampleRate: context.sampleRate,
        })
        return graph
      } catch (error) {
        if (context && context.state !== 'closed') await context.close()
        reportError(
          `Audio analysis unavailable; normal playback is preserved: ${describeError(error)}`,
          target,
        )
        return null
      } finally {
        initializationRef.current = null
      }
    })()
    initializationRef.current = initialization
    return initialization
  }, [reportError])

  const activateSpectrum = useCallback(async () => {
    await ensureGraph()
  }, [ensureGraph])

  const activateMeter = useCallback(async () => {
    const graph = await ensureGraph()
    if (!graph || graph.disposed || graph.loudness) return
    if (loudnessInitializationRef.current) {
      await loudnessInitializationRef.current
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
        loudnessInitializationRef.current = null
      }
    })()
    loudnessInitializationRef.current = initialization
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
    if (graph && !graph.disposed) configureAnalyser(graph.analyser, response)
  }, [])

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
  }
}
