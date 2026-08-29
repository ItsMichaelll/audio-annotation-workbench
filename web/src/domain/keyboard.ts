export type EditorCommand =
  | { type: 'toggle-playback' }
  | { type: 'move-playhead'; seconds: number }
  | { type: 'seek-boundary'; boundary: 'start' | 'end' }
  | { type: 'fit' }
  | { type: 'zoom'; direction: 'in' | 'out' }
  | { type: 'toggle-loop' }
  | { type: 'delete-region' }
  | { type: 'clear-selection' }
  | { type: 'undo' }
  | { type: 'redo' }

export interface KeyboardCommandInput {
  key: string
  code?: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}

export function keyboardCommand(
  input: KeyboardCommandInput,
): EditorCommand | null {
  const key = input.key.toLowerCase()
  const commandModifier = input.ctrlKey === true || input.metaKey === true

  if (commandModifier) {
    if (input.ctrlKey && key === 'd' && !input.shiftKey && !input.altKey) {
      return { type: 'delete-region' }
    }
    if (key === 'z' && input.shiftKey) return { type: 'redo' }
    if (key === 'z') return { type: 'undo' }
    if (key === 'y') return { type: 'redo' }
    return null
  }

  if (input.altKey) return null

  switch (key) {
    case ' ':
      return { type: 'toggle-playback' }
    case 'arrowleft':
      return {
        type: 'move-playhead',
        seconds: input.shiftKey ? -0.25 : -0.05,
      }
    case 'arrowright':
      return {
        type: 'move-playhead',
        seconds: input.shiftKey ? 0.25 : 0.05,
      }
    case 'a':
      return { type: 'move-playhead', seconds: -1 }
    case 'd':
      return { type: 'move-playhead', seconds: 1 }
    case 'home':
      return { type: 'seek-boundary', boundary: 'start' }
    case 'end':
      return { type: 'seek-boundary', boundary: 'end' }
    case 'f':
      return { type: 'fit' }
    case '+':
    case '=':
      return { type: 'zoom', direction: 'in' }
    case '-':
    case '_':
      return { type: 'zoom', direction: 'out' }
    case 'l':
      return { type: 'toggle-loop' }
    case 'delete':
    case 'backspace':
      return { type: 'delete-region' }
    case 'escape':
      return { type: 'clear-selection' }
    default:
      if (input.code === 'NumpadAdd') return { type: 'zoom', direction: 'in' }
      if (input.code === 'NumpadSubtract') {
        return { type: 'zoom', direction: 'out' }
      }
      return null
  }
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}
