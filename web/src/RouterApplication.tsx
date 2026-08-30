import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

const StandaloneEditor = lazy(() =>
  import('./App').then((module) => ({ default: module.StandaloneEditor })),
)
const ProjectDashboard = lazy(() =>
  import('./features/projects/ProjectDashboard').then((module) => ({
    default: module.ProjectDashboard,
  })),
)
const ProjectCreate = lazy(() =>
  import('./features/projects/ProjectCreate').then((module) => ({
    default: module.ProjectCreate,
  })),
)
const ProjectDetail = lazy(() =>
  import('./features/projects/ProjectDetail').then((module) => ({
    default: module.ProjectDetail,
  })),
)
const ProjectEdit = lazy(() =>
  import('./features/projects/ProjectEdit').then((module) => ({
    default: module.ProjectEdit,
  })),
)
const ProjectPageState = lazy(() =>
  import('./features/projects/ProjectLayout').then((module) => ({
    default: module.ProjectPageState,
  })),
)

export function RouterApplication() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="route-loading" role="status">
            Loading application…
          </div>
        }
      >
        <Routes>
          <Route index element={<ProjectDashboard />} />
          <Route path="projects" element={<ProjectDashboard />} />
          <Route path="projects/new" element={<ProjectCreate />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="projects/:projectId/edit" element={<ProjectEdit />} />
          <Route path="editor" element={<StandaloneEditor />} />
          <Route
            path="404"
            element={
              <ProjectPageState
                title="Page not found"
                message="The requested page does not exist."
              />
            }
          />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
