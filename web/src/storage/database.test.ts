import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  type AnnotationDocument,
  type Project,
  type TaskRecord,
} from '../domain/models'
import { openWorkbenchDatabase } from './database'

describe('annotation database migration', () => {
  it('adds annotations without losing version-two project data', async () => {
    const name = `migration-${crypto.randomUUID()}`
    const legacy = await openDB(name, 2, {
      upgrade(database) {
        const projects = database.createObjectStore('projects', {
          keyPath: 'id',
        })
        projects.createIndex('by-status', 'status')
        projects.createIndex('by-updated-at', 'updatedAt')
        const taxonomies = database.createObjectStore('taxonomyVersions', {
          keyPath: 'id',
        })
        taxonomies.createIndex('by-project', 'projectId')
        taxonomies.createIndex('by-project-version', ['projectId', 'version'])
        const instructions = database.createObjectStore('instructions', {
          keyPath: 'id',
        })
        instructions.createIndex('by-project', 'projectId', { unique: true })
        const tasks = database.createObjectStore('tasks', { keyPath: 'id' })
        tasks.createIndex('by-project', 'projectId')
        tasks.createIndex('by-project-status', ['projectId', 'status'])
        tasks.createIndex('by-project-updated-at', ['projectId', 'updatedAt'])
        tasks.createIndex('by-project-relative-path', [
          'projectId',
          'relativePath',
        ])
      },
    })
    const project: Project = {
      id: 'existing-project',
      schemaVersion: PROJECT_SCHEMA_VERSION,
      name: 'Existing',
      status: 'active',
      activeTaxonomyVersionId: 'taxonomy',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    await legacy.put('projects', project)
    const task: TaskRecord = {
      id: 'existing-task',
      schemaVersion: TASK_SCHEMA_VERSION,
      projectId: project.id,
      status: 'draft',
      primaryMedia: {
        kind: 'unresolved',
        displayName: 'clip.wav',
        reason: 'missing',
      },
      metadata: {},
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }
    await legacy.put('tasks', task)
    legacy.close()

    const migrated = await openWorkbenchDatabase(name)
    expect(await migrated.get('projects', project.id)).toEqual(project)
    expect(await migrated.get('tasks', task.id)).toEqual(task)
    expect(Array.from(migrated.objectStoreNames)).toContain('annotations')
    migrated.close()
  })

  it('normalizes version-three region labels without changing clip labels', async () => {
    const name = `cardinality-migration-${crypto.randomUUID()}`
    const legacy = await openDB(name, 3, {
      upgrade(database) {
        const projects = database.createObjectStore('projects', {
          keyPath: 'id',
        })
        projects.createIndex('by-status', 'status')
        projects.createIndex('by-updated-at', 'updatedAt')
        const taxonomies = database.createObjectStore('taxonomyVersions', {
          keyPath: 'id',
        })
        taxonomies.createIndex('by-project', 'projectId')
        taxonomies.createIndex('by-project-version', ['projectId', 'version'])
        const instructions = database.createObjectStore('instructions', {
          keyPath: 'id',
        })
        instructions.createIndex('by-project', 'projectId', { unique: true })
        const tasks = database.createObjectStore('tasks', { keyPath: 'id' })
        tasks.createIndex('by-project', 'projectId')
        tasks.createIndex('by-project-status', ['projectId', 'status'])
        tasks.createIndex('by-project-updated-at', ['projectId', 'updatedAt'])
        tasks.createIndex('by-project-relative-path', [
          'projectId',
          'relativePath',
        ])
        const annotations = database.createObjectStore('annotations', {
          keyPath: 'id',
        })
        annotations.createIndex('by-project', 'projectId')
        annotations.createIndex('by-task', 'taskId', { unique: true })
      },
    })
    const annotation: AnnotationDocument = {
      id: 'annotation',
      schemaVersion: ANNOTATION_SCHEMA_VERSION,
      projectId: 'project',
      taskId: 'task',
      taxonomyVersionId: 'taxonomy',
      revision: 1,
      regions: [
        {
          id: 'region',
          start: 0,
          end: 1,
          assignments: [
            { labelId: 'first', severity: 'minor' },
            { labelId: 'second' },
          ],
        },
      ],
      clipAssignments: [{ labelId: 'first' }, { labelId: 'second' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    await legacy.put('annotations', annotation)
    legacy.close()

    const migrated = await openWorkbenchDatabase(name)
    const stored = await migrated.get('annotations', annotation.id)
    expect(stored?.regions[0]?.assignments).toEqual([
      { labelId: 'first', severity: 'minor' },
    ])
    expect(stored?.clipAssignments).toEqual(annotation.clipAssignments)
    migrated.close()
  })
})
