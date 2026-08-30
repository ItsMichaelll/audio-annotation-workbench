import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  INSTRUCTIONS_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  type ProjectInstructions,
  type TaskRecord,
} from '../domain/models'
import type { PreparedTaxonomy } from '../domain/uploads'
import {
  DATABASE_VERSION,
  openWorkbenchDatabase,
  type WorkbenchDatabaseConnection,
} from './database'
import { IndexedDbProjectRepository } from './projectRepository'

const NOW = '2026-01-02T03:04:05.000Z'

function taxonomy(
  hash = 'a'.repeat(64),
  filename = 'taxonomy.yaml',
): PreparedTaxonomy {
  return {
    sourceFilename: filename,
    sourceFormat: filename.endsWith('.json') ? 'json' : 'yaml',
    rawSource: 'name: Generic labels\n',
    document: { name: 'Generic labels' },
    metadata: { name: 'Generic labels', schemaVersion: '1' },
    contentHash: hash,
  }
}

describe('IndexedDB project repository', () => {
  let database: WorkbenchDatabaseConnection
  let repository: IndexedDbProjectRepository
  let id = 0

  beforeEach(async () => {
    database = await openWorkbenchDatabase(`test-${crypto.randomUUID()}`)
    repository = new IndexedDbProjectRepository(database, {
      now: () => NOW,
      uuid: () => `stable-id-${++id}`,
    })
  })

  afterEach(() => database.close())

  it('initializes the migrated schema with task source indexes', () => {
    expect(database.version).toBe(DATABASE_VERSION)
    expect(Array.from(database.objectStoreNames)).toEqual([
      'instructions',
      'projects',
      'tasks',
      'taxonomyVersions',
    ])
    const transaction = database.transaction('tasks')
    expect(Array.from(transaction.store.indexNames)).toEqual([
      'by-project',
      'by-project-relative-path',
      'by-project-status',
      'by-project-updated-at',
    ])
  })

  it('creates and retrieves a project transactionally with stable IDs', async () => {
    const project = await repository.createProject({
      name: 'Reference Review',
      description: '  Generic audio review  ',
      taxonomy: taxonomy(),
      instructions: {
        sourceFilename: 'instructions.md',
        rawMarkdown: '# Review carefully',
      },
    })
    const aggregate = await repository.getProject(project.id)

    expect(project.id).toBe('stable-id-1')
    expect(project.id).not.toContain(project.name)
    expect(project.description).toBe('Generic audio review')
    expect(aggregate?.activeTaxonomyVersion.version).toBe(1)
    expect(aggregate?.instructions?.rawMarkdown).toBe('# Review carefully')
    expect(aggregate?.progress.total).toBe(0)
  })

  it('rolls back every project record when creation fails before commit', async () => {
    const failing = new IndexedDbProjectRepository(database, {
      now: () => NOW,
      uuid: () => `rollback-${++id}`,
      beforeCreateCommit: () => {
        throw new Error('simulated write failure')
      },
    })

    await expect(
      failing.createProject({ name: 'Rollback', taxonomy: taxonomy() }),
    ).rejects.toThrow('no project data was saved')
    expect(await database.getAll('projects')).toEqual([])
    expect(await database.getAll('taxonomyVersions')).toEqual([])
    expect(await database.getAll('instructions')).toEqual([])
  })

  it('lists active and archived projects separately and preserves rename IDs', async () => {
    const first = await repository.createProject({
      name: 'First',
      taxonomy: taxonomy('a'.repeat(64)),
    })
    const second = await repository.createProject({
      name: 'Second',
      taxonomy: taxonomy('b'.repeat(64)),
    })
    const renamed = await repository.updateProject(first.id, {
      name: 'Renamed',
      description: 'Updated',
    })
    await repository.setProjectStatus(second.id, 'archived')

    expect(renamed.id).toBe(first.id)
    expect(
      (await repository.listProjects('active')).map(
        ({ project }) => project.name,
      ),
    ).toEqual(['Renamed'])
    expect(
      (await repository.listProjects('archived')).map(
        ({ project }) => project.name,
      ),
    ).toEqual(['Second'])
    await repository.setProjectStatus(second.id, 'active')
    expect((await repository.listProjects('active')).length).toBe(2)
  })

  it('creates immutable taxonomy versions and avoids duplicate content', async () => {
    const project = await repository.createProject({
      name: 'Versioned',
      taxonomy: taxonomy('a'.repeat(64), 'first.yaml'),
    })
    const duplicate = await repository.addTaxonomyVersion(
      project.id,
      taxonomy('a'.repeat(64), 'duplicate.yaml'),
    )
    const replacement = await repository.addTaxonomyVersion(
      project.id,
      taxonomy('b'.repeat(64), 'second.json'),
    )
    const aggregate = await repository.getProject(project.id)

    expect(duplicate.created).toBe(false)
    expect(replacement).toMatchObject({
      created: true,
      taxonomy: { version: 2 },
    })
    expect(aggregate?.taxonomyVersions.map(({ version }) => version)).toEqual([
      2, 1,
    ])
    expect(aggregate?.activeTaxonomyVersion.id).toBe(replacement.taxonomy.id)
    expect(aggregate?.taxonomyVersions[1]?.sourceFilename).toBe('first.yaml')
  })

  it('creates, replaces, and removes one instruction record', async () => {
    const project = await repository.createProject({
      name: 'Instructions',
      taxonomy: taxonomy(),
    })
    const created = await repository.replaceInstructions(project.id, {
      sourceFilename: 'first.md',
      rawMarkdown: 'First',
    })
    const replaced = await repository.replaceInstructions(project.id, {
      sourceFilename: 'second.md',
      rawMarkdown: 'Second',
    })

    expect(replaced.id).toBe(created.id)
    expect(
      (await repository.getProject(project.id))?.instructions,
    ).toMatchObject({
      sourceFilename: 'second.md',
      rawMarkdown: 'Second',
    })
    const updated = await repository.removeInstructions(project.id)
    expect(updated.instructionsId).toBeUndefined()
    expect(await database.getAll('instructions')).toEqual([])
  })

  it('deletes associated records without touching unrelated projects', async () => {
    const target = await repository.createProject({
      name: 'Delete me',
      taxonomy: taxonomy('a'.repeat(64)),
      instructions: { sourceFilename: 'guide.md', rawMarkdown: 'Guide' },
    })
    const retained = await repository.createProject({
      name: 'Keep me',
      taxonomy: taxonomy('b'.repeat(64)),
    })
    const task: TaskRecord = {
      id: 'task-1',
      schemaVersion: TASK_SCHEMA_VERSION,
      projectId: target.id,
      status: 'unstarted',
      primaryMedia: {
        kind: 'unresolved',
        displayName: 'sample.wav',
        reason: 'not-yet-linked',
      },
      metadata: {},
      createdAt: NOW,
      updatedAt: NOW,
    }
    await database.put('tasks', task)
    await repository.deleteProject(target.id)

    expect(await repository.getProject(target.id)).toBeNull()
    expect(await repository.getProject(retained.id)).not.toBeNull()
    expect(
      await database.getAllFromIndex('tasks', 'by-project', target.id),
    ).toEqual([])
    expect(
      await database.getAllFromIndex(
        'taxonomyVersions',
        'by-project',
        target.id,
      ),
    ).toEqual([])
    expect(
      await database.getAllFromIndex('instructions', 'by-project', target.id),
    ).toEqual([])
  })

  it('returns null for an unknown project and derives stored task progress', async () => {
    expect(await repository.getProject('missing')).toBeNull()
    const project = await repository.createProject({
      name: 'Progress',
      taxonomy: taxonomy(),
    })
    const records: TaskRecord[] = ['submitted', 'draft'].map(
      (status, index) => ({
        id: `task-${index}`,
        schemaVersion: TASK_SCHEMA_VERSION,
        projectId: project.id,
        status: status as TaskRecord['status'],
        primaryMedia: {
          kind: 'unresolved',
          displayName: `sample-${index}.wav`,
          reason: 'not-yet-linked',
        },
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      }),
    )
    const transaction = database.transaction('tasks', 'readwrite')
    await Promise.all(records.map((record) => transaction.store.put(record)))
    await transaction.done

    expect((await repository.getProject(project.id))?.progress).toMatchObject({
      total: 2,
      submitted: 1,
      inProgress: 1,
      completed: 1,
    })
  })

  it('stores instruction records with the centralized schema version', async () => {
    const record: ProjectInstructions = {
      id: 'instructions-1',
      schemaVersion: INSTRUCTIONS_SCHEMA_VERSION,
      projectId: 'project-1',
      sourceFilename: 'guide.md',
      rawMarkdown: 'Guide',
      createdAt: NOW,
      updatedAt: NOW,
    }
    expect(record.schemaVersion).toBe(1)
  })
})
