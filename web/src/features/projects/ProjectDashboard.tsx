import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { ProjectStatus } from '../../domain/models'
import {
  requestPersistentStorage,
  storageDurability,
  type StorageDurability,
} from '../../storage/persistence'
import { formatTimestamp, truncateDescription } from './format'
import { PageNotice, ProjectLayout } from './ProjectLayout'
import { useProjectList } from './projectHooks'

function progressLabel(total: number, completed: number): string {
  if (total === 0) return '0 tasks'
  return `${completed} of ${total} complete`
}

export function ProjectDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status: ProjectStatus =
    searchParams.get('view') === 'archived' ? 'archived' : 'active'
  const projects = useProjectList(status)
  const [durability, setDurability] = useState<StorageDurability | null>(null)
  const [requestingStorage, setRequestingStorage] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void storageDurability()
      .then((value) => {
        if (current) setDurability(value)
      })
      .catch(() => {
        if (current) setDurability('best-effort')
      })
    return () => {
      current = false
    }
  }, [])

  const requestDurability = async () => {
    setRequestingStorage(true)
    setStorageError(null)
    try {
      const result = await requestPersistentStorage()
      setDurability(result)
      if (result !== 'persistent')
        setStorageError('Unable to grant persistent storage.')
    } catch {
      setStorageError('Unable to grant persistent storage.')
    } finally {
      setRequestingStorage(false)
    }
  }

  return (
    <ProjectLayout
      actions={
        <>
          <Link className="button-link" to="/editor">
            Standalone editor
          </Link>
          <Link className="button-link" to="/projects/restore">
            Restore backup
          </Link>
          <Link className="button-link button-link--primary" to="/projects/new">
            New Project
          </Link>
        </>
      }
    >
      <main className="project-page dashboard-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Project library</p>
            <h1>Projects</h1>
            <p>View and manage your projects.</p>
          </div>
          <div className="segmented-control" aria-label="Project status filter">
            <button
              type="button"
              aria-pressed={status === 'active'}
              onClick={() => setSearchParams({})}
            >
              Active
            </button>
            <button
              type="button"
              aria-pressed={status === 'archived'}
              onClick={() => setSearchParams({ view: 'archived' })}
            >
              Archived
            </button>
          </div>
        </div>

        {durability && (
          <p className="storage-state">
            Project storage:{' '}
            {durability === 'persistent'
              ? 'durable browser storage granted'
              : durability === 'unsupported'
                ? 'durability status unavailable in this browser'
                : 'best-effort browser storage'}
          </p>
        )}

        {durability === 'best-effort' && (
          <PageNotice title="Browser storage is not guaranteed" tone="warning">
            <p>
              This browser may evict local project data under storage pressure.
              Browser persistence is not a substitute for downloading project
              backups regularly.
            </p>
            <div className="storage-request-action">
              <button
                type="button"
                onClick={() => void requestDurability()}
                disabled={requestingStorage}
              >
                {requestingStorage ? 'Requesting…' : 'Request durable storage'}
              </button>
              {storageError && (
                <span className="storage-request-error" role="alert">
                  {storageError}
                </span>
              )}
            </div>
          </PageNotice>
        )}

        {projects.error && (
          <PageNotice title="Projects could not be loaded" tone="error">
            <p>{projects.error}</p>
            <button type="button" onClick={projects.refresh}>
              Try again
            </button>
          </PageNotice>
        )}

        {projects.loading ? null : projects.data.length === 0 &&
          !projects.error ? (
          <div className="state-panel state-panel--empty">
            <h2>
              {status === 'active'
                ? 'Create a project to get started'
                : 'No archived projects'}
            </h2>
            <p>
              {status === 'active'
                ? 'Create a project or restore a validated backup to continue a local-first annotation workflow.'
                : 'Archived projects remain available here and can be restored at any time.'}
            </p>
            {status === 'active' && (
              <Link
                className="button-link button-link--primary"
                to="/projects/new"
              >
                New Project
              </Link>
            )}
          </div>
        ) : (
          <section className="project-grid" aria-label={`${status} projects`}>
            {projects.data.map(
              ({ project, activeTaxonomyVersion, progress }) => (
                <article className="project-card" key={project.id}>
                  <div className="project-card__header">
                    <span
                      className={`status-badge status-badge--${project.status}`}
                    >
                      {project.status}
                    </span>
                    <span>Taxonomy v{activeTaxonomyVersion.version}</span>
                  </div>
                  <h2>{project.name}</h2>
                  <p className="project-card__description">
                    {project.description
                      ? truncateDescription(project.description)
                      : 'No description provided.'}
                  </p>
                  <dl className="project-card__metadata">
                    <div>
                      <dt>Progress</dt>
                      <dd>
                        {progressLabel(progress.total, progress.completed)}
                      </dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatTimestamp(project.updatedAt)}</dd>
                    </div>
                  </dl>
                  <Link
                    className="project-card__open"
                    to={`/projects/${project.id}`}
                  >
                    Open project <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ),
            )}
          </section>
        )}
      </main>
    </ProjectLayout>
  )
}
