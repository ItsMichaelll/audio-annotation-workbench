import { describe, expect, it } from 'vitest'
import {
  listboxKeyAction,
  nextListboxIndex,
  selectListboxOption,
} from './listbox'

describe('custom select keyboard navigation', () => {
  it('moves without wrapping and supports Home and End', () => {
    expect(nextListboxIndex(-1, 3, 'ArrowDown')).toBe(0)
    expect(nextListboxIndex(2, 3, 'ArrowDown')).toBe(2)
    expect(nextListboxIndex(0, 3, 'ArrowUp')).toBe(0)
    expect(nextListboxIndex(1, 3, 'Home')).toBe(0)
    expect(nextListboxIndex(1, 3, 'End')).toBe(2)
  })

  it('chooses, dismisses with Escape, and permits normal Tab focus movement', () => {
    expect(listboxKeyAction('Enter', 1, 3)).toEqual({ type: 'choose' })
    expect(listboxKeyAction('Escape', 1, 3)).toEqual({
      type: 'close',
      restoreFocus: true,
    })
    expect(listboxKeyAction('Tab', 1, 3)).toEqual({
      type: 'close',
      restoreFocus: false,
    })
    expect(listboxKeyAction('ArrowDown', 1, 3)).toEqual({
      type: 'move',
      index: 2,
    })
  })

  it('keeps the listbox closed after a mouse option selection', () => {
    expect(selectListboxOption(['minor', 'major'], 1)).toEqual({
      open: false,
      option: 'major',
    })
  })
})
