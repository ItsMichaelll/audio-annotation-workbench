import { describe, expect, it } from 'vitest'
import {
  isEditableElement,
  keyboardCommand,
  labelingShortcut,
} from './keyboard'

describe('keyboard command mapping', () => {
  it('maps fine and coarse navigation', () => {
    expect(keyboardCommand({ key: 'ArrowLeft' })).toEqual({
      type: 'move-playhead',
      seconds: -0.05,
    })
    expect(keyboardCommand({ key: 'ArrowRight', shiftKey: true })).toEqual({
      type: 'move-playhead',
      seconds: 0.25,
    })
  })

  it('maps undo and both redo variants', () => {
    expect(keyboardCommand({ key: 'z', ctrlKey: true })).toEqual({
      type: 'undo',
    })
    expect(
      keyboardCommand({ key: 'z', ctrlKey: true, shiftKey: true }),
    ).toEqual({ type: 'redo' })
    expect(keyboardCommand({ key: 'y', ctrlKey: true })).toEqual({
      type: 'redo',
    })
  })

  it('maps Ctrl+D to region deletion', () => {
    expect(keyboardCommand({ key: 'd', ctrlKey: true })).toEqual({
      type: 'delete-region',
    })
  })

  it('maps Ctrl+Left and Ctrl+Right to chronological region navigation', () => {
    expect(keyboardCommand({ key: 'ArrowLeft', ctrlKey: true })).toEqual({
      type: 'navigate-region',
      direction: 'previous',
    })
    expect(keyboardCommand({ key: 'ArrowRight', ctrlKey: true })).toEqual({
      type: 'navigate-region',
      direction: 'next',
    })
  })

  it('does not claim modified application shortcuts', () => {
    expect(keyboardCommand({ key: 'f', ctrlKey: true })).toBeNull()
    expect(keyboardCommand({ key: 'a', altKey: true })).toBeNull()
  })

  it('maps submission workflow commands and taxonomy label shortcuts', () => {
    expect(keyboardCommand({ key: 'Enter', ctrlKey: true })).toEqual({
      type: 'submit-next',
    })
    expect(
      keyboardCommand({ key: 'Enter', ctrlKey: true, shiftKey: true }),
    ).toEqual({ type: 'skip-next' })
    expect(
      labelingShortcut({ key: '1' }, [{ id: 'noise', shortcut: '1' }]),
    ).toBe('noise')
    expect(
      labelingShortcut({ key: '1', ctrlKey: true }, [
        { id: 'noise', shortcut: '1' },
      ]),
    ).toBeNull()
  })

  it('guards inputs, textareas, selects, buttons, and editable elements', () => {
    for (const tag of ['input', 'textarea', 'select', 'button'])
      expect(isEditableElement(tag)).toBe(true)
    expect(isEditableElement('div', true)).toBe(true)
    expect(isEditableElement('div')).toBe(false)
  })
})
