import { describe, expect, it } from 'vitest'
import { TASK_SCHEMA_VERSION, type TaskRecord } from './models'
import { deriveTaskProgress } from './taskProgress'

function task(status: TaskRecord['status']): TaskRecord {
  return {
    id: crypto.randomUUID(),
    schemaVersion: TASK_SCHEMA_VERSION,
    projectId: 'project-1',
    status,
    primaryMedia: {
      kind: 'unresolved',
      displayName: 'sample.wav',
      reason: 'not-yet-linked',
    },
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('task progress', () => {
  it('derives status counts and completed work', () => {
    const progress = deriveTaskProgress([
      task('unstarted'),
      task('in-progress'),
      task('submitted'),
      task('skipped'),
      task('blocked'),
      task('reopened'),
    ])

    expect(progress).toEqual({
      total: 6,
      unstarted: 1,
      inProgress: 1,
      submitted: 1,
      skipped: 1,
      blocked: 1,
      reopened: 1,
      completed: 2,
    })
  })
})
