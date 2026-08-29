import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ShortcutPanel } from './components/ShortcutPanel'
import { StatusReadout } from './components/StatusReadout'
import { TransportBar } from './components/TransportBar'
import { SnapshotHistory, type HistoryState } from './domain/history'
import { isEditableTarget, keyboardCommand } from './domain/keyboard'
import {
  regionSnapshotsEqual,
  removeRegion,
  type RegionMetadata,
  upsertRegion,
} from './domain/region'
import {
  WaveformEditor,
  type WaveformEditorHandle,
} from './features/waveform/WaveformEditor'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const AUDIO_EXTENSION =
  /\.(aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav|wave|webm)$/i

const EMPTY_STATE_WAVE_HEIGHTS = [
  8, 15, 29, 41, 38, 63, 41, 28, 55, 37, 52, 69, 75, 48, 62, 31, 62, 52, 84, 59,
  48, 71, 55, 76, 60, 41, 53, 33, 47, 52, 63, 71, 55, 72, 60, 51, 36, 48, 26,
  34, 28, 15, 5,
]

export function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const waveformRef = useRef<WaveformEditorHandle>(null)
  const activeObjectUrlRef = useRef<string | null>(null)
  const regionsRef = useRef<RegionMetadata[]>([])
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
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
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
    setSelectedRegionId((currentRegionId) => {
      if (currentRegionId !== regionId) setLoopEnabled(true)
      return regionId
    })
  }, [])

  const clearRegionSelection = useCallback(() => {
    setSelectedRegionId(null)
    setLoopEnabled(false)
  }, [])

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
    applyHistoryState(historyRef.current.reset([]))
    setSelectedRegionId(null)
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
      if (isEditableTarget(event.target)) return
      const command = keyboardCommand(event)
      if (!command) return

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
        case 'delete-region':
          deleteSelectedRegion()
          break
        case 'clear-selection':
          setSelectedRegionId(null)
          setLoopEnabled(false)
          break
        case 'undo':
          undo()
          break
        case 'redo':
          redo()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedRegion, duration, isLoaded, redo, selectedRegionId, undo])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            AAW
          </span>
          <div>
            <h1>Audio Annotation Workbench</h1>
            <p>A minimalistic audio annotation tool</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="privacy-note">
            Files stay on this device · Never uploaded
          </span>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="audio/*,.wav,.wave,.flac,.mp3,.m4a,.aac,.aif,.aiff,.ogg,.oga,.opus,.webm"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <button
            className="load-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {audioUrl ? 'Load another file' : 'Load audio file'}
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
      />

      <TransportBar
        isLoaded={isLoaded}
        isPlaying={isPlaying}
        loopEnabled={loopEnabled}
        spectrogramEnabled={spectrogramEnabled}
        spectrumEnabled={spectrumEnabled}
        meterEnabled={meterEnabled}
        hasSelection={selectedRegion !== null}
        verticalScale={verticalScale}
        onPlayPause={() => waveformRef.current?.playPause()}
        onFit={() => waveformRef.current?.fit()}
        onZoomIn={() => waveformRef.current?.zoom('in')}
        onZoomOut={() => waveformRef.current?.zoom('out')}
        onResetVerticalScale={() => waveformRef.current?.resetVerticalScale()}
        onToggleLoop={() => setLoopEnabled((enabled) => !enabled)}
        onDelete={deleteSelectedRegion}
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

      <main className="workspace">
        <section className="editor" aria-label="Waveform editor">
          {error && (
            <div className="error-banner" role="alert">
              <strong>Audio notice</strong>
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {!audioUrl ? (
            <div className="empty-state">
              <div className="empty-state__wave" aria-hidden="true">
                {EMPTY_STATE_WAVE_HEIGHTS.map((height, index) => (
                  <i
                    key={index}
                    style={{
                      height: `${height}%`,
                      animationDelay: `${-(index % 11) * 0.18}s`,
                    }}
                  />
                ))}
              </div>
              <h2>Load a local audio file to begin</h2>
              <p>
                Supported formats: WAV, FLAC, MP3, AAC, AIF, AIFF, OGG, OGA,
                OPUS, WEBM.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Select audio file
              </button>
            </div>
          ) : (
            <div className="editor__surface">
              {loadStatus === 'loading' && (
                <div className="loading-overlay" role="status">
                  <span className="loading-indicator" aria-hidden="true" />
                  Decoding waveform…
                </div>
              )}
              <WaveformEditor
                ref={waveformRef}
                audioUrl={audioUrl}
                regions={regions}
                selectedRegionId={selectedRegionId}
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
                onHideSpectrogram={() => setSpectrogramEnabled(false)}
                onHideSpectrum={() => setSpectrumEnabled(false)}
                onHideMeter={() => setMeterEnabled(false)}
              />
            </div>
          )}

          <footer className="editor-footer">
            <span>
              {regions.length} {regions.length === 1 ? 'region' : 'regions'}
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
