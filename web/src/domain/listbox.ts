export function nextListboxIndex(
  current: number,
  optionCount: number,
  key: string,
): number {
  if (optionCount <= 0) return -1
  switch (key) {
    case 'ArrowDown':
      return Math.min(Math.max(current, -1) + 1, optionCount - 1)
    case 'ArrowUp':
      return Math.max(current < 0 ? optionCount - 1 : current - 1, 0)
    case 'Home':
      return 0
    case 'End':
      return optionCount - 1
    default:
      return current
  }
}

export type ListboxKeyAction =
  | { type: 'move'; index: number }
  | { type: 'choose' }
  | { type: 'close'; restoreFocus: boolean }
  | { type: 'ignore' }

export function selectListboxOption<T>(
  options: readonly T[],
  index: number,
): { open: false; option: T } | null {
  const option = options[index]
  return option === undefined ? null : { open: false, option }
}

export function listboxKeyAction(
  key: string,
  current: number,
  optionCount: number,
): ListboxKeyAction {
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
    return { type: 'move', index: nextListboxIndex(current, optionCount, key) }
  }
  if (key === 'Enter' || key === ' ') return { type: 'choose' }
  if (key === 'Escape') return { type: 'close', restoreFocus: true }
  if (key === 'Tab') return { type: 'close', restoreFocus: false }
  return { type: 'ignore' }
}
