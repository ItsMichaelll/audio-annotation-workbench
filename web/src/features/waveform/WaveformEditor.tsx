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
import { normalizeRegion, translateRegion } from '../../domain/region'
import { clampTime, formatTime } from '../../domain/transport'
import { SpectrumAnalyzer } from '../spectrum/SpectrumAnalyzer'
import { useAudioAnalyzer } from '../spectrum/useAudioAnalyzer'
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

const REGION_COLOR = 'rgba(70, 144, 255, 0.28)'
const SELECTED_REGION_COLOR = 'rgba(70, 144, 255, 0.42)'
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

export interface WaveformEditorHandle {
  activateSpectrum(): void
  fit(): void
  playPause(): void
  resetVerticalScale(): void
  seekBy(seconds: number): void
  seekTo(seconds: number): void
  zoom(direction: 'in' | 'out'): void
}

interface WaveformEditorProps {
  audioUrl: string
  regions: readonly RegionMetadata[]
  selectedRegionId: string | null
  loopEnabled: boolean
  spectrumEnabled: boolean
  spectrogramEnabled: boolean
  isPlaying: boolean
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
    spectrumEnabled,
    spectrogramEnabled,
    isPlaying,
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
  const selectedRegionIdRef = useRef(selectedRegionId)
  const loopEnabledRef = useRef(loopEnabled)
  const spectrumEnabledRef = useRef(spectrumEnabled)
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

  const audioAnalyzer = useAudioAnalyzer({
    mediaElement,
    onError: (message) => callbacksRef.current.onError(message),
  })
  const activateAudioAnalyzer = audioAnalyzer.activate
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

  const reportPlaybackError = (error: unknown) => {
    callbacksRef.current.onError(`Playback failed: ${errorMessage(error)}`)
  }

