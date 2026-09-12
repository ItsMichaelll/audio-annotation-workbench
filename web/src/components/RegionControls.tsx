import { Icon } from './Icon'
import controls from './MarkerControls.module.css'
import styles from './RegionControls.module.css'

export interface RegionControlsProps {
  isLoaded: boolean
  editingEnabled: boolean
  canPrevious: boolean
  canNext: boolean
  canAdd: boolean
  selectedCount: number
  onPrevious(): void
  onNext(): void
  onAdd(): void
  onDelete(): void
}

export function RegionControls(props: RegionControlsProps) {
  return (
    <div
      className={`${controls.root} ${styles.root}`}
      role="group"
      aria-label="Region controls"
    >
      <button
        type="button"
        className={controls.iconButton}
        onClick={props.onPrevious}
        disabled={!props.isLoaded || !props.canPrevious}
        aria-label="Previous region"
        title="Previous region (Ctrl+Left)"
      >
        <Icon name="back" />
      </button>
      <button
        type="button"
        className={controls.iconButton}
        onClick={props.onNext}
        disabled={!props.isLoaded || !props.canNext}
        aria-label="Next region"
        title="Next region (Ctrl+Right)"
      >
        <Icon name="arrow" />
      </button>
      <span className={styles.count} role="status">
        {props.selectedCount} selected
      </span>
      <span className={controls.hint}>
        Ctrl / Cmd + click to select multiple
      </span>
      {props.editingEnabled && (
        <div className={controls.editing}>
          <button
            type="button"
            className={styles.add}
            onClick={props.onAdd}
            disabled={!props.canAdd}
            aria-label="Create region at playhead"
            title="Create a one-second region at the playhead"
          >
            <Icon name="plus" />
            Add region
          </button>
          <button
            type="button"
            className={controls.iconButton}
            onClick={props.onDelete}
            disabled={!props.selectedCount}
            aria-label={
              props.selectedCount > 1
                ? 'Delete selected regions'
                : 'Delete selected region'
            }
            title="Delete selected regions (Delete)"
          >
            <Icon name="trash" />
          </button>
        </div>
      )}
    </div>
  )
}
