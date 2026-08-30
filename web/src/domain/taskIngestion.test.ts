import { describe, expect, it } from 'vitest'
import {
  buildImportPlan,
  canTransitionTask,
  normalizeRelativePath,
  parseManifest,
  taskFromCandidate,
} from './taskIngestion'
import { TASK_SCHEMA_VERSION, type TaskRecord } from './models'

const existing: TaskRecord = {
  id: 'one',
  schemaVersion: TASK_SCHEMA_VERSION,
  projectId: 'project',
  status: 'unstarted',
  displayName: 'one.wav',
  externalId: 'external-1',
  relativePath: 'set/one.wav',
  primaryMedia: {
    kind: 'unresolved',
    displayName: 'one.wav',
    reason: 'not-yet-linked',
  },
  metadata: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('task ingestion', () => {
  it('parses JSON wrappers, arrays, and JSONL manifests', () => {
    expect(
      parseManifest(
        '{"tasks":[{"id":"a","audio":"set/a.wav","metadata":{"score":1}}]}',
      ),
    ).toHaveLength(1)
    expect(parseManifest('[{"audio":"a.wav"}]')).toHaveLength(1)
    expect(parseManifest('{"audio":"a.wav"}\n{"audio":"b.wav"}')).toHaveLength(
      2,
    )
  })
  it('rejects unsafe paths, duplicate identifiers, and unsafe metadata', () => {
    expect(() => normalizeRelativePath('../secret.wav')).toThrow('relative')
    expect(() => parseManifest('[{"audio":"/absolute.wav"}]')).toThrow(
      'relative',
    )
    expect(() =>
      parseManifest('[{"id":"x","audio":"a.wav"},{"id":"x","audio":"b.wav"}]'),
    ).toThrow('duplicate')
    expect(() =>
      parseManifest('[{"audio":"a.wav","metadata":{"nested":{}}}]'),
    ).toThrow('unsupported')
  })
  it('classifies duplicate, conflict, valid, and unresolved candidates', () => {
    const plan = buildImportPlan(
      [
        { id: 'external-1', audio: 'set/one.wav' },
        { id: 'external-1', audio: 'different.wav' },
        { audio: 'new.wav' },
      ],
      [existing],
    )
    expect(plan.duplicates).toHaveLength(1)
    expect(plan.conflicts).toHaveLength(1)
    expect(plan.valid).toHaveLength(1)
    expect(plan.unresolved).toHaveLength(1)
  })
  it('creates stable internal task records independently of external IDs', () => {
    const task = taskFromCandidate(
      'project',
      { id: 'vendor-id', audio: 'set/a.wav' },
      'uuid',
      '2026-01-01T00:00:00.000Z',
    )
    expect(task).toMatchObject({
      id: 'uuid',
      externalId: 'vendor-id',
      status: 'unstarted',
      relativePath: 'set/a.wav',
    })
  })
  it('bounds management-owned status transitions', () => {
    expect(canTransitionTask('unstarted', 'blocked')).toBe(true)
    expect(canTransitionTask('blocked', 'unstarted')).toBe(true)
    expect(canTransitionTask('submitted', 'reopened')).toBe(true)
    expect(canTransitionTask('draft', 'submitted')).toBe(false)
    expect(canTransitionTask('unstarted', 'submitted')).toBe(false)
  })
})
