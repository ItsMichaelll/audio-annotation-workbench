import { Icon } from './Icon'
import styles from './MarkerControls.module.css'

export interface MarkerControlsProps {
  isLoaded: boolean
  markerEditingEnabled: boolean
  canCreateMarker: boolean
  canPreviousMarker: boolean
  canNextMarker: boolean
  canDeleteMarker: boolean
  onCreateMarker(): void
  onPreviousMarker(): void
  onNextMarker(): void
  onDeleteMarker(): void
}

export function MarkerControls({
  isLoaded,
  markerEditingEnabled,
  canCreateMarker,
  canPreviousMarker,
  canNextMarker,
  canDeleteMarker,
  onCreateMarker,
  onPreviousMarker,
  onNextMarker,
  onDeleteMarker,
}: MarkerControlsProps) {
  return (
    <div className={styles.root} role="group" aria-label="Marker controls">
      <button
        type="button"
        className={styles.iconButton}
        onClick={onPreviousMarker}
        disabled={!isLoaded || !canPreviousMarker}
        aria-label="Previous marker"
        title="Previous marker (Shift+Tab while waveform is focused)"
      >
        <Icon name="back" />
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onNextMarker}
        disabled={!isLoaded || !canNextMarker}
        aria-label="Next marker"
        title="Next marker (Tab while waveform is focused)"
      >
        <Icon name="arrow" />
      </button>
      <span className={styles.hint}>
        {markerEditingEnabled
          ? 'Select to seek · Drag flags to adjust'
          : 'Select to seek'}
      </span>
      {markerEditingEnabled && (
        <div className={styles.editing}>
          <button
            type="button"
            className={styles.add}
            onClick={onCreateMarker}
            disabled={!canCreateMarker}
            aria-label="Create marker at playhead"
            title="Create marker at playhead (T while waveform is focused)"
          >
            <Icon name="marker" />
            Add marker <kbd>T</kbd>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onDeleteMarker}
            disabled={!canDeleteMarker}
            aria-label="Delete selected marker"
            title="Delete selected marker (Delete, Backspace, or Ctrl+D)"
          >
            <Icon name="trash" />
          </button>
        </div>
      )}
    </div>
  )
}
