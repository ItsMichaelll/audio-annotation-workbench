import { useEffect, useState } from 'react'
import type {
  ProjectAggregate,
  ProjectStatus,
  ProjectSummary,
} from '../../domain/models'
import { getProjectRepository } from '../../storage/projectRepository'

interface QueryState<T> {
  data: T
  loading: boolean
  error: string | null
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.'
}

export function useProjectList(status: ProjectStatus) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<QueryState<ProjectSummary[]>>({
    data: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let current = true
    void getProjectRepository()
      .then((repository) => repository.listProjects(status))
      .then((projects) => {
        if (current) setState({ data: projects, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (current) {
          setState({ data: [], loading: false, error: errorMessage(error) })
        }
      })
    return () => {
      current = false
    }
  }, [revision, status])

  return { ...state, refresh: () => setRevision((value) => value + 1) }
}

export function useProject(projectId: string | undefined) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<QueryState<ProjectAggregate | null>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let current = true
    if (!projectId) {
      return () => {
        current = false
      }
    }
    void getProjectRepository()
      .then((repository) => repository.getProject(projectId))
      .then((project) => {
        if (current) setState({ data: project, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (current) {
          setState({ data: null, loading: false, error: errorMessage(error) })
        }
      })
    return () => {
      current = false
    }
  }, [projectId, revision])

  return { ...state, refresh: () => setRevision((value) => value + 1) }
}
