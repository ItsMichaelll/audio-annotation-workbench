import { describe, expect, it } from 'vitest'
import { SnapshotHistory } from './history'

describe('SnapshotHistory', () => {
  it('undoes and redoes committed snapshots', () => {
    const history = new SnapshotHistory<number[]>(
      [],
      (left, right) =>
        left.length === right.length &&
        left.every((value, index) => value === right[index]),
    )

    history.commit([1])
    history.commit([1, 2])
    expect(history.undo()).toMatchObject({ present: [1], canRedo: true })
    expect(history.undo()).toMatchObject({ present: [], canUndo: false })
    expect(history.redo()).toMatchObject({ present: [1], canUndo: true })
  })

  it('does not record duplicate continuous-edit snapshots', () => {
    const history = new SnapshotHistory(0)
    history.commit(1)
    history.commit(1)

    expect(history.undo()).toMatchObject({ present: 0, canUndo: false })
  })

  it('clears redo after a new edit', () => {
    const history = new SnapshotHistory(0)
    history.commit(1)
    history.undo()
    history.commit(2)

    expect(history.state.canRedo).toBe(false)
  })
})
