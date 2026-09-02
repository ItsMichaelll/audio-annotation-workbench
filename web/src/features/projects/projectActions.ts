import type { ProjectStatus } from '../../domain/models'
import type { ImportCandidate } from '../../domain/taskIngestion'
import type {
  PreparedInstructions,
  PreparedTaxonomy,
} from '../../domain/uploads'
import {
  getProjectRepository,
  ProjectRestoreCollisionError,
} from '../../storage/projectRepository'
import type { ProjectBackup } from '../../domain/projectBackup'

export interface ProjectFormValues {
  name: string
  description?: string
  taxonomy: PreparedTaxonomy
  instructions?: PreparedInstructions
  tasks?: ImportCandidate[]
}

export async function createProject(values: ProjectFormValues) {
  return (await getProjectRepository()).createProject(values)
}

export async function updateProjectDetails(
  projectId: string,
  name: string,
  description?: string,
) {
  const input = {
    name,
    ...(description ? { description } : {}),
  }
  return (await getProjectRepository()).updateProject(projectId, input)
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
) {
  return (await getProjectRepository()).setProjectStatus(projectId, status)
}

export async function addProjectTaxonomy(
  projectId: string,
  taxonomy: PreparedTaxonomy,
) {
  return (await getProjectRepository()).addTaxonomyVersion(projectId, taxonomy)
}

export async function setProjectInstructions(
  projectId: string,
  instructions: PreparedInstructions,
) {
  return (await getProjectRepository()).replaceInstructions(
    projectId,
    instructions,
  )
}

export async function clearProjectInstructions(projectId: string) {
  return (await getProjectRepository()).removeInstructions(projectId)
}

export async function permanentlyDeleteProject(projectId: string) {
  return (await getProjectRepository()).deleteProject(projectId)
}

export async function importProjectTasks(
  projectId: string,
  tasks: ImportCandidate[],
) {
  return (await getProjectRepository()).importTasks(projectId, tasks)
}

export async function setTaskStatus(
  projectId: string,
  taskIds: string[],
  status:
    'unstarted' | 'draft' | 'submitted' | 'skipped' | 'blocked' | 'reopened',
) {
  return (await getProjectRepository()).updateTaskStatus(
    projectId,
    taskIds,
    status,
  )
}

export async function deleteProjectTasks(projectId: string, taskIds: string[]) {
  return (await getProjectRepository()).deleteTasks(projectId, taskIds)
}

export async function loadProjectBackupRecords(projectId: string) {
  return (await getProjectRepository()).getProjectBackupRecords(projectId)
}

export async function restoreProjectBackup(
  backup: ProjectBackup,
  replaceExisting = false,
) {
  return (await getProjectRepository()).restoreProjectBackup(
    backup,
    replaceExisting,
  )
}

export function isProjectRestoreCollision(
  error: unknown,
): error is ProjectRestoreCollisionError {
  return error instanceof ProjectRestoreCollisionError
}