  useImperativeHandle(
    forwardedRef,
    () => ({
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
        if (!wavesurfer.isPlaying() && spectrumEnabledRef.current) {
          void activateAudioAnalyzer()
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
    [activateAudioAnalyzer],
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

    const unsubscribeInitialized = regionsPlugin.on(
      'region-initialized',
      (region) => {
        if (region.id.startsWith('region-')) {
          region.setOptions({ id: crypto.randomUUID() })
        }
      },
    )
    const unsubscribeCreated = regionsPlugin.on('region-created', (region) => {
      if (synchronizationRef.current) return
      const metadata = regionMetadata(region, wavesurfer.getDuration())
      if (!metadata) {
        region.remove()
        return
      }
      callbacksRef.current.onRegionCreate(metadata)
      selectRegion(metadata.id)
      if (wavesurfer.isPlaying()) {
        pendingPlaybackRegionIdRef.current = null
        wavesurfer.setTime(metadata.start)
      } else {
        pendingPlaybackRegionIdRef.current = metadata.id
      }
    })
    const unsubscribeRegionUpdate = regionsPlugin.on(
      'region-update',
      (region) => {
        if (synchronizationRef.current) return
        const metadata = regionMetadata(region, wavesurfer.getDuration())
        if (metadata) callbacksRef.current.onRegionLiveChange(metadata)
      },
    )
    const unsubscribeRegionUpdated = regionsPlugin.on(
      'region-updated',
      (region) => {
        if (synchronizationRef.current) return
        const metadata = regionMetadata(region, wavesurfer.getDuration())
        if (metadata) callbacksRef.current.onRegionCommit(metadata)
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
        void wavesurfer
          .play(region.start, region.end)
          .catch(reportPlaybackError)
      },
    )

    const disableRegionCreation = regionsPlugin.enableDragSelection(
      {
        color: REGION_COLOR,
        drag: true,
        resize: true,
        minLength: 0.001,
      },
      3,
    )

    const scrollContainer = wavesurfer.getWrapper().parentElement
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
      scrollbarTrack.style.width = `${scrollContainer.scrollWidth}px`
      const canScroll =
        scrollContainer.scrollWidth > scrollContainer.clientWidth + 1
      scrollbar.classList.toggle('is-inactive', !canScroll)
      scrollbar.setAttribute('aria-disabled', String(!canScroll))
      scrollbar.tabIndex = canScroll ? 0 : -1
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
      if (
        !scrollWidthsMatch(scrollContainer.scrollWidth, scrollbar.scrollWidth)
      ) {
        scheduleScrollbarSync()
        return
      }
      scrollbar.scrollLeft = scrollContainer.scrollLeft
    }
    const handleScrollbarScroll = () => {
      if (!scrollContainer || !scrollbar) return
      if (
        !scrollWidthsMatch(scrollContainer.scrollWidth, scrollbar.scrollWidth)
      ) {
        scheduleScrollbarSync()
        return
      }
      scrollContainer.scrollLeft = scrollbar.scrollLeft
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
      const eventPath = event.composedPath()
      const renderedRegions = regionsPlugin.getRegions()
      const hoveredRegion = renderedRegions.find(
        (region) =>
          region.element !== null && eventPath.includes(region.element),
      )
      const selectedRegion = selectedRegionIdRef.current
        ? renderedRegions.find(
            (region) => region.id === selectedRegionIdRef.current,
          )
        : undefined
      const targetRegion = hoveredRegion ?? selectedRegion

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
      scrollContainer.classList.add('is-panning')
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
      scrollContainer.classList.remove('is-panning')
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
      wavesurfer.destroy()
      if (wavesurferRef.current === wavesurfer) wavesurferRef.current = null
      if (regionsPluginRef.current === regionsPlugin)
        regionsPluginRef.current = null
    }
  }, [activateAudioAnalyzer, audioUrl])

  useEffect(() => {
    const wavesurfer = wavesurferRef.current
    const plugin = regionsPluginRef.current
    if (!wavesurfer || !plugin || wavesurfer.getDuration() <= 0) return

    synchronizationRef.current = true
    try {
      const expected = new Map(regions.map((region) => [region.id, region]))
      for (const renderedRegion of plugin.getRegions()) {
        if (!expected.has(renderedRegion.id)) renderedRegion.remove()
      }

      for (const metadata of regions) {
        const renderedRegion = plugin
          .getRegions()
          .find((region) => region.id === metadata.id)
        const color =
          metadata.id === selectedRegionId
            ? SELECTED_REGION_COLOR
            : REGION_COLOR
        if (renderedRegion) {
          renderedRegion.setOptions({
            start: metadata.start,
            end: metadata.end,
            color,
          })
        } else {
          plugin.addRegion({
            id: metadata.id,
            start: metadata.start,
            end: metadata.end,
            color,
            drag: true,
            resize: true,
            minLength: 0.001,
          })
        }
      }
    } finally {
      synchronizationRef.current = false
    }
  }, [instanceVersion, regions, selectedRegionId])

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

  return (
    <div className="waveform-stack">
      <div
        className="waveform-surface"
        ref={waveformElementRef}
        aria-label="Audio waveform. Drag empty space to create a region."
      />
      <div className="waveform-minimap" ref={minimapElementRef} />
      <div
        className="waveform-scrollbar is-inactive"
        ref={scrollbarElementRef}
        role="region"
        aria-label="Scroll waveform horizontally"
        aria-disabled="true"
        tabIndex={-1}
      >
        <div
          className="waveform-scrollbar__track"
          ref={scrollbarTrackElementRef}
          aria-hidden="true"
        />
      </div>
      {spectrogramEnabled && (
        <section className="spectrogram-panel" aria-label="Spectrogram">
          <header className="spectrogram-panel__header">
            <h2>Spectrogram</h2>
            <button
              type="button"
              onClick={onHideSpectrogram}
              aria-label="Hide spectrogram"
              title="Hide spectrogram"
            >
              ×
            </button>
          </header>
          <div className="spectrogram-display">
            <div
              className="spectrogram-viewport"
              ref={spectrogramViewportElementRef}
            >
              <div
                className="spectrogram-surface"
                ref={spectrogramElementRef}
              />
            </div>
            <div className="spectrogram-axis" aria-hidden="true">
              {spectrogramAxisLabels.map((frequency) => {
                const position = logarithmicFrequencyY(
                  frequency,
                  spectrogramMaxFrequency,
                )
                const top = Math.min(Math.max(position * 100, 6.7), 93.3)
                return (
                  <span key={frequency} style={{ top: `${top}%` }}>
                    {formatFrequencyLabel(frequency)}
                    <small>{frequency >= 1_000 ? 'kHz' : 'Hz'}</small>
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
          onResponseChange={audioAnalyzer.setResponse}
          onClose={onHideSpectrum}
        />
      )}
    </div>
  )
})
