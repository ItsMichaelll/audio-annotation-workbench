import { Icon } from './Icon'
import type { ReactNode } from 'react'
import { WaveformZoomControls } from './WaveformZoomControls'
import { formatTime } from '../domain/transport'
import styles from './TransportBar.module.css'
import {
  EditorFocusControls,
  type EditorFocusControlsProps,
} from './EditorFocusControls'

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
    | 'verticalScale'
    | 'onFit'
    | 'onZoomIn'
    | 'onZoomOut'
    | 'onResetVerticalScale'
    | 'spectrogramEnabled'
    | 'spectrumEnabled'
    | 'meterEnabled'
    | 'onToggleSpectrogram'
    | 'onToggleSpectrum'
    | 'onToggleMeter'
  > & {
    readOnly?: boolean
    focus?: EditorFocusControlsProps
    inspectorControl?: ReactNode
  },
) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.surfaceTitle}>
        <WaveformZoomControls {...props} />
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
        {props.focus && <EditorFocusControls {...props.focus} />}
        {props.inspectorControl}
      </div>
    </div>
  )
}

export function TransportBar({
  isLoaded,
  isPlaying,
  loopEnabled,
  hasSelection,
  currentTime,
  duration,
  onPlayPause,
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
          aria-label="Loop"
          onClick={onToggleLoop}
          disabled={!hasSelection}
          title="Loop selected region (L)"
        >
          <Icon name="loop" />
          <span>Loop</span>
        </button>
      </div>
    </nav>
  )
}
