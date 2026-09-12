import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ApplicationHeader } from './components/ApplicationHeader'
import { KeyboardHelp } from './components/KeyboardHelp'
import { Icon } from './components/Icon'
import { AnnotationList } from './components/AnnotationList'
import type { MarkerControlsProps } from './components/MarkerControls'
import { RegionTiming } from './components/RegionTiming'
import { StatusReadout } from './components/StatusReadout'
import {
  TransportBar,
  WaveformToolbar,
  type TransportBarProps,
} from './components/TransportBar'
import { SnapshotHistory, type HistoryState } from './domain/history'
import {
  isDialogTarget,
  isEditableTarget,
  keyboardCommand,
} from './domain/keyboard'
import {
  addMarker,
  adjacentMarker,
  MARKER_TIME_TOLERANCE_SECONDS,
  markerOrdinal,
  removeMarker,
  updateMarker,
} from './domain/marker'
import type { MarkerAnnotation } from './domain/models'
import {
  adjacentRegion,
  regionSnapshotsEqual,
  removeRegion,
  type RegionMetadata,
  upsertRegion,
} from './domain/region'
import {
  WaveformEditor,
  type WaveformEditorHandle,
} from './features/waveform/WaveformEditor'
import styles from './components/EditorWorkspace.module.css'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const AUDIO_EXTENSION =
  /\.(aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav|wave|webm)$/i

const EMPTY_STATE_WAVE_HEIGHTS = [
  8, 15, 29, 41, 38, 63, 41, 28, 55, 37, 52, 69, 75, 48, 62, 31, 62, 52, 84, 59,
  48, 71, 55, 76, 60, 41, 53, 33, 47, 52, 63, 71, 55, 72, 60, 51, 36, 48, 26,
  34, 28, 15, 5,
]

