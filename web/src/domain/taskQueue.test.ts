import { describe, expect, it } from 'vitest'
import { TASK_SCHEMA_VERSION, type TaskRecord } from './models'
import {
  nextActionableTask,
  nextActionableTaskAfterTransition,
  orderedTasks,
} from './taskQueue'

function task(
  id: string,
  status: TaskRecord['status'],
  importOrder?: number,
): TaskRecord {
  return {
    id,
    schemaVersion: TASK_SCHEMA_VERSION,
    projectId: 'p',
    status,
    primaryMedia: { kind: 'unresolved', displayName: id, reason: 'missing' },
    metadata: {},
    ...(importOrder === undefined ? {} : { importOrder }),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('task queue', () => {
  it('uses persisted import order and finds the next actionable task', () => {
    const tasks = [
      task('third', 'draft', 2),
      task('first', 'submitted', 0),
      task('second', 'reopened', 1),
    ]
    expect(orderedTasks(tasks).map(({ id }) => id)).toEqual([
      'first',
      'second',
      'third',
    ])
    expect(nextActionableTask(tasks)?.id).toBe('second')
    expect(nextActionableTask(tasks, 'second')?.id).toBe('third')
  })

  it('uses a deterministic fallback for migrated tasks', () => {
    expect(
      orderedTasks([task('b', 'unstarted'), task('a', 'unstarted')]).map(
        ({ id }) => id,
      ),
    ).toEqual(['a', 'b'])
  })

  it('keeps older migrated tasks ahead of later imports', () => {
    const migrated = task('legacy', 'unstarted')
    const imported = {
      ...task('new', 'unstarted', 0),
      createdAt: '2026-02-01T00:00:00.000Z',
    }
    expect(orderedTasks([imported, migrated]).map(({ id }) => id)).toEqual([
      'legacy',
      'new',
    ])
  })

  it('wraps to remaining actionable work without selecting the current task', () => {
    const tasks = [task('first', 'draft', 0), task('second', 'submitted', 1)]
    expect(nextActionableTask(tasks, 'second')?.id).toBe('first')
    expect(nextActionableTask([task('only', 'draft', 0)], 'only')).toBeNull()
  })

  it('exhausts an all-skipped queue after the current task is skipped', () => {
    const tasks = [task('current', 'draft', 0), task('other', 'skipped', 1)]
    expect(
      nextActionableTaskAfterTransition(tasks, 'current', 'skipped'),
    ).toBeNull()
  })

  it('selects only eligible tasks for Start Labeling', () => {
    const tasks = [
      task('skipped', 'skipped', 0),
      task('blocked', 'blocked', 1),
      task('submitted', 'submitted', 2),
      task('reopened', 'reopened', 3),
    ]
    expect(nextActionableTask(tasks)?.id).toBe('reopened')
    expect(nextActionableTask(tasks.slice(0, 3))).toBeNull()
  })
})
