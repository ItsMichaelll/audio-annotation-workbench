import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ANNOTATION_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  TAXONOMY_RECORD_SCHEMA_VERSION,
} from '../domain/models'
import {
  createProjectBackup,
  type ProjectBackup,
} from '../domain/projectBackup'
import {
  openWorkbenchDatabase,
  type WorkbenchDatabaseConnection,
} from './database'
import {
  IndexedDbProjectRepository,
  ProjectRestoreCollisionError,
} from './projectRepository'

const NOW = '2026-09-01T00:00:00.000Z'

function backup(id = 'project-1', name = 'Restored'): ProjectBackup {
  const taxonomyId = `${id}-taxonomy`
  const taskId = `${id}-task`
  return createProjectBackup(
    {
      project: {
        id,
        schemaVersion: PROJECT_SCHEMA_VERSION,
        name,
        status: 'active',
        activeTaxonomyVersionId: taxonomyId,
        createdAt: NOW,
        updatedAt: NOW,
      },
      taxonomyVersions: [
        {
          id: taxonomyId,
          schemaVersion: TAXONOMY_RECORD_SCHEMA_VERSION,
          projectId: id,
          version: 1,
          sourceFilename: 'taxonomy.json',
          sourceFormat: 'json',
          rawSource: '{"schemaVersion":1}',
          document: {
            schemaVersion: 1,
            labels: [{ id: 'noise', name: 'Noise', scopes: ['region'] }],
          },
          metadata: { schemaVersion: '1' },
          contentHash: 'a'.repeat(64),
          createdAt: NOW,
        },
      ],
      instructions: null,
      tasks: [
        {
          id: taskId,
          schemaVersion: TASK_SCHEMA_VERSION,
          projectId: id,
          status: 'submitted',
          displayName: 'audio.wav',
          relativePath: 'audio/audio.wav',
          primaryMedia: {
            kind: 'unresolved',
            displayName: 'audio.wav',
            reason: 'not-yet-linked',
          },
          metadata: {},
          importOrder: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      annotations: [
        {
          id: `${id}-annotation`,
          schemaVersion: ANNOTATION_SCHEMA_VERSION,
          projectId: id,
          taskId,
          taxonomyVersionId: taxonomyId,
          revision: 7,
          regions: [
            {
              id: 'region-1',
              start: 0,
              end: 1,
              assignments: [{ labelId: 'noise' }],
            },
          ],
          clipAssignments: [],
          createdAt: NOW,
          updatedAt: NOW,
          submittedAt: NOW,
        },
      ],
    },
    NOW,
  )
}

describe('atomic project backup restoration', () => {
  let database: WorkbenchDatabaseConnection
  let repository: IndexedDbProjectRepository

  beforeEach(async () => {
    database = await openWorkbenchDatabase(`restore-${crypto.randomUUID()}`)
    repository = new IndexedDbProjectRepository(database)
  })

  afterEach(() => database.close())

  it('restores all records while preserving taxonomy pinning and revisions', async () => {
    const source = backup()
    await repository.restoreProjectBackup(source)
    const restored = await repository.getProjectBackupRecords(source.project.id)

    expect(restored.project.name).toBe('Restored')
    expect(restored.annotations[0]).toMatchObject({
      revision: 7,
      taxonomyVersionId: 'project-1-taxonomy',
      submittedAt: NOW,
    })
    expect(restored.tasks[0]?.primaryMedia.kind).toBe('unresolved')
  })

  it('requires explicit replacement and replaces only the colliding project', async () => {
    await repository.restoreProjectBackup(backup('project-1', 'Original'))
    await repository.restoreProjectBackup(backup('project-2', 'Unrelated'))

    await expect(
      repository.restoreProjectBackup(backup('project-1', 'Replacement')),
    ).rejects.toBeInstanceOf(ProjectRestoreCollisionError)

    await repository.restoreProjectBackup(
      backup('project-1', 'Replacement'),
      true,
    )
    expect(
      (await repository.getProjectBackupRecords('project-1')).project.name,
    ).toBe('Replacement')
    expect(
      (await repository.getProjectBackupRecords('project-2')).project.name,
    ).toBe('Unrelated')
  })

  it('rolls replacement back when a write transaction fails', async () => {
    await repository.restoreProjectBackup(backup('project-1', 'Original'))
    const failing = new IndexedDbProjectRepository(database, {
      beforeRestoreCommit: () => {
        throw new Error('Injected failure')
      },
    })

    await expect(
      failing.restoreProjectBackup(backup('project-1', 'Replacement'), true),
    ).rejects.toThrow('existing project data was not changed')

    const restored = await repository.getProjectBackupRecords('project-1')
    expect(restored.project.name).toBe('Original')
    expect(restored.annotations).toHaveLength(1)
  })
})
