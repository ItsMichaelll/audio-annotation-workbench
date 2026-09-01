import { describe, expect, it } from 'vitest'
import {
  TASK_SCHEMA_VERSION,
  type TaskRecord,
  type TaskSourceIdentity,
} from './models'
import { assertRelinkSelectionMatchesTask } from './relink'

function task(sourceIdentity: TaskSourceIdentity): TaskRecord {
  return {
    id: 'task',
    schemaVersion: TASK_SCHEMA_VERSION,
    projectId: 'project',
    status: 'unstarted',
    relativePath: 'set/clip.wav',
    primaryMedia: {
      kind: 'unresolved',
      displayName: 'clip.wav',
      reason: 'missing',
    },
    sourceIdentity,
    metadata: {},
    createdAt: 'now',
    updatedAt: 'now',
  }
}

describe('relink source identity', () => {
  it('rejects a direct import with the wrong filename or persisted size', () => {
    const direct = task({
      kind: 'direct-file',
      filename: 'clip.wav',
      size: 1234,
    })
    expect(() =>
      assertRelinkSelectionMatchesTask(direct, {
        name: 'other.wav',
        size: 1234,
      }),
    ).toThrow('Expected: "clip.wav" (1.21 KB)')
    expect(() =>
      assertRelinkSelectionMatchesTask(direct, {
        name: 'clip.wav',
        size: 999,
      }),
    ).toThrow('Expected: "clip.wav" (1.21 KB)')
    expect(() =>
      assertRelinkSelectionMatchesTask(direct, {
        name: 'clip.wav',
        size: 1234,
      }),
    ).not.toThrow()
  })

  it('matches manifest tasks by normalized relative path or filename', () => {
    const manifest = task({ kind: 'manifest', relativePath: 'set/clip.wav' })
    expect(() =>
      assertRelinkSelectionMatchesTask(manifest, {
        name: 'clip.wav',
        size: 1,
        relativePath: 'set\\clip.wav',
      }),
    ).not.toThrow()
    expect(() =>
      assertRelinkSelectionMatchesTask(manifest, {
        name: 'clip.wav',
        size: 1,
      }),
    ).not.toThrow()
    expect(() =>
      assertRelinkSelectionMatchesTask(manifest, {
        name: 'wrong.wav',
        size: 1,
      }),
    ).toThrow('Expected: "set/clip.wav" (or a file named clip.wav).')
  })
})
