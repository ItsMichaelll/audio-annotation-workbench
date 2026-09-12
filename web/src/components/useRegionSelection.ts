import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { keyboardCommand, isDialogTarget } from '../domain/keyboard'
import {
  retainRegionSelection,
  selectRegionIds,
} from '../domain/regionSelection'

export function useRegionSelection(regions: readonly { id: string }[]) {
  const [selection, setSelection] = useState<string[]>([])
  const selectedRegionIds = useMemo(
    () => retainRegionSelection(selection, regions),
    [selection, regions],
  )
  const selectedRegionId = selectedRegionIds.at(-1) ?? null
  const setSelectedRegionId: Dispatch<SetStateAction<string | null>> =
    useCallback((value) => {
      setSelection((current) => {
        const id =
          typeof value === 'function' ? value(current.at(-1) ?? null) : value
        return id === null ? [] : [id]
      })
    }, [])
  const selectRegion = useCallback((id: string, toggle = false) => {
    setSelection((current) => selectRegionIds(current, id, toggle))
  }, [])
  const onSelectionKeyDown = (event: KeyboardEvent) => {
    if (
      !(event.target instanceof Element) ||
      !event.target.closest('#editor-workspace')
    )
      return
    if (
      event.defaultPrevented ||
      isDialogTarget(event.target) ||
      keyboardCommand(event)?.type !== 'select-all-regions'
    )
      return
    if (
      event.target instanceof Element &&
      event.target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
      )
    )
      return
    event.preventDefault()
    setSelection(regions.map((region) => region.id))
  }
  const onSelectionClick = (event: MouseEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest(
        'button, input, textarea, select, a, [contenteditable], [role="dialog"], dialog, [data-region-selection]',
      )
    )
      return
    setSelection([])
    return true
  }
  return {
    selectedRegionId,
    selectedRegionIds,
    setSelectedRegionId,
    selectRegion,
    onSelectionKeyDown,
    onSelectionClick,
  }
}
