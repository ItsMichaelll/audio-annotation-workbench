import type { ProjectStatus } from '../../domain/models'
import type {
  PreparedInstructions,
  PreparedTaxonomy,
} from '../../domain/uploads'
import { getProjectRepository } from '../../storage/projectRepository'

export interface ProjectFormValues {
  name: string
  description?: string
  taxonomy: PreparedTaxonomy
  instructions?: PreparedInstructions
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
