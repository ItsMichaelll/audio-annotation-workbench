import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { CustomSelect } from '../../components/CustomSelect'
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
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('updated')
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

  const shown = [...projects.data]
    .filter(({ project }) =>
      `${project.name} ${project.description ?? ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.project.name.localeCompare(b.project.name)
        : b.project.updatedAt.localeCompare(a.project.updatedAt),
    )
  const totalTasks = projects.data.reduce(
    (sum, item) => sum + item.progress.total,
    0,
  )
  const submitted = projects.data.reduce(
    (sum, item) => sum + item.progress.submitted,
    0,
  )

  return (
    <ProjectLayout theme="light">
      <main className={layoutStyles.page}>
        <header className={styles.heading}>
          <div>
            <p className={layoutStyles.eyebrow}>Your workspace</p>
            <h1 className={layoutStyles.pageHeadingTitle}>Projects</h1>
            <p className={layoutStyles.pageHeadingDescription}>
              Easily browse, organize, and track your projects.
            </p>
          </div>
          <div className={styles.headingActions}>
            <ButtonLink to="/projects/restore">
              <Icon name="upload" />
              Restore Backup
            </ButtonLink>
            <ButtonLink variant="primary" to="/projects/new">
              <Icon name="plus" />
              New Project
            </ButtonLink>
          </div>
        </header>

        <div className={styles.overview} aria-label="Library summary">
          <span>
            <strong>{projects.data.length}</strong> {status} projects
          </span>
          <span>
            <strong>{totalTasks}</strong> audio tasks
          </span>
          <span>
            <strong>{submitted}</strong> submitted
          </span>
        </div>

        <section
          className={styles.library}
          aria-label={`${status} projects`}
          aria-busy={projects.loading}
        >
          <div className={styles.toolbar}>
            <div
              className={styles.segmentedControl}
              role="group"
              aria-label="Project status filter"
            >
              <button
                type="button"
                aria-pressed={status === 'active'}
                onClick={() => {
                  setSearchParams({})
                  setQuery('')
                }}
              >
                Active
              </button>
              <button
                type="button"
                aria-pressed={status === 'archived'}
                onClick={() => {
                  setSearchParams({ view: 'archived' })
                  setQuery('')
                }}
              >
                Archived
              </button>
            </div>
            <label className={styles.search}>
              <Icon name="search" />
              <input
                aria-label="Search projects"
                placeholder="Find a project…"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <CustomSelect
              ariaLabel="Sort projects"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'updated', label: 'Recently updated' },
                { value: 'name', label: 'Project name' },
              ]}
            />
          </div>
          {projects.error && (
            <PageNotice title="Projects could not be loaded" tone="error">
              <p>{projects.error}</p>
              <Button type="button" onClick={projects.refresh}>
                Try again
              </Button>
            </PageNotice>
          )}
          {projects.loading ? (
            <div className={styles.empty} role="status">
              Loading projects…
            </div>
          ) : !projects.error && shown.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <Icon name={query ? 'search' : 'folder'} size={32} />
              </span>
              <h2>
                {query
                  ? 'No matching projects'
                  : status === 'active'
                    ? 'No projects found.'
                    : 'Your project archive is empty.'}
              </h2>
              <p>
                {query
                  ? 'Try another project name or description.'
                  : status === 'active'
                    ? 'Bring your audio, labels, and listening guide together. Create a project to get started.'
                    : 'Archived projects will appear here. You can restore them at any time.'}
              </p>
              {query ? (
                <Button onClick={() => setQuery('')}>Clear search</Button>
              ) : status === 'active' ? (
                <ButtonLink variant="primary" to="/projects/new">
                  Create your first project <Icon name="arrow" />
                </ButtonLink>
              ) : (
                <Button onClick={() => setSearchParams({})}>
                  View active projects
                </Button>
              )}
            </div>
          ) : (
            <div>
              <div className={styles.columns} aria-hidden="true">
                <span>Project</span>
                <span>Progress</span>
                <span>Last updated</span>
                <span />
              </div>
              {shown.map(({ project, activeTaxonomyVersion, progress }) => (
                <article className={styles.projectRow} key={project.id}>
                  <div className={styles.projectIdentity}>
                    <span className={styles.projectIcon}>
                      <Icon name="folder" size={21} />
                    </span>
                    <div>
                      <div className={styles.projectMeta}>
                        <span
                          className={`${statusStyles.badge} ${status === 'archived' ? statusStyles.archived : ''}`}
                        >
                          {project.status}
                        </span>
                        <span>Taxonomy v{activeTaxonomyVersion.version}</span>
                      </div>
                      <h2>
                        <Link to={`/projects/${project.id}`}>
                          {project.name}
                        </Link>
                      </h2>
                      <p>
                        {project.description
                          ? truncateDescription(project.description)
                          : 'No description provided.'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={styles.progress}
                    title={`${progress.submitted} submitted · ${progress.skipped} skipped`}
                  >
                    <span>
                      {progressLabel(progress.total, progress.completed)}
                    </span>
                    <progress
                      aria-label={`${project.name} task completion`}
                      value={progress.completed}
                      max={Math.max(progress.total, 1)}
                    />
                  </div>
                  <time className={styles.updated} dateTime={project.updatedAt}>
                    {formatTimestamp(project.updatedAt)}
                  </time>
                  <Icon name="arrow" />
                </article>
              ))}
              {shown.length > 0 && (
                <p className={styles.listFoot}>
                  {shown.length} of {projects.data.length} projects
                </p>
              )}
            </div>
          )}
        </section>
        {durability && (
          <details className={styles.storage}>
            <summary>
              <Icon name="info" />
              <span>
                {durability === 'persistent'
                  ? 'Persistent storage enabled'
                  : 'Your projects are stored in this browser'}
                <small>
                  {durability === 'persistent'
                    ? 'Keep regular backups of your work.'
                    : 'Keep a backup. Browser storage can be cleared.'}
                </small>
              </span>
            </summary>
            <div className={styles.storageBody}>
              <p>
                {durability === 'persistent'
                  ? 'This browser has granted durable storage. Download project backups regularly to keep an independent copy.'
                  : durability === 'unsupported'
                    ? 'Storage durability status is unavailable in this browser. Download project backups regularly.'
                    : 'This browser may evict local project data under storage pressure. Request durable storage and download backups regularly.'}
              </p>
              {durability === 'best-effort' && (
                <Button
                  type="button"
                  onClick={() => void requestDurability()}
                  disabled={requestingStorage}
                >
                  {requestingStorage
                    ? 'Requesting…'
                    : 'Request durable storage'}
                </Button>
              )}
              {storageError && (
                <p className={styles.storageError} role="alert">
                  {storageError}
                </p>
              )}
            </div>
          </details>
        )}
      </main>
    </ProjectLayout>
  )
}
