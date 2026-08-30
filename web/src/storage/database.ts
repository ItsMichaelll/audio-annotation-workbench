import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  Project,
  ProjectInstructions,
  TaskRecord,
  TaxonomyVersion,
} from '../domain/models'

export const DATABASE_NAME = 'audio-annotation-workbench'
export const DATABASE_VERSION = 2

export interface WorkbenchDatabase extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: {
      'by-status': Project['status']
      'by-updated-at': string
    }
  }
  taxonomyVersions: {
    key: string
    value: TaxonomyVersion
    indexes: {
      'by-project': string
      'by-project-version': [string, number]
    }
  }
  instructions: {
    key: string
    value: ProjectInstructions
    indexes: { 'by-project': string }
  }
  tasks: {
    key: string
    value: TaskRecord
    indexes: {
      'by-project': string
      'by-project-status': [string, TaskRecord['status']]
      'by-project-updated-at': [string, string]
      'by-project-relative-path': [string, string]
    }
  }
}

export type WorkbenchDatabaseConnection = IDBPDatabase<WorkbenchDatabase>

export async function openWorkbenchDatabase(
  name = DATABASE_NAME,
): Promise<WorkbenchDatabaseConnection> {
  if (typeof indexedDB === 'undefined') {
    throw new Error(
      'IndexedDB is unavailable. Project data cannot be stored in this browser.',
    )
  }

  try {
    return await openDB<WorkbenchDatabase>(name, DATABASE_VERSION, {
      upgrade(database, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
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
        }
        if (oldVersion < 2) {
          transaction
            .objectStore('tasks')
            .createIndex('by-project-relative-path', [
              'projectId',
              'relativePath',
            ])
        }
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to initialize project storage: ${detail}`, {
      cause: error,
    })
  }
}
