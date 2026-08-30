import type { IDBPTransaction, StoreNames } from 'idb'
import {
  INSTRUCTIONS_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  TAXONOMY_RECORD_SCHEMA_VERSION,
  type Project,
  type ProjectAggregate,
  type ProjectInstructions,
  type ProjectStatus,
  type ProjectSummary,
  type TaskRecord,
  type TaxonomyVersion,
} from '../domain/models'
import { deriveTaskProgress } from '../domain/taskProgress'
import type { PreparedInstructions, PreparedTaxonomy } from '../domain/uploads'
import {
  openWorkbenchDatabase,
  type WorkbenchDatabase,
  type WorkbenchDatabaseConnection,
} from './database'

export interface CreateProjectInput {
  name: string
  description?: string
  taxonomy: PreparedTaxonomy
  instructions?: PreparedInstructions
}

export interface UpdateProjectInput {
  name: string
  description?: string
}

export interface TaxonomyUpdateResult {
  taxonomy: TaxonomyVersion
  created: boolean
}

export interface ProjectRepository {
  createProject(input: CreateProjectInput): Promise<Project>
  getProject(id: string): Promise<ProjectAggregate | null>
  listProjects(status?: ProjectStatus): Promise<ProjectSummary[]>
  updateProject(id: string, input: UpdateProjectInput): Promise<Project>
  setProjectStatus(id: string, status: ProjectStatus): Promise<Project>
  addTaxonomyVersion(
    projectId: string,
    taxonomy: PreparedTaxonomy,
  ): Promise<TaxonomyUpdateResult>
  replaceInstructions(
    projectId: string,
    instructions: PreparedInstructions,
  ): Promise<ProjectInstructions>
  removeInstructions(projectId: string): Promise<Project>
  deleteProject(projectId: string): Promise<void>
}

interface RepositoryDependencies {
  now?: () => string
  uuid?: () => string
  beforeCreateCommit?: () => void
}

function cleanDescription(description: string | undefined): string | undefined {
  const value = description?.trim()
  return value ? value : undefined
}

function requireName(name: string): string {
  const value = name.trim()
  if (!value) throw new Error('Project name is required.')
  return value
}

type ProjectStores = StoreNames<WorkbenchDatabase>
type ProjectTransaction = IDBPTransaction<
  WorkbenchDatabase,
  ProjectStores[],
  'readwrite'
>

