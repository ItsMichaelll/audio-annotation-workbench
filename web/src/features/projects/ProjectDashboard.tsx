import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import type { ProjectStatus } from '../../domain/models'
import {
  requestPersistentStorage,
  storageDurability,
  type StorageDurability,
} from '../../storage/persistence'
import { formatTimestamp, truncateDescription } from './format'
import { PageNotice, ProjectLayout } from './ProjectLayout'
import layoutStyles from './ProjectLayout.module.css'
import styles from './ProjectDashboard.module.css'
import { useProjectList } from './projectHooks'
import statusStyles from './ProjectStatus.module.css'

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
          <ButtonLink to="/editor">Standalone editor</ButtonLink>
          <ButtonLink to="/projects/restore">Restore backup</ButtonLink>
          <ButtonLink variant="primary" to="/projects/new">
            New Project
          </ButtonLink>
        </>
      }
    >
      <main className={layoutStyles.page}>
        <div className={layoutStyles.pageHeading}>
          <div>
            <p className={layoutStyles.eyebrow}>Project library</p>
            <h1 className={layoutStyles.pageHeadingTitle}>Projects</h1>
            <p className={layoutStyles.pageHeadingDescription}>
              View and manage your projects.
            </p>
          </div>
          <div
            className={styles.segmentedControl}
            aria-label="Project status filter"
          >
            <Button
              className={styles.segment}
              type="button"
              aria-pressed={status === 'active'}
              onClick={() => setSearchParams({})}
            >
              Active
            </Button>
            <Button
              className={styles.segment}
              type="button"
              aria-pressed={status === 'archived'}
              onClick={() => setSearchParams({ view: 'archived' })}
            >
              Archived
            </Button>
          </div>
        </div>

        {durability && (
          <p className={styles.storageState}>
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
            <div className={styles.storageRequestAction}>
              <Button
                type="button"
                onClick={() => void requestDurability()}
                disabled={requestingStorage}
              >
                {requestingStorage ? 'Requesting…' : 'Request durable storage'}
              </Button>
              {storageError && (
                <span className={styles.storageRequestError} role="alert">
                  {storageError}
                </span>
              )}
            </div>
          </PageNotice>
        )}

        {projects.error && (
          <PageNotice title="Projects could not be loaded" tone="error">
            <p>{projects.error}</p>
            <Button type="button" onClick={projects.refresh}>
              Try again
            </Button>
          </PageNotice>
        )}

        {projects.loading ? null : projects.data.length === 0 &&
          !projects.error ? (
          <div className={`${layoutStyles.statePanel} ${styles.statePanel}`}>
            <h2 className={layoutStyles.statePanelTitle}>
              {status === 'active'
                ? 'Create a project to get started'
                : 'No archived projects'}
            </h2>
            <p
              className={`${layoutStyles.statePanelDescription} ${styles.statePanelDescription}`}
            >
              {status === 'active'
                ? 'Create a project or restore a validated backup to continue a local-first annotation workflow.'
                : 'Archived projects remain available here and can be restored at any time.'}
            </p>
            {status === 'active' && (
              <ButtonLink variant="primary" to="/projects/new">
                New Project
              </ButtonLink>
            )}
          </div>
        ) : (
          <section
            className={styles.projectGrid}
            aria-label={`${status} projects`}
          >
            {projects.data.map(
              ({ project, activeTaxonomyVersion, progress }) => (
                <article className={styles.card} key={project.id}>
                  <div className={styles.cardHeader}>
                    <span
                      className={`${statusStyles.badge} ${
                        project.status === 'archived'
                          ? statusStyles.archived
                          : ''
                      }`}
                    >
                      {project.status}
                    </span>
                    <span>Taxonomy v{activeTaxonomyVersion.version}</span>
                  </div>
                  <h2 className={styles.cardTitle}>{project.name}</h2>
                  <p className={styles.cardDescription}>
                    {project.description
                      ? truncateDescription(project.description)
                      : 'No description provided.'}
                  </p>
                  <dl className={styles.cardMetadata}>
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
                    className={styles.cardOpen}
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
