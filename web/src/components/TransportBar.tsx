import { Icon } from './Icon'
import { formatTime } from '../domain/transport'
import styles from './TransportBar.module.css'

export interface TransportBarProps {
  isLoaded: boolean
  isPlaying: boolean
  loopEnabled: boolean
  spectrogramEnabled: boolean
  spectrumEnabled: boolean
  meterEnabled: boolean
  hasSelection: boolean
  verticalScale: number
  currentTime: number
  duration: number
  onPlayPause(): void
  onFit(): void
  onZoomIn(): void
  onZoomOut(): void
  onResetVerticalScale(): void
  onToggleLoop(): void
  onJumpToStart(): void
  onJumpToEnd(): void
  onToggleSpectrogram(): void
  onToggleSpectrum(): void
  onToggleMeter(): void
}

export function WaveformToolbar(
  props: Pick<
    TransportBarProps,
    | 'isLoaded'
    | 'spectrogramEnabled'
    | 'spectrumEnabled'
    | 'meterEnabled'
    | 'onToggleSpectrogram'
    | 'onToggleSpectrum'
    | 'onToggleMeter'
  > & { readOnly?: boolean },
) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.surfaceTitle}>
        <Icon name="waveform" />
        <h2>Waveform</h2>
        <span className={styles.gesture}>
          {props.readOnly
            ? 'Click to seek · Tab through markers'
            : 'Drag for a region · T for a marker'}
        </span>
      </div>
      <div
        className={styles.views}
        role="group"
        aria-label="Audio analysis views"
      >
        <span className={styles.viewLabel}>Analysis</span>
        <button
          className={styles.control}
          type="button"
          aria-pressed={props.spectrogramEnabled}
          disabled={!props.isLoaded}
          onClick={props.onToggleSpectrogram}
        >
          <Icon name="spectrogram" />
          Spectrogram
        </button>
        <button
          className={styles.control}
          type="button"
          aria-pressed={props.spectrumEnabled}
          disabled={!props.isLoaded}
          onClick={props.onToggleSpectrum}
        >
          <Icon name="spectrum" />
          Spectrum
        </button>
        <button
          className={styles.control}
          type="button"
          aria-pressed={props.meterEnabled}
          disabled={!props.isLoaded}
          onClick={props.onToggleMeter}
        >
          <Icon name="meter" />
          Meter
        </button>
      </div>
    </div>
  )
}

export function TransportBar({
  isLoaded,
  isPlaying,
  loopEnabled,
  hasSelection,
  verticalScale,
  currentTime,
  duration,
  onPlayPause,
  onFit,
  onZoomIn,
  onZoomOut,
  onResetVerticalScale,
  onToggleLoop,
  onJumpToStart,
  onJumpToEnd,
}: TransportBarProps) {
  return (
    <nav className={styles.root} aria-label="Transport and editing controls">
      <div className={styles.playback}>
        <button
          className={styles.iconButton}
          type="button"
          onClick={onJumpToStart}
          disabled={!isLoaded}
          aria-label="Jump to start"
          title="Jump to start of audio"
        >
          <Icon name="previous" />
        </button>
        <button
          className={styles.play}
          type="button"
          onClick={onPlayPause}
          disabled={!isLoaded}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title="Play or pause (Space)"
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={20} />
        </button>
        <button
          className={styles.iconButton}
          type="button"
          onClick={onJumpToEnd}
          disabled={!isLoaded}
          aria-label="Jump to end"
          title="Jump to end of audio"
        >
          <Icon name="next" />
        </button>
      </div>
      <div className={styles.clock} aria-label="Playback time">
        <output>{formatTime(currentTime)}</output>
        <span>/ {formatTime(duration)}</span>
      </div>
      <div className={styles.selection}>
        <button
          type="button"
          className={styles.control}
          aria-pressed={loopEnabled}
          onClick={onToggleLoop}
          disabled={!hasSelection}
          title="Loop selected region (L)"
        >
          <Icon name="loop" />
          <span>Loop</span>
        </button>
      </div>
      <div className={styles.zoom} role="group" aria-label="Waveform zoom">
        <button
          type="button"
          className={styles.control}
          onClick={onResetVerticalScale}
          disabled={!isLoaded || Math.abs(verticalScale - 1) < 0.001}
          title="Reset waveform amplitude to 1×"
        >
          <span className={styles.scale}>↕ {verticalScale.toFixed(2)}×</span>
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onZoomOut}
          disabled={!isLoaded}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <Icon name="minus" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onZoomIn}
          disabled={!isLoaded}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className={styles.control}
          onClick={onFit}
          disabled={!isLoaded}
          title="Fit complete file (F)"
        >
          <Icon name="fit" />
          Fit
        </button>
      </div>
    </nav>
  )
}
