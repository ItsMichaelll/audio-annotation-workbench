import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ShortcutPanel } from './components/ShortcutPanel'
import { StatusReadout } from './components/StatusReadout'
import { TransportBar } from './components/TransportBar'
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
import styles from './App.module.css'

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
  const [shortcutsCollapsed, setShortcutsCollapsed] = useState(false)

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
      setLoadStatus('error')
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
      if (isEditableTarget(event.target) || isDialogTarget(event.target)) return
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

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link
          className={`${styles.brand} ${styles.brandLink}`}
          to="/"
          aria-label="Projects dashboard"
        >
          <span className={styles.brandMark} aria-hidden="true">
            AAW
          </span>
          <div>
            <h1 className={styles.brandTitle}>Audio Annotation Workbench</h1>
            <p className={styles.brandSubtitle}>
              A minimalistic audio annotation tool
            </p>
          </div>
        </Link>
        <div className={styles.headerActions}>
          <span className={styles.privacyNote}>Data stays in this browser</span>
          <input
            ref={fileInputRef}
            className="u-visually-hidden"
            type="file"
            accept="audio/*,.wav,.wave,.flac,.mp3,.m4a,.aac,.aif,.aiff,.ogg,.oga,.opus,.webm"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <button
            className={styles.uploadButton}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {audioUrl ? 'Upload new file' : 'Upload audio file'}
          </button>
        </div>
      </header>

      <StatusReadout
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

      <TransportBar
        isLoaded={isLoaded}
        isPlaying={isPlaying}
        loopEnabled={loopEnabled}
        spectrogramEnabled={spectrogramEnabled}
        spectrumEnabled={spectrumEnabled}
        meterEnabled={meterEnabled}
        hasSelection={selectedRegion !== null}
        canPreviousRegion={previousRegion !== null}
        canNextRegion={nextRegion !== null}
        markerEditingEnabled
        canCreateMarker={isLoaded}
        canPreviousMarker={previousMarker !== null}
        canNextMarker={nextMarker !== null}
        canDeleteMarker={selectedMarker !== null}
        verticalScale={verticalScale}
        onPlayPause={() => waveformRef.current?.playPause()}
        onFit={() => waveformRef.current?.fit()}
        onZoomIn={() => waveformRef.current?.zoom('in')}
        onZoomOut={() => waveformRef.current?.zoom('out')}
        onResetVerticalScale={() => waveformRef.current?.resetVerticalScale()}
        onToggleLoop={() => setLoopEnabled((enabled) => !enabled)}
        onDelete={deleteSelectedRegion}
        onPreviousRegion={() => navigateRegion('previous')}
        onNextRegion={() => navigateRegion('next')}
        onCreateMarker={createMarkerAtPlayhead}
        onPreviousMarker={() => navigateMarker('previous')}
        onNextMarker={() => navigateMarker('next')}
        onDeleteMarker={deleteSelectedMarker}
        onToggleSpectrogram={() => setSpectrogramEnabled((enabled) => !enabled)}
        onToggleSpectrum={() => {
          const enabled = !spectrumEnabled
          setSpectrumEnabled(enabled)
          if (enabled) waveformRef.current?.activateSpectrum()
        }}
        onToggleMeter={() => {
          const enabled = !meterEnabled
          setMeterEnabled(enabled)
          if (enabled) waveformRef.current?.activateMeter()
        }}
      />

      <main className={styles.workspace}>
        <section className={styles.editor} aria-label="Waveform editor">
          {error && (
            <div className={styles.errorBanner} role="alert">
              <strong className={styles.errorTitle}>Audio notice</strong>
              <span>{error}</span>
              <button
                type="button"
                className={styles.errorDismiss}
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {!audioUrl ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyWave} aria-hidden="true">
                {EMPTY_STATE_WAVE_HEIGHTS.map((height, index) => (
                  <i
                    className={styles.emptyWaveBar}
                    key={index}
                    style={{
                      height: `${height}%`,
                      animationDelay: `${-(index % 11) * 0.18}s`,
                    }}
                  />
                ))}
              </div>
              <h2 className={styles.emptyTitle}>
                Upload an audio file to begin
              </h2>
              <p className={styles.emptyDescription}>
                Supported formats: AAC, AIF, AIFF, FLAC, M4A, MP3, OGA, OGG,
                OPUS, WAV, WAVE, WEBM
              </p>
              <button
                className={styles.emptyAction}
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload audio file
              </button>
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

          <footer className={styles.editorFooter}>
            <span>
              {regions.length} {regions.length === 1 ? 'region' : 'regions'}
            </span>
            <span>
              {markers.length} {markers.length === 1 ? 'marker' : 'markers'}
            </span>
            <span>{loopEnabled ? 'Selected region loops' : 'Loop off'}</span>
            <span>Times shown to 1 ms</span>
          </footer>
        </section>

        <ShortcutPanel
          collapsed={shortcutsCollapsed}
          onToggle={() => setShortcutsCollapsed((collapsed) => !collapsed)}
        />
      </main>
    </div>
  )
}
