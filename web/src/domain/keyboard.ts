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
  | { type: 'submit-next' }
  | { type: 'skip-next' }
  | { type: 'navigate-region'; direction: 'previous' | 'next' }

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
    if (!input.shiftKey && !input.altKey && key === 'arrowleft') {
      return { type: 'navigate-region', direction: 'previous' }
    }
    if (!input.shiftKey && !input.altKey && key === 'arrowright') {
      return { type: 'navigate-region', direction: 'next' }
    }
    if (input.ctrlKey && key === 'enter' && input.shiftKey && !input.altKey) {
      return { type: 'skip-next' }
    }
    if (input.ctrlKey && key === 'enter' && !input.shiftKey && !input.altKey) {
      return { type: 'submit-next' }
    }
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
  return isEditableElement(target.tagName, target.isContentEditable)
}

export function isEditableElement(
  tagName: string,
  isContentEditable = false,
): boolean {
  return (
    isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tagName.toUpperCase())
  )
}

export function labelingShortcut(
  input: KeyboardCommandInput,
  labels: readonly { id: string; shortcut?: string }[],
): string | null {
  if (
    input.ctrlKey ||
    input.metaKey ||
    input.altKey ||
    input.key.length !== 1
  ) {
    return null
  }
  const key = input.key.toLowerCase()
  return (
    labels.find((label) => label.shortcut?.toLowerCase() === key)?.id ?? null
  )
}
