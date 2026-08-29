import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioSourceGuard } from './audioSourceGuard'
import {
  DEFAULT_SPECTRUM_RESPONSE,
  SPECTRUM_FFT_SIZE,
  SPECTRUM_MAX_DB,
  SPECTRUM_MIN_DB,
  SPECTRUM_RESPONSES,
  type SpectrumResponse,
} from './spectrumConfig'

interface AnalyzerGraph {
  mediaElement: HTMLMediaElement
  context: AudioContext
  source: MediaElementAudioSourceNode
  analyser: AnalyserNode
  passThroughOnly: boolean
  disposed: boolean
}

interface UseAudioAnalyzerOptions {
  mediaElement: HTMLMediaElement | null
  onError(message: string): void
}

interface AnalyzerUiState {
  mediaElement: HTMLMediaElement | null
  analyserNode: AnalyserNode | null
  error: string | null
  sampleRate: number
}

export interface AudioAnalyzerController {
  analyserNode: AnalyserNode | null
  error: string | null
  fftSize: number
  sampleRate: number
  activate(): Promise<void>
  setResponse(response: SpectrumResponse): void
}

const mediaElementSourceGuard = new AudioSourceGuard<HTMLMediaElement>()

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

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'The browser could not initialize the Web Audio analyzer.'
}

function disposeGraph(graph: AnalyzerGraph): void {
  if (graph.disposed) return
  graph.disposed = true
  graph.source.disconnect()
  graph.analyser.disconnect()
  if (graph.context.state !== 'closed') {
    void graph.context.close().catch((error: unknown) => {
      console.error('Unable to close the spectrum AudioContext.', error)
    })
  }
}

export function useAudioAnalyzer({
  mediaElement,
  onError,
}: UseAudioAnalyzerOptions): AudioAnalyzerController {
  const graphRef = useRef<AnalyzerGraph | null>(null)
  const mediaElementRef = useRef(mediaElement)
  const initializationRef = useRef<Promise<void> | null>(null)
  const responseRef = useRef<SpectrumResponse>(DEFAULT_SPECTRUM_RESPONSE)
  const onErrorRef = useRef(onError)
  const [uiState, setUiState] = useState<AnalyzerUiState>({
    mediaElement: null,
    analyserNode: null,
    error: null,
    sampleRate: 0,
  })

  useEffect(() => {
    mediaElementRef.current = mediaElement
    onErrorRef.current = onError
  }, [mediaElement, onError])

  const reportError = useCallback(
    (message: string, targetMediaElement: HTMLMediaElement) => {
      if (mediaElementRef.current !== targetMediaElement) return
      setUiState({
        mediaElement: targetMediaElement,
        analyserNode: null,
        error: message,
        sampleRate: 0,
      })
      onErrorRef.current(message)
    },
    [],
  )

  const setResponse = useCallback((response: SpectrumResponse) => {
    responseRef.current = response
    const graph = graphRef.current
    if (graph && !graph.disposed && !graph.passThroughOnly) {
      graph.analyser.smoothingTimeConstant =
        SPECTRUM_RESPONSES[response].smoothingTimeConstant
    }
  }, [])

  const activate = useCallback(async () => {
    const currentMediaElement = mediaElementRef.current
    if (!currentMediaElement) return

    const currentGraph = graphRef.current
    if (
      currentGraph &&
      currentGraph.mediaElement === currentMediaElement &&
      !currentGraph.disposed
    ) {
      if (currentGraph.context.state === 'suspended') {
        try {
          await currentGraph.context.resume()
        } catch (resumeError) {
          reportError(
            `Spectrum analyzer could not resume: ${describeError(resumeError)}`,
            currentMediaElement,
          )
        }
      }
      return
    }

    if (initializationRef.current) {
      await initializationRef.current
      return
    }

    const initialization = (async () => {
      let context: AudioContext | null = null
      try {
        context = new AudioContext({ latencyHint: 'interactive' })
        if (context.state === 'suspended') await context.resume()
        if (context.state !== 'running') {
          throw new Error(`AudioContext remained ${context.state}.`)
        }

        if (mediaElementRef.current !== currentMediaElement) {
          await context.close()
          return
        }

        const analyser = context.createAnalyser()
        configureAnalyser(analyser, responseRef.current)

        if (!mediaElementSourceGuard.claim(currentMediaElement)) {
          await context.close()
          throw new Error(
            'This audio element already has an analyzer source connection.',
          )
        }

        let source: MediaElementAudioSourceNode
        try {
          source = context.createMediaElementSource(currentMediaElement)
        } catch (sourceError) {
          mediaElementSourceGuard.releaseFailedClaim(currentMediaElement)
          await context.close()
          throw sourceError
        }

        const graph: AnalyzerGraph = {
          mediaElement: currentMediaElement,
          context,
          source,
          analyser,
          passThroughOnly: false,
          disposed: false,
        }
        graphRef.current = graph

        try {
          source.connect(analyser)
          analyser.connect(context.destination)
        } catch (connectionError) {
          source.disconnect()
          try {
            source.connect(context.destination)
            graph.passThroughOnly = true
            reportError(
              `Spectrum analyzer unavailable; playback remains unmodified: ${describeError(connectionError)}`,
              currentMediaElement,
            )
          } catch (fallbackError) {
            graphRef.current = null
            disposeGraph(graph)
            reportError(
              `Spectrum analyzer could not establish an audio route. Load the file again to restore playback: ${describeError(fallbackError)}`,
              currentMediaElement,
            )
          }
          return
        }

        setUiState({
          mediaElement: currentMediaElement,
          analyserNode: analyser,
          error: null,
          sampleRate: context.sampleRate,
        })
      } catch (initializationError) {
        if (context && context.state !== 'closed' && !graphRef.current) {
          await context.close().catch((closeError: unknown) => {
            console.error(
              'Unable to close a failed spectrum AudioContext.',
              closeError,
            )
          })
        }
        reportError(
          `Spectrum analyzer unavailable; normal playback is preserved: ${describeError(initializationError)}`,
          currentMediaElement,
        )
      } finally {
        initializationRef.current = null
      }
    })()

    initializationRef.current = initialization
    await initialization
  }, [reportError])

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

  const stateBelongsToCurrentMedia = uiState.mediaElement === mediaElement

  return {
    analyserNode: stateBelongsToCurrentMedia ? uiState.analyserNode : null,
    error: stateBelongsToCurrentMedia ? uiState.error : null,
    fftSize: SPECTRUM_FFT_SIZE,
    sampleRate: stateBelongsToCurrentMedia ? uiState.sampleRate : 0,
    activate,
    setResponse,
  }
}
