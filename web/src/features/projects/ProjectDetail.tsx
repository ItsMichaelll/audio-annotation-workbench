import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { CustomSelect } from '../../components/CustomSelect'
import { annotationPath, editProjectPath } from '../../routes'
import { nextActionableTask, orderedTasks } from '../../domain/taskQueue'
import { parseAnnotationTaxonomy } from '../../domain/annotationTaxonomy'
import { permanentlyDeleteProject, updateProjectStatus } from './projectActions'
import {
  deleteProjectTasks,
  importProjectTasks,
  setTaskStatus,
} from './projectActions'
import { formatTimestamp } from './format'
import { MarkdownInstructions } from './MarkdownInstructions'
import { PageNotice, ProjectLayout, ProjectPageState } from './ProjectLayout'
import { useProject } from './projectHooks'
import { TaskImport } from './TaskImport'

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.'
}

export function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const completionMessage = (
    location.state as { completionMessage?: string } | null
  )?.completionMessage
  const state = useProject(projectId)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)

  if (state.loading) {
    return (
      <ProjectLayout>
        <main className="project-page">
          <div className="state-panel" role="status">
            Loading project…
          </div>
        </main>
      </ProjectLayout>
    )
  }
  if (state.error) {
    return (
      <ProjectPageState
        title="Project could not be loaded"
        message={state.error}
      />
    )
  }
  if (!state.data || !projectId) {
    return (
      <ProjectPageState
        title="Project not found"
        message="The requested project does not exist in this browser."
      />
    )
  }

  const {
    project,
    activeTaxonomyVersion,
    taxonomyVersions,
    instructions,
    progress,
    tasks,
  } = state.data

  const visibleTasks = tasks.filter(
    (task) =>
      (statusFilter === 'all' || task.status === statusFilter) &&
      [task.displayName, task.externalId, task.relativePath].some((value) =>
        value?.toLowerCase().includes(query.toLowerCase()),
      ),
  )
  const orderedVisibleTasks = orderedTasks(visibleTasks)
  const pageTasks = orderedVisibleTasks.slice(page * 25, page * 25 + 25)
  const nextTask = nextActionableTask(tasks)
  const pageIds = pageTasks.map((task) => task.id)
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedTasks.includes(id))
  const somePageSelected = pageIds.some((id) => selectedTasks.includes(id))
  let taxonomyError: string | null = null
  try {
    parseAnnotationTaxonomy(activeTaxonomyVersion.document)
  } catch (error) {
    taxonomyError = messageFrom(error)
  }
  const taskAction = async (action: () => Promise<unknown>) => {
    setActing(true)
    setActionError(null)
    try {
      await action()
      setSelectedTasks([])
      state.refresh()
    } catch (error) {
      setActionError(messageFrom(error))
    } finally {
      setActing(false)
    }
  }

  const toggleArchive = async () => {
    setActing(true)
    setActionError(null)
    try {
      await updateProjectStatus(
        project.id,
        project.status === 'active' ? 'archived' : 'active',
      )
      state.refresh()
    } catch (error) {
      setActionError(messageFrom(error))
    } finally {
      setActing(false)
    }
  }

  const deleteProject = async () => {
    if (confirmation !== project.name) return
    setActing(true)
    setActionError(null)
    try {
      await permanentlyDeleteProject(project.id)
      navigate('/projects', { replace: true })
    } catch (error) {
      setActionError(messageFrom(error))
      setActing(false)
      setDeleteOpen(false)
    }
  }

  return (
    <ProjectLayout>
      <main className="project-page detail-page">
        <div className="breadcrumbs">
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span>{project.name}</span>
        </div>

        {project.status === 'archived' && (
          <PageNotice title="Archived project" tone="warning">
            <p>
              This project remains readable and can be restored. No source audio
              is affected by project status.
            </p>
          </PageNotice>
        )}
        {actionError && (
          <PageNotice title="Project action failed" tone="error">
            <p>{actionError}</p>
          </PageNotice>
        )}

        <header className="detail-hero">
          <div>
            <div className="detail-hero__status">
              <span className={`status-badge status-badge--${project.status}`}>
                {project.status}
              </span>
              <span>Taxonomy v{activeTaxonomyVersion.version}</span>
            </div>
            <h1>{project.name}</h1>
            {project.description && <p>{project.description}</p>}
          </div>
          <div className="detail-hero__actions">
            {nextTask && !taxonomyError && project.status === 'active' ? (
              <Link
                className="button-link primary-button"
                to={annotationPath(project.id, nextTask.id)}
              >
                Start Labeling
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title={
                  taxonomyError
                    ? 'Replace the taxonomy before labeling.'
                    : project.status === 'archived'
                      ? 'Restore the project before labeling.'
                      : 'No actionable tasks remain.'
                }
              >
                Start Labeling
              </button>
            )}
            <Link className="button-link" to={editProjectPath(project.id)}>
              Edit project
            </Link>
            <button
              type="button"
              onClick={() => void toggleArchive()}
              disabled={acting}
            >
              {project.status === 'active' ? 'Archive' : 'Restore'}
            </button>
          </div>
        </header>

        {taxonomyError && (
          <PageNotice title="Taxonomy cannot be used for labeling" tone="error">
            <p>{taxonomyError}</p>
            <Link className="button-link" to={editProjectPath(project.id)}>
              Replace taxonomy
            </Link>
          </PageNotice>
        )}
        {completionMessage && (
          <PageNotice title="Task queue updated">
            <p>{completionMessage}</p>
          </PageNotice>
        )}

        <section className="detail-metadata" aria-label="Project dates">
          <div>
            <span>Created</span>
            <strong>{formatTimestamp(project.createdAt)}</strong>
          </div>
          <div>
            <span>Last updated</span>
            <strong>{formatTimestamp(project.updatedAt)}</strong>
          </div>
          <div>
            <span>Project ID</span>
            <strong>{project.id}</strong>
          </div>
        </section>

        <div className="detail-grid">
          <section className="detail-section detail-section--wide">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Task manager</p>
                <h2>Audio tasks</h2>
              </div>
              <span className="count-badge">{progress.total}</span>
            </div>
            <p className="task-progress-summary">
              {progress.submitted} submitted of {progress.total} tasks ·{' '}
              {progress.unstarted} unstarted · {progress.blocked} blocked
            </p>
            <TaskImport
              existing={tasks}
              onReady={(candidates) =>
                void taskAction(() =>
                  importProjectTasks(project.id, candidates),
                )
              }
            />
            {tasks.length === 0 ? (
              <div className="task-empty-state">
                <h3>No tasks imported</h3>
                <p>
                  Add audio files or a JSON/JSONL manifest. Manifest-only tasks
                  remain unresolved until linked.
                </p>
              </div>
            ) : (
              <>
                <div
                  className="task-controls"
                  aria-label="Task filters and bulk actions"
                >
                  <div className="task-controls__filters">
                    <input
                      aria-label="Search tasks"
                      value={query}
                      placeholder="Search name, ID, or path"
                      onChange={(event) => {
                        setQuery(event.target.value)
                        setPage(0)
                      }}
                    />
                    <CustomSelect
                      ariaLabel="Filter task status"
                      value={statusFilter}
                      options={[
                        { value: 'all', label: 'All statuses' },
                        ...[
                          'unstarted',
                          'draft',
                          'submitted',
                          'skipped',
                          'blocked',
                          'reopened',
                        ].map((status) => ({ value: status, label: status })),
                      ]}
                      onChange={(value) => {
                        setStatusFilter(value)
                        setPage(0)
                      }}
                    />
                  </div>
                  <div className="task-controls__actions">
                    <button
                      type="button"
                      disabled={!selectedTasks.length || acting}
                      onClick={() =>
                        void taskAction(() =>
                          setTaskStatus(project.id, selectedTasks, 'skipped'),
                        )
                      }
                    >
                      Skip selected
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={!selectedTasks.length || acting}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${selectedTasks.length} task(s)?`,
                          )
                        )
                          void taskAction(() =>
                            deleteProjectTasks(project.id, selectedTasks),
                          )
                      }}
                    >
                      Delete selected
                    </button>
                  </div>
                </div>
                <div
                  className="task-table"
                  role="table"
                  aria-label="Project tasks"
                >
                  <div
                    className="task-table__row task-table__header"
                    role="row"
                  >
                    <span>
                      <input
                        type="checkbox"
                        aria-label="Select all tasks on this page"
                        checked={allPageSelected}
                        disabled={pageIds.length === 0}
                        ref={(input) => {
                          if (input)
                            input.indeterminate =
                              somePageSelected && !allPageSelected
                        }}
                        onChange={() =>
                          setSelectedTasks((ids) =>
                            allPageSelected
                              ? ids.filter((id) => !pageIds.includes(id))
                              : [...new Set([...ids, ...pageIds])],
                          )
                        }
                      />
                    </span>
                    <span>Name / source</span>
                    <span>External ID</span>
                    <span>Status</span>
                    <span>Availability</span>
                    <span>Updated</span>
                    <span>Action</span>
                  </div>
                  {pageTasks.map((task) => {
                    const name =
                      task.displayName ?? task.primaryMedia.displayName
                    return (
                      <div className="task-table__row" role="row" key={task.id}>
                        <span>
                          <input
                            aria-label={`Select ${name}`}
                            type="checkbox"
                            checked={selectedTasks.includes(task.id)}
                            onChange={() =>
                              setSelectedTasks((ids) =>
                                ids.includes(task.id)
                                  ? ids.filter((id) => id !== task.id)
                                  : [...ids, task.id],
                              )
                            }
                          />
                        </span>
                        <span>
                          <strong>{name}</strong>
                          <small>
                            {task.relativePath ?? task.primaryMedia.displayName}
                          </small>
                        </span>
                        <span>{task.externalId ?? '—'}</span>
                        <span>{task.status}</span>
                        <span>
                          {task.primaryMedia.kind === 'unresolved'
                            ? 'Missing/unresolved'
                            : task.primaryMedia.kind === 'external-reference'
                              ? 'Session-only'
                              : 'Available'}
                        </span>
                        <span>{formatTimestamp(task.updatedAt)}</span>
                        <span className="task-table__action">
                          {((project.status === 'active' &&
                            (task.status === 'unstarted' ||
                              task.status === 'draft' ||
                              task.status === 'reopened')) ||
                            task.status === 'submitted') && (
                            <Link
                              className="button-link button-link--compact"
                              to={annotationPath(project.id, task.id)}
                            >
                              {task.status === 'submitted'
                                ? 'View'
                                : task.status === 'unstarted'
                                  ? 'Label'
                                  : 'Continue'}
                            </Link>
                          )}
                          {(task.status === 'skipped' ||
                            task.status === 'blocked') && (
                            <button
                              type="button"
                              className="button-link button-link--compact"
                              disabled={acting}
                              onClick={() =>
                                void taskAction(() =>
                                  setTaskStatus(
                                    project.id,
                                    [task.id],
                                    'unstarted',
                                  ),
                                )
                              }
                            >
                              Restore
                            </button>
                          )}
                          {task.status === 'submitted' && (
                            <button
                              type="button"
                              disabled={acting}
                              onClick={() =>
                                void taskAction(() =>
                                  setTaskStatus(
                                    project.id,
                                    [task.id],
                                    'reopened',
                                  ),
                                )
                              }
                            >
                              Reopen
                            </button>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="task-pagination">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    {page + 1} /{' '}
                    {Math.max(1, Math.ceil(orderedVisibleTasks.length / 25))}
                  </span>
                  <button
                    type="button"
                    disabled={(page + 1) * 25 >= orderedVisibleTasks.length}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="detail-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Active definition</p>
                <h2>Taxonomy</h2>
              </div>
              <span className="count-badge">
                v{activeTaxonomyVersion.version}
              </span>
            </div>
            <dl className="definition-list">
              <div>
                <dt>Source</dt>
                <dd>{activeTaxonomyVersion.sourceFilename}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{activeTaxonomyVersion.sourceFormat.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Taxonomy name</dt>
                <dd>
                  {activeTaxonomyVersion.metadata.name ?? 'Not specified'}
                </dd>
              </div>
              <div>
                <dt>Schema version</dt>
                <dd>
                  {activeTaxonomyVersion.taxonomySchemaVersion ??
                    'Not specified'}
                </dd>
              </div>
              <div>
                <dt>Content hash</dt>
                <dd className="hash-value">
                  {activeTaxonomyVersion.contentHash}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="detail-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Immutable history</p>
              <h2>Taxonomy versions</h2>
            </div>
            <span className="count-badge">{taxonomyVersions.length}</span>
          </div>
          <div
            className="history-table"
            role="table"
            aria-label="Taxonomy history"
          >
            <div
              className="history-table__row history-table__header"
              role="row"
            >
              <span role="columnheader">Version</span>
              <span role="columnheader">Source</span>
              <span role="columnheader">Created</span>
              <span role="columnheader">State</span>
            </div>
            {taxonomyVersions.map((taxonomy) => (
              <div className="history-table__row" role="row" key={taxonomy.id}>
                <strong role="cell">v{taxonomy.version}</strong>
                <span role="cell">{taxonomy.sourceFilename}</span>
                <span role="cell">{formatTimestamp(taxonomy.createdAt)}</span>
                <span role="cell">
                  {taxonomy.id === project.activeTaxonomyVersionId
                    ? 'Active'
                    : 'Historical'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reference</p>
              <h2>Annotation instructions</h2>
            </div>
            {instructions && <span>{instructions.sourceFilename}</span>}
          </div>
          {instructions ? (
            <MarkdownInstructions markdown={instructions.rawMarkdown} />
          ) : (
            <p className="muted-copy">No instructions have been added.</p>
          )}
        </section>

        <section className="danger-zone">
          <div>
            <h2>Delete project</h2>
            <p>
              Deletes project metadata, taxonomy history, instructions, and task
              records from this browser. Source audio is never deleted.
            </p>
          </div>
          <button
            className="danger-button"
            type="button"
            onClick={() => setDeleteOpen(true)}
          >
            Delete project
          </button>
        </section>
      </main>

      {deleteOpen && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Permanently delete {project.name}?</h2>
            <p>
              This cannot be undone without a future project backup. Source
              audio files remain untouched.
            </p>
            <label className="field">
              <span>Type the project name to confirm</span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoFocus
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={acting}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={confirmation !== project.name || acting}
                onClick={() => void deleteProject()}
              >
                {acting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProjectLayout>
  )
}
