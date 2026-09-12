import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  FolderSourceAdapter,
  folderReference,
  type DirectoryHandle,
} from '../domain/folderSources'
import {
  createProjectBackup,
  parseProjectBackup,
  serializeProjectBackup,
} from '../domain/projectBackup'
import { openWorkbenchDatabase } from './database'
import { IndexedDbProjectRepository } from './projectRepository'

async function setup() {
  const name = `folders-${crypto.randomUUID()}`
  const db = await openWorkbenchDatabase(name)
  const repository = new IndexedDbProjectRepository(db)
  const project = await repository.createProject({
    name: 'Test',
    taxonomy: {
      sourceFilename: 'labels.json',
      sourceFormat: 'json',
      rawSource: '{"schemaVersion":1,"labels":[{"id":"noise","name":"Noise"}]}',
      document: { schemaVersion: 1, labels: [{ id: 'noise', name: 'Noise' }] },
      metadata: {},
      contentHash: 'a'.repeat(64),
    },
  })
  // fake-indexeddb cannot structured-clone native handles. Store a cloneable
  // stand-in here; browser permission and traversal contracts are tested separately.
  const handle = { kind: 'directory', name: 'audio' } as DirectoryHandle
  await repository.saveSourceFolder(project.id, 'source', handle)
  return { name, db, repository, project, handle }
}

describe('folder persistence and portability', () => {
  it('remembers source handles across database reopen and scopes them to the project', async () => {
    const { name, db, project, handle } = await setup()
    db.close()
    const reopened = await openWorkbenchDatabase(name)
    try {
      const repository = new IndexedDbProjectRepository(reopened)
      expect(await repository.getSourceFolder(project.id, 'source')).toEqual(
        handle,
      )
      expect(
        await repository.getSourceFolder('other-project', 'source'),
      ).toBeUndefined()
      expect(
        (await repository.getProject(project.id))?.project.sourceFolders,
      ).toEqual([{ id: 'source', name: 'audio' }])
    } finally {
      reopened.close()
    }
  })
  it('links exact legacy directory and manifest paths, retaining task IDs and lifecycle state', async () => {
    const { db, repository, project } = await setup()
    try {
      const tasks = await repository.importTasks(project.id, [
        { audio: 'audio/left/clip.wav' },
        { audio: 'right/clip.wav' },
        { audio: 'missing/clip.wav' },
      ])
      expect(
        await repository.linkFolderTasks(project.id, 'source', [
          'left/clip.wav',
          'right/clip.wav',
        ]),
      ).toBe(2)
      const linked = await repository.listTasks(project.id)
      expect(
        linked.find((task) => task.id === tasks[0]!.id)?.primaryMedia,
      ).toEqual(folderReference(project.id, 'source', 'left/clip.wav'))
      expect(
        linked.find((task) => task.id === tasks[2]!.id)?.primaryMedia.kind,
      ).toBe('unresolved')
    } finally {
      db.close()
    }
  })
  it('exports portable folder identities, restores without handles, and resolves after one root replacement', async () => {
    const { db, repository, project } = await setup()
    try {
      await repository.importTasks(
        project.id,
        ['left/clip.wav', 'right/clip.wav'].map((audio) => ({
          audio,
          source: folderReference(project.id, 'source', audio),
        })),
      )
      const serialized = serializeProjectBackup(
        createProjectBackup(
          await repository.getProjectBackupRecords(project.id),
        ),
      )
      expect(serialized).not.toContain('"handle"')
      const backup = parseProjectBackup(serialized)
      expect(backup.project.sourceFolders).toEqual([
        { id: 'source', name: 'audio' },
      ])
      await repository.restoreProjectBackup(backup, true)
      expect(
        await repository.getSourceFolder(project.id, 'source'),
      ).toBeUndefined()
      expect(
        (await repository.listTasks(project.id)).map(
          (task) => task.primaryMedia,
        ),
      ).toEqual(backup.tasks.map((task) => task.primaryMedia))
      await repository.saveSourceFolder(project.id, 'source', {
        kind: 'directory',
        name: 'moved-root',
      } as DirectoryHandle)
      const adapter = new FolderSourceAdapter(async (projectId, id) => {
        if (!(await repository.getSourceFolder(projectId, id))) return undefined
        return {
          queryPermission: async () => 'granted',
          getDirectoryHandle: async () => ({
            getFileHandle: async () => ({
              getFile: async () => new File(['audio'], 'clip.wav'),
            }),
          }),
        } as unknown as DirectoryHandle
      })
      for (const task of await repository.listTasks(project.id))
        expect((await adapter.resolve(task.primaryMedia)).file.name).toBe(
          'clip.wav',
        )
      await repository.forgetSourceFolder(project.id, 'source')
      expect(
        await repository.getSourceFolder(project.id, 'source'),
      ).toBeUndefined()
      expect(await repository.listTasks(project.id)).toHaveLength(2)
      expect(
        (await repository.getProject(project.id))?.project.sourceFolders?.[0]
          ?.id,
      ).toBe('source')
    } finally {
      db.close()
    }
  })
  it('rolls back folder removal when restore fails, and deletes handles with the project', async () => {
    const { db, repository, project, handle } = await setup()
    try {
      const backup = createProjectBackup(
        await repository.getProjectBackupRecords(project.id),
      )
      const failing = new IndexedDbProjectRepository(db, {
        beforeRestoreCommit: () => {
          throw new Error('failure')
        },
      })
      await expect(failing.restoreProjectBackup(backup, true)).rejects.toThrow(
        'restoration failed',
      )
      expect(await repository.getSourceFolder(project.id, 'source')).toEqual(
        handle,
      )
      await repository.deleteProject(project.id)
      expect(
        await repository.getSourceFolder(project.id, 'source'),
      ).toBeUndefined()
    } finally {
      db.close()
    }
  })
  it('accepts old backups and rejects unsafe, foreign, missing, or handle-bearing folder references', async () => {
    const { db, repository, project } = await setup()
    try {
      const old = createProjectBackup(
        await repository.getProjectBackupRecords(project.id),
      )
      const legacy = { ...old, formatVersion: 1, project: { ...old.project } }
      delete legacy.project.sourceFolders
      expect(parseProjectBackup(JSON.stringify(legacy)).tasks).toEqual([])
      await repository.importTasks(project.id, [
        {
          audio: 'clip.wav',
          source: folderReference(project.id, 'source', 'clip.wav'),
        },
      ])
      const backup = createProjectBackup(
        await repository.getProjectBackupRecords(project.id),
      )
      for (const change of [
        { relativePath: '../clip.wav' },
        { projectId: 'foreign' },
        { sourceId: 'missing' },
        { handle: {} },
        { permission: 'granted' },
      ]) {
        const value = structuredClone(backup)
        Object.assign(value.tasks[0]!.primaryMedia, change)
        expect(() => parseProjectBackup(JSON.stringify(value))).toThrow()
      }
    } finally {
      db.close()
    }
  })
})
