import { useCallback, useEffect, useState } from 'react'
import { isDialogTarget, isEditableTarget } from '../domain/keyboard'
import { nextEditorFocus, type EditorFocusMode } from '../domain/editorFocus'

/** Layout changes keep the editor and its audio graph mounted. */
export function useEditorFocus(reservedShortcuts: readonly string[] = []) {
  const [mode, setMode] = useState<EditorFocusMode>('normal')
  const [inspectorInFocus, setInspectorInFocus] = useState(true)
  const cycle = useCallback(() => setMode(nextEditorFocus), [])
  const mReserved = reservedShortcuts.some((key) => key.toLowerCase() === 'm')

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        isEditableTarget(event.target) ||
        isDialogTarget(event.target)
      )
        return
      if (event.key.toLowerCase() === 'm' && !mReserved) {
        event.preventDefault()
        cycle()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [cycle, mReserved])

  return { mode, cycle, inspectorInFocus, setInspectorInFocus }
}
