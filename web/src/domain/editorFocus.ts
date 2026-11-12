export const EDITOR_FOCUS_MODES = ['normal', 'annotations', 'waveform'] as const
export type EditorFocusMode = (typeof EDITOR_FOCUS_MODES)[number]

export const EDITOR_FOCUS_LABELS: Record<EditorFocusMode, string> = {
  normal: 'Normal editor',
  annotations: 'Waveform and annotations',
  waveform: 'Waveform only',
}

export function nextEditorFocus(mode: EditorFocusMode): EditorFocusMode {
  return (
    EDITOR_FOCUS_MODES[
      (EDITOR_FOCUS_MODES.indexOf(mode) + 1) % EDITOR_FOCUS_MODES.length
    ] ?? 'normal'
  )
}
