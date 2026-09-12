import { describe, expect, it } from 'vitest'
import {
  buildImportPlan,
  canTransitionTask,
  normalizeRelativePath,
  parseManifest,
  parseManifestFile,
  TASK_MANIFEST_FILE_SIZE_LIMIT,
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
    expect(() => parseManifest('[{"audio":"a.wav","extra":true}]')).toThrow(
      'field “extra” is not supported',
    )
    expect(() =>
      parseManifest('{"tasks":[{"audio":"a.wav"}],"extra":true}'),
    ).toThrow('field “extra” is not supported')
    expect(() => parseManifest('[{"audio":"clip.exe"}]')).toThrow(
      'must use a supported audio extension',
    )
  })
  it('validates manifest file type and size before parsing', async () => {
    await expect(
      parseManifestFile(new File(['[]'], 'tasks.txt')),
    ).rejects.toThrow('.json or .jsonl')
    const oversized = new File(['[]'], 'tasks.json')
    Object.defineProperty(oversized, 'size', {
      value: TASK_MANIFEST_FILE_SIZE_LIMIT + 1,
    })
    await expect(parseManifestFile(oversized)).rejects.toThrow(
      '5 MB or smaller',
    )
    await expect(
      parseManifestFile(new File(['[{"audio":"clip.wav"}]'], 'tasks.json')),
    ).resolves.toEqual([{ audio: 'clip.wav' }])
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
    expect(canTransitionTask('draft', 'submitted')).toBe(true)
    expect(canTransitionTask('unstarted', 'submitted')).toBe(true)
    expect(canTransitionTask('reopened', 'submitted')).toBe(true)
    expect(canTransitionTask('submitted', 'draft')).toBe(false)
    expect(canTransitionTask('blocked', 'skipped')).toBe(false)
  })
})
