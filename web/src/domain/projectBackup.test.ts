import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  TAXONOMY_RECORD_SCHEMA_VERSION,
  type AnnotationDocument,
  type Project,
  type TaskRecord,
  type TaxonomyVersion,
} from './models'
import {
  createProjectBackup,
  parseProjectBackup,
  serializeProjectBackup,
} from './projectBackup'

const NOW = '2026-09-01T00:00:00.000Z'

const project: Project = {
  id: 'project-1',
  schemaVersion: PROJECT_SCHEMA_VERSION,
  name: 'Voice Review',
  status: 'active',
  activeTaxonomyVersionId: 'taxonomy-1',
  createdAt: NOW,
  updatedAt: NOW,
}

const taxonomy: TaxonomyVersion = {
  id: 'taxonomy-1',
  schemaVersion: TAXONOMY_RECORD_SCHEMA_VERSION,
  projectId: project.id,
  version: 1,
  sourceFilename: 'taxonomy.yaml',
  sourceFormat: 'yaml',
  rawSource: 'schemaVersion: 1',
  document: {
    schemaVersion: 1,
    labels: [{ id: 'noise', name: 'Noise', scopes: ['region', 'clip'] }],
  },
  metadata: { schemaVersion: '1' },
  contentHash: 'a'.repeat(64),
  createdAt: NOW,
}

function task(id: string, order: number): TaskRecord {
  return {
    id,
    schemaVersion: TASK_SCHEMA_VERSION,
    projectId: project.id,
    status: 'submitted',
    displayName: `${id}.wav`,
    relativePath: `audio/${id}.wav`,
    primaryMedia: {
      kind: 'file-handle',
      handleId: `handle-${id}`,
      displayName: `${id}.wav`,
      relativePath: `audio/${id}.wav`,
      permission: 'granted',
      handle: { name: 'private' } as FileSystemFileHandle,
    },
    sourceIdentity: { kind: 'manifest', relativePath: `audio/${id}.wav` },
    metadata: { speaker: 'a' },
    importOrder: order,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function annotation(taskId: string): AnnotationDocument {
  return {
    id: `annotation-${taskId}`,
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
    projectId: project.id,
    taskId,
    taxonomyVersionId: taxonomy.id,
    revision: 3,
    regions: [
      {
        id: 'region-1',
        start: 1,
        end: 2,
        assignments: [{ labelId: 'noise' }],
      },
    ],
    clipAssignments: [],
    createdAt: NOW,
    updatedAt: NOW,
    submittedAt: NOW,
  }
}

function backup() {
  return createProjectBackup(
    {
      project,
      taxonomyVersions: [taxonomy],
      instructions: null,
      tasks: [task('second', 2), task('first', 1)],
      annotations: [annotation('second'), annotation('first')],
    },
    NOW,
  )
}

describe('project backups', () => {
  it('round trips deterministically and removes browser media state', () => {
    const first = backup()
    const serialized = serializeProjectBackup(first)
    const parsed = parseProjectBackup(serialized)

    expect(parsed).toEqual(first)
    expect(parsed.tasks.map(({ id }) => id)).toEqual(['first', 'second'])
    expect(serialized).not.toContain('handleId')
    expect(serialized).not.toContain('permission')
    expect(serialized).not.toContain('private')
    expect(parsed.tasks.at(0)?.primaryMedia).toEqual({
      kind: 'unresolved',
      displayName: 'first.wav',
      reason: 'not-yet-linked',
    })
    expect(serializeProjectBackup(backup())).toBe(serialized)
  })

  it('rejects malformed JSON and unsupported versions', () => {
    expect(() => parseProjectBackup('{')).toThrow('not valid JSON')
    const value = backup() as unknown as Record<string, unknown>
    value.formatVersion = 2
    expect(() => parseProjectBackup(JSON.stringify(value))).toThrow(
      'Unsupported project backup version 2',
    )
  })

  it('rejects unsupported entity versions, duplicate IDs, and broken links', () => {
    const unsupported = structuredClone(backup())
    ;(unsupported.tasks[0]! as { schemaVersion: number }).schemaVersion = 2
    expect(() => parseProjectBackup(JSON.stringify(unsupported))).toThrow(
      'Task schema version 2 is unsupported',
    )

    const duplicate = structuredClone(backup())
    duplicate.tasks[1]!.id = duplicate.tasks[0]!.id
    expect(() => parseProjectBackup(JSON.stringify(duplicate))).toThrow(
      'duplicate id',
    )

    const broken = structuredClone(backup())
    broken.annotations[0]!.taxonomyVersionId = 'missing'
    expect(() => parseProjectBackup(JSON.stringify(broken))).toThrow(
      'missing taxonomy',
    )
  })
})