async function deleteAllByProject(
  transaction: ProjectTransaction,
  storeName: 'taxonomyVersions' | 'instructions' | 'tasks',
  projectId: string,
): Promise<void> {
  const store = transaction.objectStore(storeName)
  let cursor = await store.index('by-project').openKeyCursor(projectId)
  while (cursor) {
    await store.delete(cursor.primaryKey)
    cursor = await cursor.continue()
  }
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private readonly now: () => string
  private readonly uuid: () => string
  private readonly beforeCreateCommit: (() => void) | undefined

  constructor(
    private readonly database: WorkbenchDatabaseConnection,
    dependencies: RepositoryDependencies = {},
  ) {
    this.now = dependencies.now ?? (() => new Date().toISOString())
    this.uuid = dependencies.uuid ?? (() => crypto.randomUUID())
    this.beforeCreateCommit = dependencies.beforeCreateCommit
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const timestamp = this.now()
    const projectId = this.uuid()
    const taxonomyId = this.uuid()
    const instructionsId = input.instructions ? this.uuid() : undefined
    const project: Project = {
      id: projectId,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      name: requireName(input.name),
      status: 'active',
      activeTaxonomyVersionId: taxonomyId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const description = cleanDescription(input.description)
    if (description) project.description = description
    if (instructionsId) project.instructionsId = instructionsId

    const taxonomy = this.taxonomyRecord(
      projectId,
      taxonomyId,
      1,
      input.taxonomy,
      timestamp,
    )
    const transaction = this.database.transaction(
      ['projects', 'taxonomyVersions', 'instructions'],
      'readwrite',
    )
    try {
      await transaction.objectStore('projects').add(project)
      await transaction.objectStore('taxonomyVersions').add(taxonomy)
      if (input.instructions && instructionsId) {
        await transaction.objectStore('instructions').add({
          id: instructionsId,
          schemaVersion: INSTRUCTIONS_SCHEMA_VERSION,
          projectId,
          sourceFilename: input.instructions.sourceFilename,
          rawMarkdown: input.instructions.rawMarkdown,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      }
      this.beforeCreateCommit?.()
      await transaction.done
      return project
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        // IndexedDB may already have aborted the transaction.
      }
      await transaction.done.catch(() => undefined)
      throw new Error('Project creation failed; no project data was saved.', {
        cause: error,
      })
    }
  }

  async getProject(id: string): Promise<ProjectAggregate | null> {
    const transaction = this.database.transaction(
      ['projects', 'taxonomyVersions', 'instructions', 'tasks'],
      'readonly',
    )
    const project = await transaction.objectStore('projects').get(id)
    if (!project) return null
    const taxonomyVersions = await transaction
      .objectStore('taxonomyVersions')
      .index('by-project')
      .getAll(id)
    const tasks = await transaction
      .objectStore('tasks')
      .index('by-project')
      .getAll(id)
    const instructions = project.instructionsId
      ? ((await transaction
          .objectStore('instructions')
          .get(project.instructionsId)) ?? null)
      : null
    await transaction.done
    const activeTaxonomyVersion = taxonomyVersions.find(
      (taxonomy) => taxonomy.id === project.activeTaxonomyVersionId,
    )
    if (!activeTaxonomyVersion) {
      throw new Error('The project references a missing taxonomy version.')
    }
    return {
      project,
      activeTaxonomyVersion,
      taxonomyVersions: taxonomyVersions.sort(
        (left, right) => right.version - left.version,
      ),
      instructions,
      progress: deriveTaskProgress(tasks),
    }
  }

  async listProjects(status?: ProjectStatus): Promise<ProjectSummary[]> {
    const transaction = this.database.transaction(
      ['projects', 'taxonomyVersions', 'tasks'],
      'readonly',
    )
    const projects = status
      ? await transaction
          .objectStore('projects')
          .index('by-status')
          .getAll(status)
      : await transaction.objectStore('projects').getAll()
    const taxonomies = await transaction
      .objectStore('taxonomyVersions')
      .getAll()
    const tasks = await transaction.objectStore('tasks').getAll()
    await transaction.done

    const taxonomyById = new Map(
      taxonomies.map((taxonomy) => [taxonomy.id, taxonomy]),
    )
    const tasksByProject = new Map<string, TaskRecord[]>()
    for (const task of tasks) {
      const projectTasks = tasksByProject.get(task.projectId) ?? []
      projectTasks.push(task)
      tasksByProject.set(task.projectId, projectTasks)
    }

    return projects
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((project) => {
        const activeTaxonomyVersion = taxonomyById.get(
          project.activeTaxonomyVersionId,
        )
        if (!activeTaxonomyVersion) {
          throw new Error(
            `Project ${project.id} references a missing taxonomy version.`,
          )
        }
        return {
          project,
          activeTaxonomyVersion,
          progress: deriveTaskProgress(tasksByProject.get(project.id) ?? []),
        }
      })
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const project = await this.requireProject(id)
    const updated: Project = {
      ...project,
      name: requireName(input.name),
      updatedAt: this.now(),
    }
    const description = cleanDescription(input.description)
    if (description) updated.description = description
    else delete updated.description
    await this.database.put('projects', updated)
    return updated
  }

  async setProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
    const project = await this.requireProject(id)
    if (project.status === status) return project
    const updated = { ...project, status, updatedAt: this.now() }
    await this.database.put('projects', updated)
    return updated
  }

  async addTaxonomyVersion(
    projectId: string,
    taxonomy: PreparedTaxonomy,
  ): Promise<TaxonomyUpdateResult> {
    const transaction = this.database.transaction(
      ['projects', 'taxonomyVersions'],
      'readwrite',
    )
    const projectStore = transaction.objectStore('projects')
    const taxonomyStore = transaction.objectStore('taxonomyVersions')
    const project = await projectStore.get(projectId)
    if (!project) throw new Error('Project not found.')
    const existing = await taxonomyStore.index('by-project').getAll(projectId)
    const duplicate = existing.find(
      (version) => version.contentHash === taxonomy.contentHash,
    )
    if (duplicate) {
      await transaction.done
      return { taxonomy: duplicate, created: false }
    }
    const timestamp = this.now()
    const nextVersion =
      existing.reduce(
        (highest, version) => Math.max(highest, version.version),
        0,
      ) + 1
    const record = this.taxonomyRecord(
      projectId,
      this.uuid(),
      nextVersion,
      taxonomy,
      timestamp,
    )
    await taxonomyStore.add(record)
    await projectStore.put({
      ...project,
      activeTaxonomyVersionId: record.id,
      updatedAt: timestamp,
    })
    await transaction.done
    return { taxonomy: record, created: true }
  }

  async replaceInstructions(
    projectId: string,
    instructions: PreparedInstructions,
  ): Promise<ProjectInstructions> {
    const transaction = this.database.transaction(
      ['projects', 'instructions'],
      'readwrite',
    )
    const projectStore = transaction.objectStore('projects')
    const instructionStore = transaction.objectStore('instructions')
    const project = await projectStore.get(projectId)
    if (!project) throw new Error('Project not found.')
    const timestamp = this.now()
    const existing = project.instructionsId
      ? await instructionStore.get(project.instructionsId)
      : undefined
    const record: ProjectInstructions = existing
      ? {
          ...existing,
          sourceFilename: instructions.sourceFilename,
          rawMarkdown: instructions.rawMarkdown,
          updatedAt: timestamp,
        }
      : {
          id: this.uuid(),
          schemaVersion: INSTRUCTIONS_SCHEMA_VERSION,
          projectId,
          sourceFilename: instructions.sourceFilename,
          rawMarkdown: instructions.rawMarkdown,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
    await instructionStore.put(record)
    await projectStore.put({
      ...project,
      instructionsId: record.id,
      updatedAt: timestamp,
    })
    await transaction.done
    return record
  }

  async removeInstructions(projectId: string): Promise<Project> {
    const transaction = this.database.transaction(
      ['projects', 'instructions'],
      'readwrite',
    )
    const projectStore = transaction.objectStore('projects')
    const project = await projectStore.get(projectId)
    if (!project) throw new Error('Project not found.')
    if (project.instructionsId) {
      await transaction
        .objectStore('instructions')
        .delete(project.instructionsId)
    }
    const updated = { ...project, updatedAt: this.now() }
    delete updated.instructionsId
    await projectStore.put(updated)
    await transaction.done
    return updated
  }

  async deleteProject(projectId: string): Promise<void> {
    const transaction = this.database.transaction(
      ['projects', 'taxonomyVersions', 'instructions', 'tasks'],
      'readwrite',
    ) as ProjectTransaction
    try {
      await deleteAllByProject(transaction, 'taxonomyVersions', projectId)
      await deleteAllByProject(transaction, 'instructions', projectId)
      await deleteAllByProject(transaction, 'tasks', projectId)
      await transaction.objectStore('projects').delete(projectId)
      await transaction.done
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        // IndexedDB may already have aborted the transaction.
      }
      await transaction.done.catch(() => undefined)
      throw new Error(
        'Project deletion failed; project data was not removed.',
        {
          cause: error,
        },
      )
    }
  }

  private async requireProject(id: string): Promise<Project> {
    const project = await this.database.get('projects', id)
    if (!project) throw new Error('Project not found.')
    return project
  }

  private taxonomyRecord(
    projectId: string,
    id: string,
    version: number,
    taxonomy: PreparedTaxonomy,
    createdAt: string,
  ): TaxonomyVersion {
    const record: TaxonomyVersion = {
      id,
      schemaVersion: TAXONOMY_RECORD_SCHEMA_VERSION,
      projectId,
      version,
      sourceFilename: taxonomy.sourceFilename,
      sourceFormat: taxonomy.sourceFormat,
      rawSource: taxonomy.rawSource,
      document: taxonomy.document,
      metadata: taxonomy.metadata,
      contentHash: taxonomy.contentHash,
      createdAt,
    }
    if (taxonomy.metadata.schemaVersion) {
      record.taxonomySchemaVersion = taxonomy.metadata.schemaVersion
    }
    return record
  }
}

let repositoryPromise: Promise<IndexedDbProjectRepository> | null = null

export function getProjectRepository(): Promise<IndexedDbProjectRepository> {
  repositoryPromise ??= openWorkbenchDatabase().then(
    (database) => new IndexedDbProjectRepository(database),
  )
  return repositoryPromise
}
