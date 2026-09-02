import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { ConfirmationProvider } from './components/ConfirmationDialog'

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
const ProjectRestore = lazy(() =>
  import('./features/projects/ProjectRestore').then((module) => ({
    default: module.ProjectRestore,
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
const ProjectTaxonomyEditor = lazy(() =>
  import('./features/projects/ProjectTaxonomyEditor').then((module) => ({
    default: module.ProjectTaxonomyEditor,
  })),
)
const ProjectInstructionsEditor = lazy(() =>
  import('./features/projects/ProjectInstructionsEditor').then((module) => ({
    default: module.ProjectInstructionsEditor,
  })),
)
const ProjectPageState = lazy(() =>
  import('./features/projects/ProjectLayout').then((module) => ({
    default: module.ProjectPageState,
  })),
)
const AnnotationWorkspace = lazy(() =>
  import('./features/annotation/AnnotationWorkspace').then((module) => ({
    default: module.AnnotationWorkspace,
  })),
)

export function RouterApplication() {
  return (
    <BrowserRouter>
      <ConfirmationProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route index element={<ProjectDashboard />} />
            <Route path="projects" element={<ProjectDashboard />} />
            <Route path="projects/new" element={<ProjectCreate />} />
            <Route path="projects/restore" element={<ProjectRestore />} />
            <Route path="projects/:projectId" element={<ProjectDetail />} />
            <Route path="projects/:projectId/edit" element={<ProjectEdit />} />
            <Route
              path="projects/:projectId/taxonomy"
              element={<ProjectTaxonomyEditor />}
            />
            <Route
              path="projects/:projectId/instructions"
              element={<ProjectInstructionsEditor />}
            />
            <Route
              path="projects/:projectId/tasks/:taskId/annotate"
              element={<AnnotationWorkspace />}
            />
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
      </ConfirmationProvider>
    </BrowserRouter>
  )
}
