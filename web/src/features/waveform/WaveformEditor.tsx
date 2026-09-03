import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import WaveSurfer from 'wavesurfer.js'
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.esm.js'
import MinimapPlugin from 'wavesurfer.js/dist/plugins/minimap.esm.js'
import RegionsPlugin, {
  type Region,
} from 'wavesurfer.js/dist/plugins/regions.esm.js'
import WindowedSpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js'
import type { RegionMetadata } from '../../domain/region'
import {
  clampRegionEdit,
  maximumAudioScroll,
  normalizeRegion,
  regionDragBounds,
  regionVisualColors,
  translateRegion,
  viewportAutoScrollDelta,
} from '../../domain/region'
import { clampTime, formatTime } from '../../domain/transport'
import { clampedWheelScroll, shiftWheelMode } from '../../domain/wheel'
import { useAnalysisAudio } from '../analysis/useAnalysisAudio'
import { LoudnessMeter } from '../loudness/LoudnessMeter'
import { SpectrumAnalyzer } from '../spectrum/SpectrumAnalyzer'
import { scrollWidthsMatch } from './scrollSync'
import {
  logarithmicFrequencyY,
  spectrogramViewportGeometry,
} from './spectrogramSync'
import {
  cursorCenteredScroll,
  fitZoom,
  keyboardZoomAnchor,
  MAX_ZOOM_PX_PER_SECOND,
  steppedVerticalScale,
  steppedZoom,
} from '../../domain/zoom'
import styles from './WaveformEditor.module.css'

const REGION_COLOR = 'rgba(70, 144, 255, 0.28)'
const WARNING_COLOR = '#ffa500'
const REGION_WHEEL_NUDGE_RATIO = 0.1
const SPECTROGRAM_FREQUENCY_LABELS = [
  20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50, 20,
] as const

function formatFrequencyLabel(frequency: number): string {
  if (frequency >= 1_000) {
    const kilohertz = frequency / 1_000
    return Number.isInteger(kilohertz)
      ? kilohertz.toFixed(0)
      : kilohertz.toFixed(1)
  }
  return Math.round(frequency).toString()
}

function applyRegionHandlePresentation(region: Region): void {
  // RegionsPlugin writes these dimensions inline, so keep the established
  // handle geometry at the same generated-DOM boundary without `!important`.
  if (!region.element) return
  for (const handle of region.element.querySelectorAll<HTMLElement>(
    '[part~="region-handle"]',
  )) {
    handle.style.width = '10px'
  }
  const leftHandle = region.element.querySelector<HTMLElement>(
    '[part~="region-handle-left"]',
  )
  const rightHandle = region.element.querySelector<HTMLElement>(
    '[part~="region-handle-right"]',
  )
  if (leftHandle) leftHandle.style.borderLeft = 'none'
  if (rightHandle) rightHandle.style.borderRight = 'none'
}

export interface WaveformEditorHandle {
  activateMeter(): void
  activateSpectrum(): void
  fit(): void
  playPause(): void
  resetVerticalScale(): void
  seekBy(seconds: number): void
  seekTo(seconds: number): void
  revealRegion(start: number, end: number): void
  zoom(direction: 'in' | 'out'): void
}

interface WaveformEditorProps {
  audioUrl: string
  regions: readonly RegionMetadata[]
  selectedRegionId: string | null
  loopEnabled: boolean
  meterEnabled: boolean
  spectrumEnabled: boolean
  spectrogramEnabled: boolean
  isPlaying: boolean
  readOnly?: boolean
  onLoading(): void
  onReady(duration: number): void
  onError(message: string): void
  onTimeChange(time: number): void
  onPlaybackChange(isPlaying: boolean): void
  onZoomChange(zoom: number): void
  onVerticalScaleChange(scale: number): void
  onRegionCreate(region: RegionMetadata): void
  onRegionLiveChange(region: RegionMetadata): void
  onRegionCommit(region: RegionMetadata): void
  onRegionSelect(regionId: string): void
  onClearRegionSelection(): void
  onHideSpectrogram(): void
  onHideSpectrum(): void
  onHideMeter(): void
}

interface CallbackBundle {
  onLoading: WaveformEditorProps['onLoading']
  onReady: WaveformEditorProps['onReady']
  onError: WaveformEditorProps['onError']
  onTimeChange: WaveformEditorProps['onTimeChange']
  onPlaybackChange: WaveformEditorProps['onPlaybackChange']
  onZoomChange: WaveformEditorProps['onZoomChange']
  onVerticalScaleChange: WaveformEditorProps['onVerticalScaleChange']
  onRegionCreate: WaveformEditorProps['onRegionCreate']
  onRegionLiveChange: WaveformEditorProps['onRegionLiveChange']
  onRegionCommit: WaveformEditorProps['onRegionCommit']
  onRegionSelect: WaveformEditorProps['onRegionSelect']
  onClearRegionSelection: WaveformEditorProps['onClearRegionSelection']
}

