import { describe, expect, it } from 'vitest'
import { keyboardCommand } from './keyboard'

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

  it('does not claim modified application shortcuts', () => {
    expect(keyboardCommand({ key: 'f', ctrlKey: true })).toBeNull()
    expect(keyboardCommand({ key: 'a', altKey: true })).toBeNull()
  })
})
