import type { IDBPTransaction, StoreNames } from 'idb'
import { normalizeAnnotationCardinality } from '../domain/annotations'
import {
  INSTRUCTIONS_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  TAXONOMY_RECORD_SCHEMA_VERSION,
  type AnnotationDocument,
  type Project,
  type ProjectAggregate,
  type ProjectInstructions,
  type ProjectStatus,
  type ProjectSummary,
  type TaskRecord,
  type TaxonomyVersion,
} from '../domain/models'
import { deriveTaskProgress } from '../domain/taskProgress'
import {
  assertRelinkSelectionMatchesTask,
  type RelinkSelection,
} from '../domain/relink'
import {
  canTransitionTask,
  taskFromCandidate,
  type ImportCandidate,
} from '../domain/taskIngestion'
import {
  canonicalTaxonomyContent,
  type PreparedInstructions,
  type PreparedTaxonomy,
} from '../domain/uploads'
import {
  openWorkbenchDatabase,
  type WorkbenchDatabase,
  type WorkbenchDatabaseConnection,
} from './database'
import type {
  ProjectBackup,
  ProjectBackupRecords,
} from '../domain/projectBackup'

export interface CreateProjectInput {
  name: string
  description?: string
  taxonomy: PreparedTaxonomy
  instructions?: PreparedInstructions
  tasks?: ImportCandidate[]
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
  listTasks(projectId: string): Promise<TaskRecord[]>
  importTasks(
    projectId: string,
    candidates: ImportCandidate[],
  ): Promise<TaskRecord[]>
  updateTaskStatus(
    projectId: string,
    taskIds: string[],
    status: TaskRecord['status'],
  ): Promise<void>
  deleteTasks(projectId: string, taskIds: string[]): Promise<void>
  relinkTask(
    projectId: string,
    taskId: string,
    source: TaskRecord['primaryMedia'],
    selection: RelinkSelection,
  ): Promise<void>
  getAnnotation(taskId: string): Promise<AnnotationDocument | null>
  getProjectBackupRecords(projectId: string): Promise<ProjectBackupRecords>
  restoreProjectBackup(
    backup: ProjectBackup,
    replaceExisting?: boolean,
  ): Promise<void>
  saveAnnotationDraft(
    annotation: AnnotationDocument,
  ): Promise<AnnotationDocument>
  submitAnnotation(annotation: AnnotationDocument): Promise<AnnotationDocument>
  skipTask(projectId: string, taskId: string): Promise<void>
}

interface RepositoryDependencies {
  now?: () => string
  uuid?: () => string
  beforeCreateCommit?: () => void
  beforeRestoreCommit?: () => void
}

export class ProjectRestoreCollisionError extends Error {
  constructor(readonly projectId: string) {
    super('A project with this backup ID already exists.')
    this.name = 'ProjectRestoreCollisionError'
  }
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
  storeName: 'taxonomyVersions' | 'instructions' | 'tasks' | 'annotations',
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
  private readonly beforeRestoreCommit: (() => void) | undefined

