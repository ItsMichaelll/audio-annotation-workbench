import {
  EDITOR_FOCUS_LABELS,
  nextEditorFocus,
  type EditorFocusMode,
} from '../domain/editorFocus'
import styles from './TransportBar.module.css'

export interface EditorFocusControlsProps {
  mode: EditorFocusMode
  onCycle(): void
  inspectorInFocus: boolean
  onInspectorInFocusChange(value: boolean): void
}

export function EditorFocusControls(props: EditorFocusControlsProps) {
  return (
    <>
      <button
        type="button"
        className={styles.control}
        aria-pressed={props.mode !== 'normal'}
        aria-label={`${EDITOR_FOCUS_LABELS[props.mode]}. Switch to ${EDITOR_FOCUS_LABELS[nextEditorFocus(props.mode)]}`}
        title="Cycle focus mode (M, unless assigned by taxonomy)"
        onClick={props.onCycle}
      >
        {props.mode === 'normal' ? 'Focus' : EDITOR_FOCUS_LABELS[props.mode]}
      </button>
      <details className={styles.viewMenu}>
        <summary className={styles.control}>View</summary>
        <label>
          <input
            type="checkbox"
            checked={props.inspectorInFocus}
            onChange={(event) =>
              props.onInspectorInFocusChange(event.target.checked)
            }
          />
          Inspector in focus
        </label>
      </details>
    </>
  )
}
