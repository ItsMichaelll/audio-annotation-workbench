export const APP_ROUTES = {
  dashboard: '/',
  projects: '/projects',
  newProject: '/projects/new',
  project: '/projects/:projectId',
  editProject: '/projects/:projectId/edit',
  editor: '/editor',
  annotation: '/projects/:projectId/tasks/:taskId/annotate',
} as const

export function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`
}

export function annotationPath(projectId: string, taskId: string): string {
  return `${projectPath(projectId)}/tasks/${encodeURIComponent(taskId)}/annotate`
}

export function editProjectPath(projectId: string): string {
  return `${projectPath(projectId)}/edit`
}
