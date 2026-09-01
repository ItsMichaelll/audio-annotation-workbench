import { describe, expect, it } from 'vitest'
import { SnapshotHistory } from './history'
import {
  annotationsEqual,
  createAnnotationDocument,
  normalizeAnnotation,
} from './annotations'

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

  it('undoes and redoes region geometry and label metadata as one annotation history', () => {
    const initial = createAnnotationDocument({
      id: 'a',
      projectId: 'p',
      taskId: 't',
      taxonomyVersionId: 'v1',
      now: 'now',
    })
    const history = new SnapshotHistory(initial, annotationsEqual)
    const created = {
      ...initial,
      revision: 1,
      regions: [{ id: 'r', start: 0, end: 1, assignments: [] }],
    }
    history.commit(created)
    const movedAndLabeled = {
      ...created,
      revision: 2,
      regions: [
        {
          id: 'r',
          start: 1,
          end: 2,
          assignments: [{ labelId: 'noise', severity: 'minor' }],
        },
      ],
    }
    history.commit(movedAndLabeled)
    expect(history.undo().present.regions[0]).toMatchObject({
      start: 0,
      assignments: [],
    })
    expect(history.redo().present.regions[0]).toMatchObject({
      start: 1,
      assignments: [{ labelId: 'noise' }],
    })
  })

  it('clamps restored undo and redo snapshots to the loaded duration', () => {
    const initial = createAnnotationDocument({
      id: 'a',
      projectId: 'p',
      taskId: 't',
      taxonomyVersionId: 'v1',
      now: 'now',
    })
    const history = new SnapshotHistory(initial, annotationsEqual)
    history.commit({
      ...initial,
      revision: 1,
      regions: [{ id: 'r', start: -2, end: 4, assignments: [] }],
    })
    history.commit({
      ...initial,
      revision: 2,
      regions: [{ id: 'r', start: 8, end: 14, assignments: [] }],
    })

    expect(
      normalizeAnnotation(history.undo().present, 10).regions[0],
    ).toMatchObject({
      start: 0,
      end: 4,
    })
    expect(
      normalizeAnnotation(history.redo().present, 10).regions[0],
    ).toMatchObject({
      start: 8,
      end: 10,
    })
  })
})
