import { matchRoutes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { annotationPath, APP_ROUTES } from './routes'

const routePatterns = Object.entries(APP_ROUTES).map(([id, path]) => ({
  id,
  path,
}))

describe('application routes', () => {
  it.each([
    ['/', 'dashboard'],
    ['/projects', 'projects'],
    ['/projects/new', 'newProject'],
    ['/projects/project-123', 'project'],
    ['/projects/project-123/edit', 'editProject'],
    ['/projects/project-123/tasks/task-456/annotate', 'annotation'],
    ['/editor', 'editor'],
  ])('matches %s as %s', (pathname, routeId) => {
    expect(matchRoutes(routePatterns, pathname)?.at(-1)?.route.id).toBe(routeId)
  })

  it('builds encoded annotation paths', () => {
    expect(annotationPath('project one', 'task/two')).toBe(
      '/projects/project%20one/tasks/task%2Ftwo/annotate',
    )
  })

  it('does not misclassify an unknown route', () => {
    expect(matchRoutes(routePatterns, '/unknown/path')).toBeNull()
  })
})