export function StandaloneEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const waveformRef = useRef<WaveformEditorHandle>(null)
  const activeObjectUrlRef = useRef<string | null>(null)
  const regionsRef = useRef<RegionMetadata[]>([])
  const markersRef = useRef<MarkerAnnotation[]>([])
  const historyRef = useRef(
    new SnapshotHistory<RegionMetadata[]>([], regionSnapshotsEqual),
  )

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [zoom, setZoom] = useState(0)
  const [verticalScale, setVerticalScale] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [regions, setRegions] = useState<RegionMetadata[]>([])
  const [markers, setMarkers] = useState<MarkerAnnotation[]>([])
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [waveformFocused, setWaveformFocused] = useState(false)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [spectrumEnabled, setSpectrumEnabled] = useState(false)
  const [spectrogramEnabled, setSpectrogramEnabled] = useState(false)
  const [meterEnabled, setMeterEnabled] = useState(false)
  const [historyAvailability, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  })

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? null,
    [regions, selectedRegionId],
  )
  const isLoaded = loadStatus === 'ready'
  const selectedMarker =
    markers.find((marker) => marker.id === selectedMarkerId) ?? null
  const selectedMarkerOrdinal = markerOrdinal(markers, selectedMarkerId)
  const previousRegion = adjacentRegion(regions, selectedRegionId, 'previous')
  const nextRegion = adjacentRegion(regions, selectedRegionId, 'next')
  const previousMarker = adjacentMarker(
    markers,
    selectedMarkerId,
    currentTime,
    'previous',
  )
  const nextMarker = adjacentMarker(
    markers,
    selectedMarkerId,
    currentTime,
    'next',
  )

  const navigateRegion = useCallback(
    (direction: 'previous' | 'next') => {
      const destination = adjacentRegion(regions, selectedRegionId, direction)
      if (!destination) return
      setSelectedMarkerId(null)
      setSelectedRegionId(destination.id)
      setLoopEnabled(true)
      waveformRef.current?.revealRegion(destination.start, destination.end)
    },
    [regions, selectedRegionId],
  )

  const navigateMarker = useCallback(
    (direction: 'previous' | 'next'): boolean => {
      const destination = adjacentMarker(
        markersRef.current,
        selectedMarkerId,
        waveformRef.current?.getCurrentTime() ?? currentTime,
        direction,
      )
      if (!destination) return false
      setSelectedRegionId(null)
      setLoopEnabled(false)
      setSelectedMarkerId(destination.id)
      waveformRef.current?.seekToMarker(destination.time)
      return true
    },
    [currentTime, selectedMarkerId],
  )

  const applyHistoryState = useCallback(
    (state: HistoryState<RegionMetadata[]>) => {
      setHistoryAvailability({ canUndo: state.canUndo, canRedo: state.canRedo })
      regionsRef.current = state.present
      setRegions(state.present)
      if (
        selectedRegionId !== null &&
        !state.present.some((region) => region.id === selectedRegionId)
      ) {
        setSelectedRegionId(null)
        setLoopEnabled(false)
      }
    },
    [selectedRegionId],
  )

  const commitRegions = useCallback(
    (nextRegions: RegionMetadata[]) => {
      applyHistoryState(historyRef.current.commit(nextRegions))
    },
    [applyHistoryState],
  )

  const handleRegionCreate = useCallback(
    (region: RegionMetadata) => {
      commitRegions(upsertRegion(regionsRef.current, region))
    },
    [commitRegions],
  )

  const handleRegionLiveChange = useCallback((region: RegionMetadata) => {
    const nextRegions = upsertRegion(regionsRef.current, region)
    regionsRef.current = nextRegions
    setRegions(nextRegions)
  }, [])

  const handleRegionCommit = useCallback(
    (region: RegionMetadata) => {
      commitRegions(upsertRegion(regionsRef.current, region))
    },
    [commitRegions],
  )

  const handleRegionSelect = useCallback((regionId: string) => {
    setSelectedMarkerId(null)
    setSelectedRegionId((currentRegionId) => {
      if (currentRegionId !== regionId) setLoopEnabled(true)
      return regionId
    })
  }, [])

  const clearRegionSelection = useCallback(() => {
    setSelectedRegionId(null)
    setLoopEnabled(false)
  }, [])

  const createMarkerAtPlayhead = useCallback(() => {
    if (!isLoaded) return
    const time = waveformRef.current?.getCurrentTime() ?? currentTime
    const existing = markersRef.current.find(
      (marker) => Math.abs(marker.time - time) <= MARKER_TIME_TOLERANCE_SECONDS,
    )
    setSelectedRegionId(null)
    setLoopEnabled(false)
    if (existing) {
      setSelectedMarkerId(existing.id)
      return
    }
    const marker = { id: crypto.randomUUID(), time }
    const next = addMarker(markersRef.current, marker, duration)
    markersRef.current = next
    setMarkers(next)
    setSelectedMarkerId(marker.id)
  }, [currentTime, duration, isLoaded])

  const commitMarker = useCallback(
    (marker: MarkerAnnotation) => {
      const next = updateMarker(markersRef.current, marker, duration)
      markersRef.current = next
      setMarkers(next)
      setSelectedMarkerId(marker.id)
    },
    [duration],
  )

  const deleteSelectedMarker = useCallback(() => {
    if (!selectedMarkerId) return
    const next = removeMarker(markersRef.current, selectedMarkerId)
    markersRef.current = next
    setMarkers(next)
    setSelectedMarkerId(null)
  }, [selectedMarkerId])

  const deleteSelectedRegion = useCallback(() => {
    if (!selectedRegionId) return
    commitRegions(removeRegion(regionsRef.current, selectedRegionId))
    setSelectedRegionId(null)
    setLoopEnabled(false)
  }, [commitRegions, selectedRegionId])

  const undo = useCallback(() => {
    applyHistoryState(historyRef.current.undo())
  }, [applyHistoryState])

  const redo = useCallback(() => {
    applyHistoryState(historyRef.current.redo())
  }, [applyHistoryState])

  const resetEditorState = useCallback(() => {
    regionsRef.current = []
    markersRef.current = []
    setMarkers([])
    applyHistoryState(historyRef.current.reset([]))
    setSelectedRegionId(null)
    setSelectedMarkerId(null)
    setLoopEnabled(false)
    setSpectrumEnabled(false)
    setSpectrogramEnabled(false)
    setMeterEnabled(false)
    setDuration(0)
    setCurrentTime(0)
    setZoom(0)
    setVerticalScale(1)
    setIsPlaying(false)
  }, [applyHistoryState])

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const looksLikeAudio =
      file.type.startsWith('audio/') || AUDIO_EXTENSION.test(file.name)
    if (!looksLikeAudio) {
      setError('Choose an audio file supported by your browser.')
      if (!audioUrl) setLoadStatus('error')
      return
    }

    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current)
    }
    const objectUrl = URL.createObjectURL(file)
    activeObjectUrlRef.current = objectUrl
    resetEditorState()
    setFileName(file.name)
    setError(null)
    setLoadStatus('loading')
    setAudioUrl(objectUrl)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(
    () => () => {
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        isEditableTarget(event.target) ||
        isDialogTarget(event.target)
      )
        return
      const command = keyboardCommand(event)
      if (command?.type === 'create-marker') {
        if (waveformFocused) {
          event.preventDefault()
          createMarkerAtPlayhead()
        }
        return
      }
      if (command?.type === 'navigate-marker') {
        if (!waveformFocused) return
        if (navigateMarker(command.direction)) event.preventDefault()
        return
      }
      if (command?.type === 'delete-selection' && selectedMarkerId) {
        if (command.markerRequiresWaveformFocus && !waveformFocused) return
        event.preventDefault()
        deleteSelectedMarker()
        return
      }
      if (
        !command ||
        command.type === 'submit-next' ||
        command.type === 'skip-next'
      )
        return

      event.preventDefault()
      switch (command.type) {
        case 'toggle-playback':
          if (isLoaded) waveformRef.current?.playPause()
          break
        case 'move-playhead':
          if (isLoaded) waveformRef.current?.seekBy(command.seconds)
          break
        case 'seek-boundary':
          if (isLoaded) {
            waveformRef.current?.seekTo(
              command.boundary === 'start' ? 0 : duration,
            )
          }
          break
        case 'fit':
          if (isLoaded) waveformRef.current?.fit()
          break
        case 'zoom':
          if (isLoaded) waveformRef.current?.zoom(command.direction)
          break
        case 'toggle-loop':
          if (selectedRegionId) setLoopEnabled((enabled) => !enabled)
          break
        case 'delete-selection':
          deleteSelectedRegion()
          break
        case 'clear-selection':
          setSelectedRegionId(null)
          setSelectedMarkerId(null)
          setLoopEnabled(false)
          break
        case 'undo':
          undo()
          break
        case 'redo':
          redo()
          break
        case 'navigate-region':
          if (isLoaded) navigateRegion(command.direction)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    createMarkerAtPlayhead,
    deleteSelectedMarker,
    deleteSelectedRegion,
    duration,
    isLoaded,
    navigateRegion,
    navigateMarker,
    redo,
    selectedRegionId,
    selectedMarkerId,
    undo,
    waveformFocused,
  ])

  const controls: TransportBarProps = {
    isLoaded,
    isPlaying,
    loopEnabled,
    spectrogramEnabled,
    spectrumEnabled,
    meterEnabled,
    hasSelection: selectedRegion !== null,
    canPreviousRegion: previousRegion !== null,
    canNextRegion: nextRegion !== null,
    verticalScale,
    currentTime,
    duration,
    onPlayPause: () => waveformRef.current?.playPause(),
    onFit: () => waveformRef.current?.fit(),
    onZoomIn: () => waveformRef.current?.zoom('in'),
    onZoomOut: () => waveformRef.current?.zoom('out'),
    onResetVerticalScale: () => waveformRef.current?.resetVerticalScale(),
    onToggleLoop: () => setLoopEnabled((value) => !value),
    onDelete: deleteSelectedRegion,
    onPreviousRegion: () => navigateRegion('previous'),
    onNextRegion: () => navigateRegion('next'),
    onToggleSpectrogram: () => setSpectrogramEnabled((value) => !value),
    onToggleSpectrum: () => {
      setSpectrumEnabled(!spectrumEnabled)
      if (!spectrumEnabled) waveformRef.current?.activateSpectrum()
    },
    onToggleMeter: () => {
      setMeterEnabled(!meterEnabled)
      if (!meterEnabled) waveformRef.current?.activateMeter()
    },
  }
  const markerControls: MarkerControlsProps = {
    isLoaded,
    markerEditingEnabled: true,
    canCreateMarker: isLoaded,
    canPreviousMarker: previousMarker !== null,
    canNextMarker: nextMarker !== null,
    canDeleteMarker: selectedMarker !== null,
    onCreateMarker: createMarkerAtPlayhead,
    onPreviousMarker: () => navigateMarker('previous'),
    onNextMarker: () => navigateMarker('next'),
    onDeleteMarker: deleteSelectedMarker,
  }
  const addRegion = () => {
    if (!isLoaded || duration <= 0) return
    const start = Math.min(currentTime, Math.max(0, duration - 1))
    const region = {
      id: crypto.randomUUID(),
      start,
      end: Math.min(start + 1, duration),
      data: {},
    }
    handleRegionCreate(region)
    handleRegionSelect(region.id)
    waveformRef.current?.revealRegion(region.start, region.end)
  }

  return (
    <div className={styles.shell} data-editor-theme="light">
      <ApplicationHeader>
        <KeyboardHelp />
      </ApplicationHeader>
      <div className={styles.documentBar}>
        <div className={styles.identity}>
          <div className={styles.eyebrow}>
            Standalone editor <span> / </span> Local session
          </div>
          <h1 className={styles.title}>{fileName ?? 'A closer listen.'}</h1>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.button}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="upload" />
            {audioUrl ? 'Open another file' : 'Open audio'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          className="u-visually-hidden"
          tabIndex={-1}
          aria-label="Select local audio file"
          type="file"
          accept="audio/*,.wav,.wave,.flac,.mp3,.m4a,.aac,.aif,.aiff,.ogg,.oga,.opus,.webm"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>
      {error && (
        <div className={styles.errorBanner} role="alert">
          <strong className={styles.errorTitle}>Audio notice</strong>
          <span>{error}</span>
          <button
            className={styles.errorDismiss}
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <main className={styles.workspace} id="editor-workspace" tabIndex={-1}>
        <section className={styles.editor} aria-label="Audio editor">
          <WaveformToolbar {...controls} />
          {!audioUrl ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyWave} aria-hidden="true">
                {EMPTY_STATE_WAVE_HEIGHTS.map((height, index) => (
                  <i
                    className={styles.emptyWaveBar}
                    key={index}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <h2 className={styles.emptyTitle}>
                Every detail deserves a listen.
              </h2>
              <p className={styles.emptyDescription}>
                Open an audio file to explore its waveform, mark precise
                regions, and inspect the sound.
              </p>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="plus" />
                Open audio file
              </button>
              <p className={styles.emptyFootnote}>
                WAV, FLAC, MP3, AAC, OGG and other browser-supported audio.
                <br />
                Your audio stays on this device.
              </p>
              <div className={styles.emptySteps}>
                <div>
                  <span>01 / LISTEN</span>
                  <strong>Find the moment</strong>
                  <p>Navigate with the waveform and full-file overview.</p>
                </div>
                <div>
                  <span>02 / MARK</span>
                  <strong>Get precise</strong>
                  <p>
                    Drag a region. Refine its boundaries to the millisecond.
                  </p>
                </div>
                <div>
                  <span>03 / INSPECT</span>
                  <strong>Look deeper</strong>
                  <p>Explore frequency, spectral detail, and loudness.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.editorSurface}>
              {loadStatus === 'loading' && (
                <div className={styles.loadingOverlay} role="status">
                  <span
                    className={styles.loadingIndicator}
                    aria-hidden="true"
                  />
                  Decoding waveform…
                </div>
              )}
              <WaveformEditor
                ref={waveformRef}
                audioUrl={audioUrl}
                regions={regions}
                markers={markers}
                selectedRegionId={selectedRegionId}
                selectedMarkerId={selectedMarkerId}
                loopEnabled={loopEnabled}
                meterEnabled={meterEnabled}
                spectrumEnabled={spectrumEnabled}
                spectrogramEnabled={spectrogramEnabled}
                isPlaying={isPlaying}
                onLoading={() => setLoadStatus('loading')}
                onReady={(audioDuration) => {
                  setDuration(audioDuration)
                  setLoadStatus('ready')
                  setError(null)
                }}
                onError={(message) => {
                  setError(message)
                  if (message.startsWith('Unable to load audio')) {
                    setLoadStatus('error')
                  }
                }}
                onTimeChange={setCurrentTime}
                onPlaybackChange={setIsPlaying}
                onZoomChange={setZoom}
                onVerticalScaleChange={setVerticalScale}
                onRegionCreate={handleRegionCreate}
                onRegionLiveChange={handleRegionLiveChange}
                onRegionCommit={handleRegionCommit}
                onRegionSelect={handleRegionSelect}
                onClearRegionSelection={clearRegionSelection}
                onMarkerCommit={commitMarker}
                onMarkerSelect={(id) => {
                  setSelectedRegionId(null)
                  setLoopEnabled(false)
                  setSelectedMarkerId(id)
                }}
                onClearMarkerSelection={() => setSelectedMarkerId(null)}
                onEditorFocusChange={setWaveformFocused}
                onHideSpectrogram={() => setSpectrogramEnabled(false)}
                onHideSpectrum={() => setSpectrumEnabled(false)}
                onHideMeter={() => setMeterEnabled(false)}
              />
            </div>
          )}
          {selectedRegion && (
            <div className={styles.selectionEditor}>
              <strong>Selected region</strong>
              <RegionTiming
                key={selectedRegion.id}
                region={selectedRegion}
                duration={duration}
                onChange={(start, end) =>
                  handleRegionCommit({ ...selectedRegion, start, end })
                }
              />
              <span>Changes are undoable</span>
            </div>
          )}
          {audioUrl && (
            <AnnotationList
              regions={regions}
              selectedRegionId={selectedRegionId}
              markers={markers}
              selectedMarkerId={selectedMarkerId}
              markerControls={markerControls}
              onSelectMarker={(marker) => {
                setSelectedRegionId(null)
                setLoopEnabled(false)
                setSelectedMarkerId(marker.id)
                waveformRef.current?.seekToMarker(marker.time)
              }}
              onSelect={(region) => {
                handleRegionSelect(region.id)
                waveformRef.current?.revealRegion(region.start, region.end)
              }}
              onAdd={addRegion}
              canAdd={isLoaded}
              onUndo={undo}
              onRedo={redo}
              {...historyAvailability}
            />
          )}
          <div className={styles.sessionNote}>
            <span>
              Standalone regions and markers last for this session. Use a
              project for saved annotations.
            </span>
            <Link to="/projects">Go to projects →</Link>
          </div>
        </section>
      </main>
      <TransportBar {...controls} />
      <StatusReadout
        loadStatus={loadStatus}
        fileName={fileName}
        duration={duration}
        currentTime={currentTime}
        zoom={zoom}
        verticalScale={verticalScale}
        isPlaying={isPlaying}
        selectedRegion={selectedRegion}
        selectedMarker={selectedMarker}
        selectedMarkerOrdinal={selectedMarkerOrdinal}
        markerCount={markers.length}
      />
    </div>
  )
}