function regionMetadata(
  region: Region,
  duration: number,
): RegionMetadata | null {
  const normalized = normalizeRegion(region.start, region.end, duration)
  if (!normalized) return null

  return {
    id: region.id,
    ...normalized,
    data: {},
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'The browser could not decode or play this audio file.'
}

export const WaveformEditor = forwardRef<
  WaveformEditorHandle,
  WaveformEditorProps
>(function WaveformEditor(
  {
    audioUrl,
    regions,
    selectedRegionId,
    loopEnabled,
    meterEnabled,
    spectrumEnabled,
    spectrogramEnabled,
    isPlaying,
    readOnly = false,
    onLoading,
    onReady,
    onError,
    onTimeChange,
    onPlaybackChange,
    onZoomChange,
    onVerticalScaleChange,
    onRegionCreate,
    onRegionLiveChange,
    onRegionCommit,
    onRegionSelect,
    onClearRegionSelection,
    onHideSpectrogram,
    onHideSpectrum,
    onHideMeter,
  },
  forwardedRef,
) {
  const waveformElementRef = useRef<HTMLDivElement>(null)
  const spectrogramViewportElementRef = useRef<HTMLDivElement>(null)
  const spectrogramElementRef = useRef<HTMLDivElement>(null)
  const minimapElementRef = useRef<HTMLDivElement>(null)
  const scrollbarElementRef = useRef<HTMLDivElement>(null)
  const scrollbarTrackElementRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const regionsPluginRef = useRef<RegionsPlugin | null>(null)
  const synchronizationRef = useRef(false)
  const lastValidRegionsRef = useRef(
    new Map<string, Pick<RegionMetadata, 'start' | 'end'>>(),
  )
  const selectedRegionIdRef = useRef(selectedRegionId)
  const loopEnabledRef = useRef(loopEnabled)
  const spectrumEnabledRef = useRef(spectrumEnabled)
  const meterEnabledRef = useRef(meterEnabled)
  const verticalScaleRef = useRef(1)
  const pendingPlaybackRegionIdRef = useRef<string | null>(null)
  const restorePlaybackAfterEmptyClickRef = useRef(false)
  const callbacksRef = useRef<CallbackBundle>({
    onLoading,
    onReady,
    onError,
    onTimeChange,
    onPlaybackChange,
    onZoomChange,
    onVerticalScaleChange,
    onRegionCreate,
    onRegionLiveChange,
    onRegionCommit,
    onRegionSelect,
    onClearRegionSelection,
  })
  const [instanceVersion, setInstanceVersion] = useState(0)
  const [spectrogramMaxFrequency, setSpectrogramMaxFrequency] = useState(24_000)
  const [mediaElement, setMediaElement] = useState<HTMLMediaElement | null>(
    null,
  )
  const [decodedAudio, setDecodedAudio] = useState<AudioBuffer | null>(null)

  const audioAnalyzer = useAnalysisAudio({
    mediaElement,
    meterEnabled,
    isPlaying,
    onError: (message) => callbacksRef.current.onError(message),
  })
  const activateAudioAnalyzer = audioAnalyzer.activateSpectrum
  const activateLoudnessMeter = audioAnalyzer.activateMeter
  const spectrogramAxisLabels = useMemo(
    () => [
      spectrogramMaxFrequency,
      ...SPECTROGRAM_FREQUENCY_LABELS.filter(
        (frequency) => frequency < spectrogramMaxFrequency * 0.9,
      ),
    ],
    [spectrogramMaxFrequency],
  )

  callbacksRef.current = {
    onLoading,
    onReady,
    onError,
    onTimeChange,
    onPlaybackChange,
    onZoomChange,
    onVerticalScaleChange,
    onRegionCreate,
    onRegionLiveChange,
    onRegionCommit,
    onRegionSelect,
    onClearRegionSelection,
  }
  selectedRegionIdRef.current = selectedRegionId
  loopEnabledRef.current = loopEnabled
  spectrumEnabledRef.current = spectrumEnabled
  meterEnabledRef.current = meterEnabled

  const reportPlaybackError = (error: unknown) => {
    callbacksRef.current.onError(`Playback failed: ${errorMessage(error)}`)
  }

  useImperativeHandle(
    forwardedRef,
    () => ({
      activateMeter() {
        void activateLoudnessMeter()
      },
      activateSpectrum() {
        void activateAudioAnalyzer()
      },
      fit() {
        const wavesurfer = wavesurferRef.current
        if (!wavesurfer) return
        const duration = wavesurfer.getDuration()
        const scrollContainer = wavesurfer.getWrapper().parentElement
        if (!scrollContainer) return

        const fittedZoom = fitZoom(duration, scrollContainer.clientWidth)
        if (fittedZoom <= 0) return
        wavesurfer.zoom(fittedZoom)
        wavesurfer.setScroll(0)
      },
      playPause() {
        const wavesurfer = wavesurferRef.current
        if (!wavesurfer) return
        restorePlaybackAfterEmptyClickRef.current = false
        if (!wavesurfer.isPlaying()) {
          if (spectrumEnabledRef.current) void activateAudioAnalyzer()
          if (meterEnabledRef.current) void activateLoudnessMeter()
        }
        if (!wavesurfer.isPlaying() && pendingPlaybackRegionIdRef.current) {
          const pendingRegion = regionsPluginRef.current
            ?.getRegions()
            .find((region) => region.id === pendingPlaybackRegionIdRef.current)
          if (pendingRegion) wavesurfer.setTime(pendingRegion.start)
          pendingPlaybackRegionIdRef.current = null
        }
        void wavesurfer.playPause().catch(reportPlaybackError)
      },
      resetVerticalScale() {
        const wavesurfer = wavesurferRef.current
        if (!wavesurfer) return
        verticalScaleRef.current = 1
        wavesurfer.setOptions({ barHeight: 1 })
        callbacksRef.current.onVerticalScaleChange(1)
      },
      seekBy(seconds: number) {
        const wavesurfer = wavesurferRef.current
        if (!wavesurfer) return
        wavesurfer.setTime(
          clampTime(
            wavesurfer.getCurrentTime() + seconds,
            wavesurfer.getDuration(),
          ),
        )
      },
      seekTo(seconds: number) {
        const wavesurfer = wavesurferRef.current
        if (!wavesurfer) return
        wavesurfer.setTime(clampTime(seconds, wavesurfer.getDuration()))
      },
      revealRegion(start: number, end: number) {
        const wavesurfer = wavesurferRef.current
        if (!wavesurfer) return
        const duration = wavesurfer.getDuration()
        const scrollContainer = wavesurfer.getWrapper().parentElement
        if (!scrollContainer || duration <= 0) return
        const bounded = normalizeRegion(start, end, duration)
        if (!bounded) return
        if (wavesurfer.isPlaying()) wavesurfer.pause()
        wavesurfer.setTime(bounded.start)
        const pixelsPerSecond = Math.max(
          wavesurfer.options.minPxPerSec,
          scrollContainer.clientWidth / duration,
        )
        const viewportStart = scrollContainer.scrollLeft / pixelsPerSecond
        const viewportEnd =
          (scrollContainer.scrollLeft + scrollContainer.clientWidth) /
          pixelsPerSecond
        if (bounded.start >= viewportStart && bounded.end <= viewportEnd) return
        const center = (bounded.start + bounded.end) / 2
        const targetScroll =
          center * pixelsPerSecond - scrollContainer.clientWidth / 2
        wavesurfer.setScroll(
          Math.min(
            Math.max(targetScroll, 0),
            maximumAudioScroll(
              duration,
              pixelsPerSecond,
              scrollContainer.clientWidth,
            ),
          ),
        )
      },
      zoom(direction: 'in' | 'out') {
        const wavesurfer = wavesurferRef.current
        if (!wavesurfer) return
        const duration = wavesurfer.getDuration()
        const scrollContainer = wavesurfer.getWrapper().parentElement
        if (!scrollContainer || duration <= 0) return

        const viewportWidth = scrollContainer.clientWidth
        const fittedZoom = fitZoom(duration, viewportWidth)
        const currentZoom = Math.max(fittedZoom, wavesurfer.options.minPxPerSec)
        const nextZoom = steppedZoom(currentZoom, direction, fittedZoom)
        const pointerX = keyboardZoomAnchor(
          wavesurfer.getCurrentTime(),
          wavesurfer.getScroll(),
          currentZoom,
          viewportWidth,
        )
        const nextScroll = cursorCenteredScroll({
          currentZoom,
          currentScroll: wavesurfer.getScroll(),
          pointerX,
          nextZoom,
          viewportWidth,
          duration,
        })

        wavesurfer.zoom(nextZoom)
        wavesurfer.setScroll(nextScroll)
      },
    }),
    [activateAudioAnalyzer, activateLoudnessMeter],
  )

  useEffect(() => {
    const container = waveformElementRef.current
    const minimapContainer = minimapElementRef.current
    if (!container || !minimapContainer) return

    verticalScaleRef.current = 1
    pendingPlaybackRegionIdRef.current = null
    restorePlaybackAfterEmptyClickRef.current = false
    callbacksRef.current.onVerticalScaleChange(1)
    let disposed = false
    let loadErrorReported = false
    let loopRestartQueued = false
    const regionsPlugin = RegionsPlugin.create()
    const minimapPlugin = MinimapPlugin.create({
      container: minimapContainer,
      height: 52,
      waveColor: '#606b72',
      progressColor: '#9ba7ad',
      cursorColor: WARNING_COLOR,
      cursorWidth: 1,
      overlayColor: 'rgba(232, 240, 242, 0.12)',
    })
    const wavesurfer = WaveSurfer.create({
      container,
      height: 300,
      waveColor: '#aeb7bd',
      progressColor: '#eef5f5',
      cursorColor: WARNING_COLOR,
      cursorWidth: 2,
      normalize: false,
      fillParent: true,
      minPxPerSec: 0,
      autoScroll: false,
      autoCenter: false,
      interact: true,
      dragToSeek: false,
      hideScrollbar: true,
      plugins: [
        regionsPlugin,
        TimelinePlugin.create({
          height: 24,
          insertPosition: 'afterend',
          style: {
            color: '#8d979e',
            fontSize: '10px',
          },
          formatTimeCallback: (time) => formatTime(time).slice(0, -2),
        }),
        minimapPlugin,
        HoverPlugin.create({
          lineColor: WARNING_COLOR,
          lineWidth: 1,
          labelBackground: '#171a1d',
          labelColor: '#f4f7f7',
          labelSize: 11,
          formatTimeCallback: formatTime,
        }),
        ZoomPlugin.create({
          maxZoom: MAX_ZOOM_PX_PER_SECOND,
          deltaThreshold: 5,
          exponentialZooming: true,
          iterations: 32,
        }),
      ],
    })

    wavesurferRef.current = wavesurfer
    regionsPluginRef.current = regionsPlugin
    const wavesurferMediaElement = wavesurfer.getMediaElement()
    setMediaElement(wavesurferMediaElement)
    callbacksRef.current.onLoading()

    const reportLoadError = (error: unknown) => {
      if (disposed || loadErrorReported) return
      loadErrorReported = true
      callbacksRef.current.onError(
        `Unable to load audio: ${errorMessage(error)} Check that this browser supports the file's codec.`,
      )
    }
    const selectRegion = (regionId: string) => {
      if (selectedRegionIdRef.current !== regionId) {
        selectedRegionIdRef.current = regionId
        loopEnabledRef.current = true
        if (
          pendingPlaybackRegionIdRef.current &&
          pendingPlaybackRegionIdRef.current !== regionId
        ) {
          pendingPlaybackRegionIdRef.current = null
        }
      }
      callbacksRef.current.onRegionSelect(regionId)
    }
    const clearRegionSelection = () => {
      selectedRegionIdRef.current = null
      loopEnabledRef.current = false
      pendingPlaybackRegionIdRef.current = null
      callbacksRef.current.onClearRegionSelection()
    }

    const unsubscribeReady = wavesurfer.on('ready', (duration) => {
      if (disposed) return
      const scrollContainer = wavesurfer.getWrapper().parentElement
      const fittedZoom = fitZoom(
        duration,
        scrollContainer?.clientWidth ?? wavesurfer.getWidth(),
      )
      if (fittedZoom > 0) {
        wavesurfer.zoom(fittedZoom)
        wavesurfer.setScroll(0)
      }
      callbacksRef.current.onReady(duration)
      callbacksRef.current.onTimeChange(0)
      setDecodedAudio(wavesurfer.getDecodedData())
      callbacksRef.current.onZoomChange(fittedZoom)
      const sampleRate = wavesurfer.getDecodedData()?.sampleRate
      if (sampleRate && sampleRate > 0) {
        setSpectrogramMaxFrequency(sampleRate / 2)
      }
      setInstanceVersion((version) => version + 1)
    })
    const unsubscribeError = wavesurfer.on('error', reportLoadError)
    const unsubscribeTime = wavesurfer.on('timeupdate', (time) => {
      callbacksRef.current.onTimeChange(time)
      const selectedId = selectedRegionIdRef.current
      if (!loopEnabledRef.current || !selectedId || !wavesurfer.isPlaying()) {
        return
      }

      const selected = regionsPlugin
        .getRegions()
        .find((region) => region.id === selectedId)
      if (
        selected &&
        time >= selected.end - 0.004 &&
        time - selected.end < 0.05
      ) {
        wavesurfer.setTime(selected.start)
      }
    })
    const unsubscribePlay = wavesurfer.on('play', () => {
      restorePlaybackAfterEmptyClickRef.current = false
      if (spectrumEnabledRef.current) void activateAudioAnalyzer()
      if (meterEnabledRef.current) void activateLoudnessMeter()
      callbacksRef.current.onPlaybackChange(true)
    })
    const unsubscribePause = wavesurfer.on('pause', () => {
      if (restorePlaybackAfterEmptyClickRef.current) {
        void wavesurfer.play().catch(reportPlaybackError)
        return
      }
      callbacksRef.current.onPlaybackChange(false)
      const selectedId = selectedRegionIdRef.current
      const selected = regionsPlugin
        .getRegions()
        .find((region) => region.id === selectedId)
      const shouldRestart =
        loopEnabledRef.current &&
        selected !== undefined &&
        Math.abs(wavesurfer.getCurrentTime() - selected.end) <= 0.025

      if (shouldRestart && !loopRestartQueued) {
        loopRestartQueued = true
        queueMicrotask(() => {
          loopRestartQueued = false
          if (
            disposed ||
            !loopEnabledRef.current ||
            selectedRegionIdRef.current !== selected.id
          ) {
            return
          }
          void wavesurfer
            .play(selected.start, selected.end)
            .catch(reportPlaybackError)
        })
      }
    })
    const unsubscribeFinish = wavesurfer.on('finish', () => {
      callbacksRef.current.onPlaybackChange(false)
    })
    const unsubscribeInteraction = wavesurfer.on('interaction', (time) => {
      callbacksRef.current.onTimeChange(time)
    })
    const seekAfterClearingSelection = (relativeX: number) => {
      const shouldContinue =
        restorePlaybackAfterEmptyClickRef.current || wavesurfer.isPlaying()
      clearRegionSelection()
      const duration = wavesurfer.getDuration()
      if (duration > 0) {
        wavesurfer.setTime(clampTime(relativeX * duration, duration))
      }
      restorePlaybackAfterEmptyClickRef.current = shouldContinue
      if (shouldContinue) {
        void wavesurfer.play().catch(reportPlaybackError)
      }
    }
    const unsubscribeWaveformClick = wavesurfer.on('click', (relativeX) => {
      seekAfterClearingSelection(relativeX)
    })
    const unsubscribeZoom = wavesurfer.on('zoom', (zoom) => {
      callbacksRef.current.onZoomChange(zoom)
    })

    const scrollContainer = wavesurfer.getWrapper().parentElement
    const audioPixelsPerSecond = () => {
      const duration = wavesurfer.getDuration()
      if (!scrollContainer || duration <= 0) return 1
      return Math.max(
        wavesurfer.options.minPxPerSec,
        scrollContainer.clientWidth / duration,
      )
    }
    const audioContentWidth = () => {
      if (!scrollContainer) return 0
      return (
        maximumAudioScroll(
          wavesurfer.getDuration(),
          audioPixelsPerSecond(),
          scrollContainer.clientWidth,
        ) + scrollContainer.clientWidth
      )
    }
    const audioMaximumScroll = () => {
      if (!scrollContainer) return 0
      return Math.max(audioContentWidth() - scrollContainer.clientWidth, 0)
    }
    let activeRegionDrag:
      | {
          pointerId: number
          pointerX: number
          regionId: string
          resizing: boolean
          origin: {
            start: number
            end: number
            pointerX: number
            scrollLeft: number
            pixelsPerSecond: number
          }
        }
      | undefined
    let regionDragFrame = 0

    const unsubscribeInitialized = regionsPlugin.on(
      'region-initialized',
      (region) => {
        if (region.id.startsWith('region-')) {
          region.setOptions({ id: crypto.randomUUID() })
        }
      },
    )
    const clampRenderedRegion = (
      region: Region,
      bounds: Pick<RegionMetadata, 'start' | 'end'>,
    ): RegionMetadata => {
      if (
        Math.abs(region.start - bounds.start) > 1e-7 ||
        Math.abs(region.end - bounds.end) > 1e-7
      ) {
        synchronizationRef.current = true
        try {
          region.setOptions(bounds)
        } finally {
          synchronizationRef.current = false
        }
      }
      lastValidRegionsRef.current.set(region.id, bounds)
      return { id: region.id, ...bounds, data: {} }
    }
    const applyActiveRegionDrag = (region: Region): RegionMetadata | null => {
      if (
        !activeRegionDrag ||
        activeRegionDrag.resizing ||
        activeRegionDrag.regionId !== region.id ||
        !scrollContainer
      ) {
        return null
      }
      const bounds = regionDragBounds(
        activeRegionDrag.origin,
        activeRegionDrag.pointerX,
        scrollContainer.scrollLeft,
        wavesurfer.getDuration(),
      )
      return bounds ? clampRenderedRegion(region, bounds) : null
    }
    const unsubscribeCreated = regionsPlugin.on('region-created', (region) => {
      applyRegionHandlePresentation(region)
      if (synchronizationRef.current) return
      const metadata = regionMetadata(region, wavesurfer.getDuration())
      if (!metadata) {
        region.remove()
        return
      }
      const clamped = clampRenderedRegion(region, metadata)
      callbacksRef.current.onRegionCreate(clamped)
      selectRegion(clamped.id)
      if (wavesurfer.isPlaying()) {
        pendingPlaybackRegionIdRef.current = null
        wavesurfer.setTime(clamped.start)
      } else {
        pendingPlaybackRegionIdRef.current = clamped.id
      }
    })
    const unsubscribeRegionUpdate = regionsPlugin.on(
      'region-update',
      (region, side) => {
        if (synchronizationRef.current) return
        const previous = lastValidRegionsRef.current.get(region.id)
        if (activeRegionDrag?.regionId === region.id && side) {
          activeRegionDrag.resizing = true
        }
        const dragged = !side ? applyActiveRegionDrag(region) : null
        const bounds =
          dragged ??
          (previous
            ? clampRegionEdit(
                previous,
                region.start,
                region.end,
                wavesurfer.getDuration(),
              )
            : normalizeRegion(
                region.start,
                region.end,
                wavesurfer.getDuration(),
              ))
        if (bounds) {
          callbacksRef.current.onRegionLiveChange(
            dragged ?? clampRenderedRegion(region, bounds),
          )
        }
      },
    )
    const unsubscribeRegionUpdated = regionsPlugin.on(
      'region-updated',
      (region) => {
        if (synchronizationRef.current) return
        const dragged = applyActiveRegionDrag(region)
        const bounds = dragged
          ? dragged
          : normalizeRegion(region.start, region.end, wavesurfer.getDuration())
        if (bounds) {
          callbacksRef.current.onRegionCommit(
            dragged ?? clampRenderedRegion(region, bounds),
          )
        }
      },
    )
    const unsubscribeRegionClicked = regionsPlugin.on(
      'region-clicked',
      (region, event) => {
        event.stopPropagation()
        selectRegion(region.id)
        pendingPlaybackRegionIdRef.current = null
        const regionBounds = region.element?.getBoundingClientRect()
        if (regionBounds && regionBounds.width > 0) {
          const clickRatio = Math.min(
            Math.max(
              (event.clientX - regionBounds.left) / regionBounds.width,
              0,
            ),
            1,
          )
          wavesurfer.setTime(
            region.start + clickRatio * (region.end - region.start),
          )
        }
      },
    )
    const unsubscribeRegionDoubleClicked = regionsPlugin.on(
      'region-double-clicked',
      (region, event) => {
        event.preventDefault()
        event.stopPropagation()
        selectRegion(region.id)
        pendingPlaybackRegionIdRef.current = null
        if (spectrumEnabledRef.current) void activateAudioAnalyzer()
        if (meterEnabledRef.current) void activateLoudnessMeter()
        void wavesurfer
          .play(region.start, region.end)
          .catch(reportPlaybackError)
      },
    )

    const disableRegionCreation = readOnly
      ? () => undefined
      : regionsPlugin.enableDragSelection(
          {
            color: REGION_COLOR,
            drag: true,
            resize: true,
            minLength: 0.001,
          },
          3,
        )

    const scrollbar = scrollbarElementRef.current
    const scrollbarTrack = scrollbarTrackElementRef.current
    let activePan:
      { pointerId: number; startX: number; startScroll: number } | undefined
    let minimapElement: HTMLElement | null = null
    let minimapPan:
      | {
          pointerId: number
          startX: number
          startScroll: number
          width: number
          moved: boolean
        }
      | undefined
    let suppressMinimapClick = false
    let minimapClickReset = 0
    let scrollbarFrame = 0
    let pendingWheelRegionCommit:
      { metadata: RegionMetadata; timeout: number } | undefined

    const syncScrollbar = () => {
      if (!scrollContainer || !scrollbar || !scrollbarTrack) return
      const contentWidth = audioContentWidth()
      const maximumScroll = audioMaximumScroll()
      scrollbarTrack.style.width = `${contentWidth}px`
      const canScroll = maximumScroll > 1
      scrollbar.classList.toggle(styles.scrollbarInactive!, !canScroll)
      scrollbar.setAttribute('aria-disabled', String(!canScroll))
      scrollbar.tabIndex = canScroll ? 0 : -1
      if (scrollContainer.scrollLeft > maximumScroll) {
        scrollContainer.scrollLeft = maximumScroll
      }
      if (Math.abs(scrollbar.scrollLeft - scrollContainer.scrollLeft) > 0.5) {
        scrollbar.scrollLeft = scrollContainer.scrollLeft
      }
    }
    const scheduleScrollbarSync = () => {
      cancelAnimationFrame(scrollbarFrame)
      scrollbarFrame = requestAnimationFrame(syncScrollbar)
    }
    const handleMainScroll = () => {
      if (!scrollContainer || !scrollbar) return
      const maximumScroll = audioMaximumScroll()
      if (scrollContainer.scrollLeft > maximumScroll) {
        scrollContainer.scrollLeft = maximumScroll
      }
      if (!scrollWidthsMatch(audioContentWidth(), scrollbar.scrollWidth)) {
        scheduleScrollbarSync()
        return
      }
      scrollbar.scrollLeft = scrollContainer.scrollLeft
    }
    const handleScrollbarScroll = () => {
      if (!scrollContainer || !scrollbar) return
      if (!scrollWidthsMatch(audioContentWidth(), scrollbar.scrollWidth)) {
        scheduleScrollbarSync()
        return
      }
      scrollContainer.scrollLeft = Math.min(
        scrollbar.scrollLeft,
        audioMaximumScroll(),
      )
    }
    const handleMinimapWheel = (event: WheelEvent) => {
      if (!minimapElement || !scrollContainer) return
      event.preventDefault()
      event.stopPropagation()

      const minimapBounds = minimapElement.getBoundingClientRect()
      const scrollBounds = scrollContainer.getBoundingClientRect()
      const relativeX =
        (event.clientX - minimapBounds.left) / Math.max(minimapBounds.width, 1)
      const mappedClientX =
        scrollBounds.left +
        Math.min(Math.max(relativeX, 0), 1) * scrollContainer.clientWidth

      scrollContainer.dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          deltaMode: event.deltaMode,
          clientX: mappedClientX,
          clientY: scrollBounds.top + scrollBounds.height / 2,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          bubbles: true,
          cancelable: true,
        }),
      )
    }
    const rememberPlayingOnPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const eventPath = event.composedPath()
      const clickedRegion = regionsPlugin
        .getRegions()
        .some(
          (region) =>
            region.element !== null && eventPath.includes(region.element),
        )
      restorePlaybackAfterEmptyClickRef.current =
        !clickedRegion && wavesurfer.isPlaying()
    }
    const handleMinimapPointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !minimapElement ||
        !scrollContainer ||
        scrollContainer.scrollWidth <= scrollContainer.clientWidth
      ) {
        return
      }
      minimapPan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScroll: scrollContainer.scrollLeft,
        width: minimapElement.getBoundingClientRect().width,
        moved: false,
      }
      minimapElement.setPointerCapture(event.pointerId)
    }
    const handleMinimapPointerMove = (event: PointerEvent) => {
      if (
        !minimapPan ||
        minimapPan.pointerId !== event.pointerId ||
        !minimapElement ||
        !scrollContainer
      ) {
        return
      }
      const deltaX = event.clientX - minimapPan.startX
      if (!minimapPan.moved && Math.abs(deltaX) < 3) return
      minimapPan.moved = true
      event.preventDefault()
      event.stopPropagation()
      minimapElement.classList.add('is-minimap-panning')
      scrollContainer.scrollLeft =
        minimapPan.startScroll +
        (deltaX / Math.max(minimapPan.width, 1)) * scrollContainer.scrollWidth
    }
    const finishMinimapPan = (event: PointerEvent) => {
      if (
        !minimapPan ||
        minimapPan.pointerId !== event.pointerId ||
        !minimapElement
      ) {
        return
      }
      const moved = minimapPan.moved
      if (minimapElement.hasPointerCapture(event.pointerId)) {
        minimapElement.releasePointerCapture(event.pointerId)
      }
      minimapElement.classList.remove('is-minimap-panning')
      minimapPan = undefined
      if (moved) {
        event.preventDefault()
        event.stopPropagation()
        suppressMinimapClick = true
        window.clearTimeout(minimapClickReset)
        minimapClickReset = window.setTimeout(() => {
          suppressMinimapClick = false
        }, 0)
      }
    }
    const handleMinimapClick = (event: MouseEvent) => {
      if (!suppressMinimapClick) return
      event.preventDefault()
      event.stopImmediatePropagation()
      suppressMinimapClick = false
    }
    const connectMinimapNavigation = () => {
      const nextMinimapElement =
        minimapContainer.querySelector<HTMLElement>('[part~="minimap"]')
      if (!nextMinimapElement || nextMinimapElement === minimapElement) return
      minimapElement = nextMinimapElement
      minimapElement.addEventListener('wheel', handleMinimapWheel, {
        capture: true,
        passive: false,
      })
      minimapElement.addEventListener(
        'pointerdown',
        rememberPlayingOnPointerDown,
        true,
      )
      minimapElement.addEventListener(
        'pointerdown',
        handleMinimapPointerDown,
        true,
      )
      minimapElement.addEventListener(
        'pointermove',
        handleMinimapPointerMove,
        true,
      )
      minimapElement.addEventListener('pointerup', finishMinimapPan, true)
      minimapElement.addEventListener('pointercancel', finishMinimapPan, true)
      minimapElement.addEventListener('click', handleMinimapClick, true)
    }
    const queueWheelRegionCommit = (metadata: RegionMetadata) => {
      if (
        pendingWheelRegionCommit &&
        pendingWheelRegionCommit.metadata.id !== metadata.id
      ) {
        window.clearTimeout(pendingWheelRegionCommit.timeout)
        callbacksRef.current.onRegionCommit(pendingWheelRegionCommit.metadata)
        pendingWheelRegionCommit = undefined
      }

      if (pendingWheelRegionCommit) {
        window.clearTimeout(pendingWheelRegionCommit.timeout)
      }
      const timeout = window.setTimeout(() => {
        callbacksRef.current.onRegionCommit(metadata)
        pendingWheelRegionCommit = undefined
      }, 160)
      pendingWheelRegionCommit = { metadata, timeout }
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.altKey && event.deltaY !== 0) {
        event.preventDefault()
        event.stopImmediatePropagation()
        verticalScaleRef.current = steppedVerticalScale(
          verticalScaleRef.current,
          event.deltaY < 0 ? 'in' : 'out',
        )
        wavesurfer.setOptions({ barHeight: verticalScaleRef.current })
        callbacksRef.current.onVerticalScaleChange(verticalScaleRef.current)
        return
      }
      if (!event.shiftKey) {
        if (
          !scrollContainer ||
          Math.abs(event.deltaX) >= Math.abs(event.deltaY)
        ) {
          return
        }

        const duration = wavesurfer.getDuration()
        const viewportWidth = scrollContainer.clientWidth
        const currentZoom =
          wavesurfer.options.minPxPerSec > 0
            ? wavesurfer.options.minPxPerSec
            : scrollContainer.scrollWidth / Math.max(duration, 1)
        const currentScroll = scrollContainer.scrollLeft
        const pointerX =
          event.clientX - scrollContainer.getBoundingClientRect().left

        queueMicrotask(() => {
          if (disposed || duration <= 0) return
          const nextZoom =
            wavesurfer.options.minPxPerSec > 0
              ? wavesurfer.options.minPxPerSec
              : scrollContainer.scrollWidth / duration
          wavesurfer.setScroll(
            cursorCenteredScroll({
              currentZoom,
              currentScroll,
              pointerX,
              nextZoom,
              viewportWidth,
              duration,
            }),
          )
        })
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!scrollContainer) return
      const rawDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX
      const pixelDelta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? rawDelta * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? rawDelta * scrollContainer.clientWidth
            : rawDelta
      const renderedRegions = regionsPlugin.getRegions()
      const selectedId = selectedRegionIdRef.current
      if (shiftWheelMode(selectedId) === 'pan') {
        scrollContainer.scrollLeft = clampedWheelScroll(
          scrollContainer.scrollLeft,
          pixelDelta,
          audioMaximumScroll(),
        )
        return
      }
      if (readOnly) return
      const targetRegion = renderedRegions.find(
        (region) => region.id === selectedId,
      )

      if (targetRegion) {
        const duration = wavesurfer.getDuration()
        const pixelsPerSecond = Math.max(
          wavesurfer.options.minPxPerSec,
          scrollContainer.scrollWidth / Math.max(duration, 1),
        )
        const translated = translateRegion(
          targetRegion.start,
          targetRegion.end,
          (pixelDelta * REGION_WHEEL_NUDGE_RATIO) / pixelsPerSecond,
          duration,
        )
        if (
          translated &&
          (translated.start !== targetRegion.start ||
            translated.end !== targetRegion.end)
        ) {
          targetRegion.setOptions(translated)
          lastValidRegionsRef.current.set(targetRegion.id, translated)
          const metadata = regionMetadata(targetRegion, duration)
          if (metadata) {
            callbacksRef.current.onRegionLiveChange(metadata)
            queueWheelRegionCommit(metadata)
          }
        }
        return
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      const shouldPan =
        event.button === 1 || (event.button === 0 && event.altKey)
      if (!shouldPan || !scrollContainer) return
      event.preventDefault()
      event.stopImmediatePropagation()
      activePan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScroll: scrollContainer.scrollLeft,
      }
      scrollContainer.setPointerCapture(event.pointerId)
      container.classList.add(styles.panning!)
    }
    const runRegionAutoScroll = () => {
      cancelAnimationFrame(regionDragFrame)
      const tick = () => {
        if (!activeRegionDrag || !scrollContainer) return
        if (!activeRegionDrag.resizing) {
          const viewport = scrollContainer.getBoundingClientRect()
          const maximumScroll = audioMaximumScroll()
          const delta = viewportAutoScrollDelta(
            activeRegionDrag.pointerX,
            viewport.left,
            viewport.right,
            scrollContainer.scrollLeft,
            maximumScroll,
          )
          if (delta !== 0) {
            scrollContainer.scrollLeft = Math.min(
              Math.max(scrollContainer.scrollLeft + delta, 0),
              maximumScroll,
            )
            const region = regionsPlugin
              .getRegions()
              .find((item) => item.id === activeRegionDrag?.regionId)
            if (region) {
              const metadata = applyActiveRegionDrag(region)
              if (metadata) callbacksRef.current.onRegionLiveChange(metadata)
            }
          }
        }
        regionDragFrame = requestAnimationFrame(tick)
      }
      regionDragFrame = requestAnimationFrame(tick)
    }
    const beginRegionDrag = (event: PointerEvent) => {
      if (readOnly || event.button !== 0 || event.altKey || !scrollContainer) {
        return
      }
      const path = event.composedPath()
      const region = regionsPlugin
        .getRegions()
        .find((item) => item.element !== null && path.includes(item.element))
      if (!region) return
      const resizing = path.some(
        (item) =>
          item instanceof Element &&
          (item.getAttribute('part') ?? '').includes('region-handle'),
      )
      const duration = wavesurfer.getDuration()
      const bounds = normalizeRegion(region.start, region.end, duration)
      if (!bounds || duration <= 0) return
      activeRegionDrag = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        regionId: region.id,
        resizing,
        origin: {
          ...bounds,
          pointerX: event.clientX,
          scrollLeft: scrollContainer.scrollLeft,
          pixelsPerSecond: audioPixelsPerSecond(),
        },
      }
      runRegionAutoScroll()
    }
    const trackRegionDrag = (event: PointerEvent) => {
      if (
        !activeRegionDrag ||
        activeRegionDrag.pointerId !== event.pointerId ||
        activeRegionDrag.resizing
      ) {
        return
      }
      activeRegionDrag.pointerX = event.clientX
      const region = regionsPlugin
        .getRegions()
        .find((item) => item.id === activeRegionDrag?.regionId)
      if (!region) return
      const metadata = applyActiveRegionDrag(region)
      if (metadata) callbacksRef.current.onRegionLiveChange(metadata)
    }
    const finishRegionDrag = (event: PointerEvent) => {
      const finishing = activeRegionDrag
      if (!finishing || finishing.pointerId !== event.pointerId) return
      cancelAnimationFrame(regionDragFrame)
      queueMicrotask(() => {
        if (activeRegionDrag !== finishing) return
        const region = regionsPlugin
          .getRegions()
          .find((item) => item.id === finishing.regionId)
        const metadata = region ? applyActiveRegionDrag(region) : null
        if (metadata) callbacksRef.current.onRegionCommit(metadata)
        activeRegionDrag = undefined
      })
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (
        !activePan ||
        activePan.pointerId !== event.pointerId ||
        !scrollContainer
      ) {
        return
      }
      event.preventDefault()
      scrollContainer.scrollLeft =
        activePan.startScroll - (event.clientX - activePan.startX)
    }
    const finishPan = (event: PointerEvent) => {
      if (
        !activePan ||
        activePan.pointerId !== event.pointerId ||
        !scrollContainer
      ) {
        return
      }
      event.preventDefault()
      if (scrollContainer.hasPointerCapture(event.pointerId)) {
        scrollContainer.releasePointerCapture(event.pointerId)
      }
      activePan = undefined
      container.classList.remove(styles.panning!)
    }

    scrollContainer?.addEventListener('wheel', handleWheel, {
      capture: true,
      passive: false,
    })
    scrollContainer?.addEventListener(
      'pointerdown',
      rememberPlayingOnPointerDown,
      true,
    )
    scrollContainer?.addEventListener('pointerdown', beginRegionDrag, true)
    scrollContainer?.addEventListener('pointermove', trackRegionDrag, true)
    scrollContainer?.addEventListener('pointerup', finishRegionDrag, true)
    scrollContainer?.addEventListener('pointercancel', finishRegionDrag, true)
    scrollContainer?.addEventListener('pointerdown', handlePointerDown, true)
    scrollContainer?.addEventListener('pointermove', handlePointerMove, true)
    scrollContainer?.addEventListener('pointerup', finishPan, true)
    scrollContainer?.addEventListener('pointercancel', finishPan, true)
    scrollContainer?.addEventListener('scroll', handleMainScroll, {
      passive: true,
    })
    scrollbar?.addEventListener('scroll', handleScrollbarScroll, {
      passive: true,
    })
    const unsubscribeRedraw = wavesurfer.on('redraw', scheduleScrollbarSync)
    const unsubscribeResize = wavesurfer.on('resize', scheduleScrollbarSync)
    const unsubscribeMinimapReady = minimapPlugin.on('ready', () => {
      connectMinimapNavigation()
      scheduleScrollbarSync()
    })
    const unsubscribeMinimapClick = minimapPlugin.on('click', (relativeX) => {
      seekAfterClearingSelection(relativeX)
    })
    scheduleScrollbarSync()

    void wavesurfer.load(audioUrl).catch(reportLoadError)

    return () => {
      disposed = true
      disableRegionCreation()
      unsubscribeReady()
      unsubscribeError()
      unsubscribeTime()
      unsubscribePlay()
      unsubscribePause()
      unsubscribeFinish()
      unsubscribeInteraction()
      unsubscribeWaveformClick()
      unsubscribeZoom()
      unsubscribeInitialized()
      unsubscribeCreated()
      unsubscribeRegionUpdate()
      unsubscribeRegionUpdated()
      unsubscribeRegionClicked()
      unsubscribeRegionDoubleClicked()
      unsubscribeRedraw()
      unsubscribeResize()
      unsubscribeMinimapReady()
      unsubscribeMinimapClick()
      cancelAnimationFrame(scrollbarFrame)
      cancelAnimationFrame(regionDragFrame)
      window.clearTimeout(minimapClickReset)
      if (pendingWheelRegionCommit) {
        window.clearTimeout(pendingWheelRegionCommit.timeout)
      }
      scrollContainer?.removeEventListener('wheel', handleWheel, true)
      scrollContainer?.removeEventListener(
        'pointerdown',
        rememberPlayingOnPointerDown,
        true,
      )
      scrollContainer?.removeEventListener('pointerdown', beginRegionDrag, true)
      scrollContainer?.removeEventListener('pointermove', trackRegionDrag, true)
      scrollContainer?.removeEventListener('pointerup', finishRegionDrag, true)
      scrollContainer?.removeEventListener(
        'pointercancel',
        finishRegionDrag,
        true,
      )
      scrollContainer?.removeEventListener(
        'pointerdown',
        handlePointerDown,
        true,
      )
      scrollContainer?.removeEventListener(
        'pointermove',
        handlePointerMove,
        true,
      )
      scrollContainer?.removeEventListener('pointerup', finishPan, true)
      scrollContainer?.removeEventListener('pointercancel', finishPan, true)
      scrollContainer?.removeEventListener('scroll', handleMainScroll)
      scrollbar?.removeEventListener('scroll', handleScrollbarScroll)
      minimapElement?.removeEventListener('wheel', handleMinimapWheel, true)
      minimapElement?.removeEventListener(
        'pointerdown',
        rememberPlayingOnPointerDown,
        true,
      )
      minimapElement?.removeEventListener(
        'pointerdown',
        handleMinimapPointerDown,
        true,
      )
      minimapElement?.removeEventListener(
        'pointermove',
        handleMinimapPointerMove,
        true,
      )
      minimapElement?.removeEventListener('pointerup', finishMinimapPan, true)
      minimapElement?.removeEventListener(
        'pointercancel',
        finishMinimapPan,
        true,
      )
      minimapElement?.removeEventListener('click', handleMinimapClick, true)
      setMediaElement((current) =>
        current === wavesurferMediaElement ? null : current,
      )
      setDecodedAudio(null)
      wavesurfer.destroy()
      if (wavesurferRef.current === wavesurfer) wavesurferRef.current = null
      if (regionsPluginRef.current === regionsPlugin)
        regionsPluginRef.current = null
    }
  }, [activateAudioAnalyzer, activateLoudnessMeter, audioUrl, readOnly])

  useEffect(() => {
    const wavesurfer = wavesurferRef.current
    const plugin = regionsPluginRef.current
    if (!wavesurfer || !plugin || wavesurfer.getDuration() <= 0) return

    synchronizationRef.current = true
    try {
      const duration = wavesurfer.getDuration()
      const normalizedRegions = regions.flatMap((region) => {
        const bounds = normalizeRegion(region.start, region.end, duration)
        return bounds ? [{ ...region, ...bounds }] : []
      })
      const expected = new Map(
        normalizedRegions.map((region) => [region.id, region]),
      )
      for (const regionId of lastValidRegionsRef.current.keys()) {
        if (!expected.has(regionId))
          lastValidRegionsRef.current.delete(regionId)
      }
      for (const renderedRegion of plugin.getRegions()) {
        if (!expected.has(renderedRegion.id)) renderedRegion.remove()
      }

      for (const metadata of normalizedRegions) {
        lastValidRegionsRef.current.set(metadata.id, metadata)
        const renderedRegion = plugin
          .getRegions()
          .find((region) => region.id === metadata.id)
        const visual = regionVisualColors(
          typeof metadata.data.color === 'string'
            ? metadata.data.color
            : undefined,
          metadata.id === selectedRegionId,
        )
        if (renderedRegion) {
          renderedRegion.setOptions({
            start: metadata.start,
            end: metadata.end,
            color: visual.fill,
          })
          if (renderedRegion.element) {
            renderedRegion.element.style.border = `1px solid ${visual.border}`
            renderedRegion.element.style.boxSizing = 'border-box'
          }
        } else {
          const addedRegion = plugin.addRegion({
            id: metadata.id,
            start: metadata.start,
            end: metadata.end,
            color: visual.fill,
            drag: !readOnly,
            resize: !readOnly,
            minLength: 0.001,
          })
          if (addedRegion.element) {
            addedRegion.element.style.border = `1px solid ${visual.border}`
            addedRegion.element.style.boxSizing = 'border-box'
          }
        }
      }
    } finally {
      synchronizationRef.current = false
    }
  }, [instanceVersion, readOnly, regions, selectedRegionId])

  useEffect(() => {
    const wavesurfer = wavesurferRef.current
    const container = spectrogramElementRef.current
    const viewport = spectrogramViewportElementRef.current
    if (
      !spectrogramEnabled ||
      !wavesurfer ||
      !container ||
      !viewport ||
      instanceVersion === 0
    ) {
      return
    }

    const scrollContainer = wavesurfer.getWrapper().parentElement
    if (!scrollContainer) return

    let synchronizationFrame = 0
    const synchronizeSpectrogram = () => {
      const geometry = spectrogramViewportGeometry(
        scrollContainer.scrollWidth,
        scrollContainer.clientWidth,
        scrollContainer.scrollLeft,
      )
      container.style.width = `${geometry.contentWidth}px`
      if (Math.abs(viewport.scrollLeft - geometry.scrollLeft) > 0.5) {
        viewport.scrollLeft = geometry.scrollLeft
      }
    }
    const scheduleSynchronization = () => {
      cancelAnimationFrame(synchronizationFrame)
      synchronizationFrame = requestAnimationFrame(synchronizeSpectrogram)
    }

    synchronizeSpectrogram()
    const plugin = wavesurfer.registerPlugin(
      WindowedSpectrogramPlugin.create({
        container,
        height: 150,
        labels: false,
        fftSamples: 1024,
        scale: 'logarithmic',
        colorMap: 'igray',
        windowSize: 24,
        bufferSize: 600,
        progressiveLoading: false,
        useWebWorker: true,
        fallbackToMainThread: false,
      }),
    )
    const unsubscribeError = plugin.on('error', (error) => {
      callbacksRef.current.onError(
        `Spectrogram unavailable: ${errorMessage(error)}`,
      )
    })
    const unsubscribeReady = plugin.on('ready', scheduleSynchronization)
    const unsubscribeScroll = wavesurfer.on('scroll', scheduleSynchronization)
    const unsubscribeRedraw = wavesurfer.on('redraw', scheduleSynchronization)
    const unsubscribeResize = wavesurfer.on('resize', scheduleSynchronization)
    scheduleSynchronization()

    return () => {
      unsubscribeError()
      unsubscribeReady()
      unsubscribeScroll()
      unsubscribeRedraw()
      unsubscribeResize()
      cancelAnimationFrame(synchronizationFrame)
      if (wavesurfer.getActivePlugins().includes(plugin)) {
        wavesurfer.unregisterPlugin(plugin)
      }
    }
  }, [instanceVersion, spectrogramEnabled])

  const selectedRegion =
    regions.find((region) => region.id === selectedRegionId) ?? null

  return (
    <div
      className={`${styles.root}${meterEnabled ? ` ${styles.withMeter}` : ''}`}
    >
      <div className={styles.stack}>
        <div
          className={styles.surface}
          ref={waveformElementRef}
          aria-label="Audio waveform. Drag empty space to create a region."
        />
        <div className={styles.minimap} ref={minimapElementRef} />
        <div
          className={`${styles.scrollbar} ${styles.scrollbarInactive}`}
          ref={scrollbarElementRef}
          role="region"
          aria-label="Scroll waveform horizontally"
          aria-disabled="true"
          tabIndex={-1}
        >
          <div
            className={styles.scrollbarTrack}
            ref={scrollbarTrackElementRef}
            aria-hidden="true"
          />
        </div>
        {spectrogramEnabled && (
          <section className={styles.spectrogram} aria-label="Spectrogram">
            <header className={styles.spectrogramHeader}>
              <h2 className={styles.spectrogramTitle}>Spectrogram</h2>
              <button
                className={styles.spectrogramClose}
                type="button"
                onClick={onHideSpectrogram}
                aria-label="Hide spectrogram"
                title="Hide spectrogram"
              >
                ×
              </button>
            </header>
            <div className={styles.spectrogramDisplay}>
              <div
                className={styles.spectrogramViewport}
                ref={spectrogramViewportElementRef}
              >
                <div
                  className={styles.spectrogramSurface}
                  ref={spectrogramElementRef}
                />
              </div>
              <div className={styles.spectrogramAxis} aria-hidden="true">
                {spectrogramAxisLabels.map((frequency) => {
                  const position = logarithmicFrequencyY(
                    frequency,
                    spectrogramMaxFrequency,
                  )
                  const top = Math.min(Math.max(position * 100, 6.7), 93.3)
                  return (
                    <span
                      className={styles.spectrogramAxisLabel}
                      key={frequency}
                      style={{ top: `${top}%` }}
                    >
                      {formatFrequencyLabel(frequency)}
                      <small className={styles.spectrogramAxisUnit}>
                        {frequency >= 1_000 ? 'kHz' : 'Hz'}
                      </small>
                    </span>
                  )
                })}
              </div>
            </div>
          </section>
        )}
        {spectrumEnabled && (
          <SpectrumAnalyzer
            analyserNode={audioAnalyzer.analyserNode}
            analyzerError={audioAnalyzer.error}
            fftSize={audioAnalyzer.fftSize}
            isPlaying={isPlaying}
            sampleRate={audioAnalyzer.sampleRate}
            onResponseChange={audioAnalyzer.setSpectrumResponse}
            onClose={onHideSpectrum}
          />
        )}
      </div>
      {meterEnabled && (
        <LoudnessMeter
          audioBuffer={decodedAudio}
          live={audioAnalyzer.loudnessSnapshot}
          selectedRegion={selectedRegion}
          error={audioAnalyzer.error}
          onClose={onHideMeter}
        />
      )}
    </div>
  )
})