  constructor(
    private readonly database: WorkbenchDatabaseConnection,
    dependencies: RepositoryDependencies = {},
  ) {
    this.now = dependencies.now ?? (() => new Date().toISOString())
    this.uuid = dependencies.uuid ?? (() => crypto.randomUUID())
    this.beforeCreateCommit = dependencies.beforeCreateCommit
    this.beforeRestoreCommit = dependencies.beforeRestoreCommit
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
      ['projects', 'taxonomyVersions', 'instructions', 'tasks', 'annotations'],
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
      for (const [index, candidate] of (input.tasks ?? []).entries()) {
        await transaction
          .objectStore('tasks')
          .add(
            taskFromCandidate(
              projectId,
              candidate,
              this.uuid(),
              timestamp,
              index,
            ),
          )
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
      ['projects', 'taxonomyVersions', 'instructions', 'tasks', 'annotations'],
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
      tasks,
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
    const taxonomyContent = canonicalTaxonomyContent(taxonomy.document)
    const duplicate = existing.find(
      (version) =>
        version.contentHash === taxonomy.contentHash ||
        canonicalTaxonomyContent(version.document) === taxonomyContent,
    )
    if (duplicate) {
      if (project.activeTaxonomyVersionId !== duplicate.id) {
        await projectStore.put({
          ...project,
          activeTaxonomyVersionId: duplicate.id,
          updatedAt: this.now(),
        })
      }
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
      ['projects', 'taxonomyVersions', 'instructions', 'tasks', 'annotations'],
      'readwrite',
    ) as ProjectTransaction
    try {
      await deleteAllByProject(transaction, 'taxonomyVersions', projectId)
      await deleteAllByProject(transaction, 'instructions', projectId)
      await deleteAllByProject(transaction, 'tasks', projectId)
      await deleteAllByProject(transaction, 'annotations', projectId)
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

  async listTasks(projectId: string): Promise<TaskRecord[]> {
    return this.database.getAllFromIndex('tasks', 'by-project', projectId)
  }

  async importTasks(
    projectId: string,
    candidates: ImportCandidate[],
  ): Promise<TaskRecord[]> {
    const transaction = this.database.transaction(
      ['projects', 'tasks'],
      'readwrite',
    )
    try {
      const project = await transaction.objectStore('projects').get(projectId)
      if (!project) throw new Error('Project not found.')
      const timestamp = this.now()
      const existing = await transaction
        .objectStore('tasks')
        .index('by-project')
        .getAll(projectId)
      const firstImportOrder = Math.max(
        existing.length,
        existing.reduce(
          (highest, task) => Math.max(highest, task.importOrder ?? -1),
          -1,
        ) + 1,
      )
      const records = candidates.map((candidate, index) =>
        taskFromCandidate(
          projectId,
          candidate,
          this.uuid(),
          timestamp,
          firstImportOrder + index,
        ),
      )
      for (const record of records)
        await transaction.objectStore('tasks').add(record)
      await transaction
        .objectStore('projects')
        .put({ ...project, updatedAt: timestamp })
      await transaction.done
      return records
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        /* already aborted */
      }
      await transaction.done.catch(() => undefined)
      throw new Error('Task import failed; no tasks were saved.', {
        cause: error,
      })
    }
  }

  async updateTaskStatus(
    projectId: string,
    taskIds: string[],
    status: TaskRecord['status'],
  ): Promise<void> {
    const transaction = this.database.transaction(
      ['projects', 'tasks'],
      'readwrite',
    )
    const store = transaction.objectStore('tasks')
    const timestamp = this.now()
    for (const id of taskIds) {
      const task = await store.get(id)
      if (!task || task.projectId !== projectId)
        throw new Error('Task not found.')
      if (!canTransitionTask(task.status, status))
        throw new Error(`Cannot change ${task.status} to ${status}.`)
      await store.put({ ...task, status, updatedAt: timestamp })
    }
    const project = await transaction.objectStore('projects').get(projectId)
    if (project)
      await transaction
        .objectStore('projects')
        .put({ ...project, updatedAt: timestamp })
    await transaction.done
  }

  async deleteTasks(projectId: string, taskIds: string[]): Promise<void> {
    const transaction = this.database.transaction(
      ['projects', 'tasks', 'annotations'],
      'readwrite',
    )
    for (const id of taskIds) {
      const task = await transaction.objectStore('tasks').get(id)
      if (!task || task.projectId !== projectId)
        throw new Error('Task not found.')
      const annotation = await transaction
        .objectStore('annotations')
        .index('by-task')
        .get(id)
      if (annotation) {
        await transaction.objectStore('annotations').delete(annotation.id)
      }
      await transaction.objectStore('tasks').delete(id)
    }
    const project = await transaction.objectStore('projects').get(projectId)
    if (project)
      await transaction
        .objectStore('projects')
        .put({ ...project, updatedAt: this.now() })
    await transaction.done
  }

  async relinkTask(
    projectId: string,
    taskId: string,
    source: TaskRecord['primaryMedia'],
    selection: RelinkSelection,
  ): Promise<void> {
    const task = await this.database.get('tasks', taskId)
    if (!task || task.projectId !== projectId)
      throw new Error('Task not found.')
    assertRelinkSelectionMatchesTask(task, selection)
    await this.database.put('tasks', {
      ...task,
      primaryMedia: source,
      updatedAt: this.now(),
    })
  }

  async getAnnotation(taskId: string): Promise<AnnotationDocument | null> {
    const annotation = await this.database.getFromIndex(
      'annotations',
      'by-task',
      taskId,
    )
    return annotation ? normalizeAnnotationCardinality(annotation) : null
  }

  async getProjectBackupRecords(
    projectId: string,
  ): Promise<ProjectBackupRecords> {
    const transaction = this.database.transaction(
      ['projects', 'taxonomyVersions', 'instructions', 'tasks', 'annotations'],
      'readonly',
    )
    const project = await transaction.objectStore('projects').get(projectId)
    if (!project) throw new Error('Project not found.')
    const [taxonomyVersions, tasks, annotations, instructions] =
      await Promise.all([
        transaction
          .objectStore('taxonomyVersions')
          .index('by-project')
          .getAll(projectId),
        transaction.objectStore('tasks').index('by-project').getAll(projectId),
        transaction
          .objectStore('annotations')
          .index('by-project')
          .getAll(projectId),
        project.instructionsId
          ? transaction.objectStore('instructions').get(project.instructionsId)
          : Promise.resolve(undefined),
      ])
    await transaction.done
    return {
      project,
      taxonomyVersions,
      instructions: instructions ?? null,
      tasks,
      annotations: annotations.map(normalizeAnnotationCardinality),
    }
  }

  async restoreProjectBackup(
    backup: ProjectBackup,
    replaceExisting = false,
  ): Promise<void> {
    const transaction = this.database.transaction(
      ['projects', 'taxonomyVersions', 'instructions', 'tasks', 'annotations'],
      'readwrite',
    ) as ProjectTransaction
    try {
      const existing = await transaction
        .objectStore('projects')
        .get(backup.project.id)
      if (existing && !replaceExisting) {
        throw new ProjectRestoreCollisionError(backup.project.id)
      }
      if (existing) {
        await deleteAllByProject(
          transaction,
          'taxonomyVersions',
          backup.project.id,
        )
        await deleteAllByProject(transaction, 'instructions', backup.project.id)
        await deleteAllByProject(transaction, 'tasks', backup.project.id)
        await deleteAllByProject(transaction, 'annotations', backup.project.id)
        await transaction.objectStore('projects').delete(backup.project.id)
      }
      await transaction.objectStore('projects').add(backup.project)
      for (const taxonomy of backup.taxonomyVersions) {
        await transaction.objectStore('taxonomyVersions').add(taxonomy)
      }
      if (backup.instructions) {
        await transaction.objectStore('instructions').add(backup.instructions)
      }
      for (const task of backup.tasks) {
        await transaction.objectStore('tasks').add(task)
      }
      for (const annotation of backup.annotations) {
        await transaction.objectStore('annotations').add(annotation)
      }
      this.beforeRestoreCommit?.()
      await transaction.done
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        /* already aborted */
      }
      await transaction.done.catch(() => undefined)
      if (error instanceof ProjectRestoreCollisionError) throw error
      throw new Error(
        'Project restoration failed; existing project data was not changed.',
        { cause: error },
      )
    }
  }

  async saveAnnotationDraft(
    annotation: AnnotationDocument,
  ): Promise<AnnotationDocument> {
    annotation = normalizeAnnotationCardinality(annotation)
    const transaction = this.database.transaction(
      ['projects', 'tasks', 'annotations'],
      'readwrite',
    )
    const taskStore = transaction.objectStore('tasks')
    const annotationStore = transaction.objectStore('annotations')
    const task = await taskStore.get(annotation.taskId)
    if (!task || task.projectId !== annotation.projectId) {
      throw new Error('Task not found.')
    }
    if (task.status === 'submitted') {
      throw new Error('Reopen this submitted task before editing it.')
    }
    const existing = await annotationStore
      .index('by-task')
      .get(annotation.taskId)
    if (
      existing?.taxonomyVersionId !== undefined &&
      existing.taxonomyVersionId !== annotation.taxonomyVersionId
    ) {
      throw new Error('This draft is pinned to a different taxonomy version.')
    }
    if (existing && annotation.revision < existing.revision) {
      throw new Error('A newer draft revision is already saved.')
    }
    if (
      existing &&
      annotation.revision === existing.revision &&
      JSON.stringify({ ...annotation, updatedAt: existing.updatedAt }) !==
        JSON.stringify(existing)
    ) {
      throw new Error('A conflicting draft revision is already saved.')
    }
    if (existing && annotation.revision === existing.revision) {
      await transaction.done
      return existing
    }
    const timestamp = this.now()
    const project = await transaction
      .objectStore('projects')
      .get(task.projectId)
    if (!project) throw new Error('Project not found.')
    if (
      !existing &&
      project.activeTaxonomyVersionId !== annotation.taxonomyVersionId
    ) {
      throw new Error(
        'The active taxonomy changed before this first draft was saved. Reload the task before editing.',
      )
    }
    const saved = { ...annotation, updatedAt: timestamp }
    await annotationStore.put(saved)
    if (task.status === 'unstarted') {
      await taskStore.put({ ...task, status: 'draft', updatedAt: timestamp })
    }
    await transaction
      .objectStore('projects')
      .put({ ...project, updatedAt: timestamp })
    await transaction.done
    return saved
  }

  async submitAnnotation(
    annotation: AnnotationDocument,
  ): Promise<AnnotationDocument> {
    annotation = normalizeAnnotationCardinality(annotation)
    const transaction = this.database.transaction(
      ['projects', 'tasks', 'annotations'],
      'readwrite',
    )
    const taskStore = transaction.objectStore('tasks')
    const annotationStore = transaction.objectStore('annotations')
    const task = await taskStore.get(annotation.taskId)
    if (!task || task.projectId !== annotation.projectId) {
      throw new Error('Task not found.')
    }
    if (!canTransitionTask(task.status, 'submitted')) {
      throw new Error(`Cannot submit a ${task.status} task.`)
    }
    const existing = await annotationStore
      .index('by-task')
      .get(annotation.taskId)
    if (
      existing &&
      existing.taxonomyVersionId !== annotation.taxonomyVersionId
    ) {
      throw new Error(
        'This annotation is pinned to a different taxonomy version.',
      )
    }
    if (existing && annotation.revision < existing.revision) {
      throw new Error('A newer draft revision is already saved.')
    }
    const timestamp = this.now()
    const project = await transaction
      .objectStore('projects')
      .get(task.projectId)
    if (!project) throw new Error('Project not found.')
    if (
      !existing &&
      project.activeTaxonomyVersionId !== annotation.taxonomyVersionId
    ) {
      throw new Error(
        'The active taxonomy changed before this annotation was submitted. Reload the task before submitting.',
      )
    }
    const submitted: AnnotationDocument = {
      ...annotation,
      revision: Math.max(annotation.revision, existing?.revision ?? 0) + 1,
      updatedAt: timestamp,
      submittedAt: timestamp,
    }
    await annotationStore.put(submitted)
    await taskStore.put({ ...task, status: 'submitted', updatedAt: timestamp })
    await transaction
      .objectStore('projects')
      .put({ ...project, updatedAt: timestamp })
    await transaction.done
    return submitted
  }

  async skipTask(projectId: string, taskId: string): Promise<void> {
    const transaction = this.database.transaction(
      ['projects', 'tasks'],
      'readwrite',
    )
    const task = await transaction.objectStore('tasks').get(taskId)
    if (!task || task.projectId !== projectId) {
      throw new Error('Task not found.')
    }
    if (!canTransitionTask(task.status, 'skipped')) {
      throw new Error(`Cannot skip a ${task.status} task.`)
    }
    const timestamp = this.now()
    await transaction
      .objectStore('tasks')
      .put({ ...task, status: 'skipped', updatedAt: timestamp })
    const project = await transaction.objectStore('projects').get(projectId)
    if (project)
      await transaction
        .objectStore('projects')
        .put({ ...project, updatedAt: timestamp })
    await transaction.done
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
