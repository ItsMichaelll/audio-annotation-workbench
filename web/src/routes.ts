export const APP_ROUTES = {
  dashboard: '/',
  projects: '/projects',
  newProject: '/projects/new',
  project: '/projects/:projectId',
  editProject: '/projects/:projectId/edit',
  editor: '/editor',
} as const

export function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`
}

export function editProjectPath(projectId: string): string {
  return `${projectPath(projectId)}/edit`
}
