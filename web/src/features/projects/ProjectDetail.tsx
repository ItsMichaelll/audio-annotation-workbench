import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { useConfirmation } from '../../components/confirmationContext'
import { CustomSelect } from '../../components/CustomSelect'
import {
  Modal,
  ModalActions,
  ModalDescription,
  ModalTitle,
} from '../../components/Modal'
import {
  annotationPath,
  editProjectPath,
  instructionsEditorPath,
  taxonomyEditorPath,
} from '../../routes'
import { nextActionableTask, orderedTasks } from '../../domain/taskQueue'
import { parseAnnotationTaxonomy } from '../../domain/annotationTaxonomy'
import {
  deleteProjectTasks,
  importProjectTasks,
  permanentlyDeleteProject,
  setTaskStatus,
  updateProjectStatus,
} from './projectActions'
import { formatTimestamp } from './format'
import { MarkdownInstructions } from './MarkdownInstructions'
import { PageNotice, ProjectLayout, ProjectPageState } from './ProjectLayout'
import { useProject } from './projectHooks'
import { TaskImport } from './TaskImport'
import { ProjectDataPortability } from './ProjectDataPortability'

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.'
}

export function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirmation()
  const deleteProjectTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteProjectInputRef = useRef<HTMLInputElement>(null)
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
    return <ProjectLayout>{null}</ProjectLayout>
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

  let activeTaxonomy: ReturnType<typeof parseAnnotationTaxonomy> | null = null
  let taxonomyError: string | null = null

  try {
    activeTaxonomy = parseAnnotationTaxonomy(activeTaxonomyVersion.document)
  } catch (error) {
    taxonomyError = messageFrom(error)
  }

  const regionLabels =
    activeTaxonomy?.labels.filter((label) => label.scopes.includes('region')) ??
    []
  const clipLabels =
    activeTaxonomy?.labels.filter((label) => label.scopes.includes('clip')) ??
    []
  const scaleCount = Object.keys(activeTaxonomy?.scales ?? {}).length

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

  const closeDeleteProject = () => {
    if (acting) return
    setDeleteOpen(false)
    setConfirmation('')
  }

  const deleteSelectedTasks = async () => {
    const taskIds = [...selectedTasks]
    const count = taskIds.length
    if (!count || acting) return
    const accepted = await confirm({
      title: `Delete ${count} ${count === 1 ? 'task' : 'tasks'}?`,
      message:
        'This removes the selected task records and their annotations from this browser.',
      confirmLabel: `Delete ${count}`,
      tone: 'danger',
    })
    if (accepted) {
      await taskAction(() => deleteProjectTasks(project.id, taskIds))
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
              <ButtonLink
                variant="primary"
                to={annotationPath(project.id, nextTask.id)}
              >
                Start Labeling
              </ButtonLink>
            ) : (
              <Button
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
              </Button>
            )}
            <ButtonLink to={editProjectPath(project.id)}>
              Edit project
            </ButtonLink>
            <Button
              type="button"
              onClick={() => void toggleArchive()}
              disabled={acting}
            >
              {project.status === 'active' ? 'Archive' : 'Restore'}
            </Button>
          </div>
        </header>

        {taxonomyError && (
          <PageNotice title="Taxonomy cannot be used for labeling" tone="error">
            <p>{taxonomyError}</p>
            <ButtonLink to={taxonomyEditorPath(project.id)}>
              Edit taxonomy
            </ButtonLink>
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
                      variant="taskFilter"
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
                    <Button
                      size="square"
                      type="button"
                      disabled={!selectedTasks.length || acting}
                      onClick={() =>
                        void taskAction(() =>
                          setTaskStatus(project.id, selectedTasks, 'skipped'),
                        )
                      }
                    >
                      Skip selected
                    </Button>
                    <Button
                      variant="danger"
                      size="square"
                      type="button"
                      disabled={!selectedTasks.length || acting}
                      onClick={() => void deleteSelectedTasks()}
                    >
                      Delete selected
                    </Button>
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
                            <ButtonLink
                              size="compact"
                              to={annotationPath(project.id, task.id)}
                            >
                              {task.status === 'submitted'
                                ? 'View'
                                : task.status === 'unstarted'
                                  ? 'Label'
                                  : 'Continue'}
                            </ButtonLink>
                          )}
                          {(task.status === 'skipped' ||
                            task.status === 'blocked') && (
                            <Button
                              size="compact"
                              type="button"
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
                            </Button>
                          )}
                          {task.status === 'submitted' && (
                            <Button
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
                            </Button>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="task-pagination">
                  <Button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </Button>
                  <span>
                    {page + 1} /{' '}
                    {Math.max(1, Math.ceil(orderedVisibleTasks.length / 25))}
                  </span>
                  <Button
                    type="button"
                    disabled={(page + 1) * 25 >= orderedVisibleTasks.length}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className="detail-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Labeling configuration</p>
                <h2>Active taxonomy</h2>
              </div>
              <span className="count-badge">
                v{activeTaxonomyVersion.version}
              </span>
            </div>

            <div className="active-taxonomy-summary">
              <div>
                <span>Taxonomy</span>
                <strong>
                  {activeTaxonomyVersion.metadata.name ?? 'Unnamed taxonomy'}
                </strong>
                <small>{activeTaxonomyVersion.sourceFilename}</small>
              </div>

              <div className="active-taxonomy-metrics">
                <div>
                  <strong>{regionLabels.length}</strong>
                  <span>Region labels</span>
                </div>
                <div>
                  <strong>{clipLabels.length}</strong>
                  <span>Clip labels</span>
                </div>
                <div>
                  <strong>{scaleCount}</strong>
                  <span>Scales</span>
                </div>
              </div>

              {regionLabels.length > 0 && (
                <div className="taxonomy-label-preview">
                  {regionLabels.map((label) => (
                    <span key={label.id}>
                      <i
                        aria-hidden="true"
                        style={{
                          backgroundColor: label.color ?? 'var(--accent)',
                        }}
                      />
                      {label.name}
                    </span>
                  ))}
                </div>
              )}

              <p className="taxonomy-version-note">
                New annotations use this version. Existing drafts remain pinned
                to the version they were created with.
              </p>

              <ButtonLink size="compact" to={taxonomyEditorPath(project.id)}>
                Edit taxonomy
              </ButtonLink>
            </div>
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

        <section className="detail-section instructions-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reference</p>
              <h2>Annotation instructions</h2>
            </div>
            <div className="section-heading__actions">
              {instructions && (
                <span
                  className="section-heading__filename"
                  title={instructions.sourceFilename}
                >
                  {instructions.sourceFilename}
                </span>
              )}
              <ButtonLink
                size="compact"
                to={instructionsEditorPath(project.id)}
              >
                Edit instructions
              </ButtonLink>
            </div>
          </div>
          {instructions ? (
            <MarkdownInstructions markdown={instructions.rawMarkdown} />
          ) : (
            <div className="task-empty-state">
              <h3>No instructions have been added.</h3>
              <p className="muted-copy">
                Add instructions to help annotators understand the project and
                the tasks.
              </p>
            </div>
          )}
        </section>

        <ProjectDataPortability
          projectId={project.id}
          projectName={project.name}
        />

        <section className="danger-zone">
          <div>
            <h2>Delete project</h2>
            <p>
              Deletes project metadata, taxonomy history, instructions, and task
              records from this browser. Source audio is never deleted.
            </p>
          </div>
          <Button
            ref={deleteProjectTriggerRef}
            variant="danger"
            type="button"
            onClick={() => setDeleteOpen(true)}
          >
            Delete project
          </Button>
        </section>
      </main>

      <Modal
        open={deleteOpen}
        className="project-delete-dialog"
        titleId="delete-title"
        descriptionId="delete-description"
        initialFocusRef={deleteProjectInputRef}
        returnFocusRef={deleteProjectTriggerRef}
        closeOnBackdrop={!acting}
        closeOnEscape={!acting}
        onClose={closeDeleteProject}
      >
        <ModalTitle id="delete-title">
          Permanently delete {project.name}?
        </ModalTitle>
        <ModalDescription id="delete-description">
          This cannot be undone without a future project backup. Source audio
          files remain untouched.
        </ModalDescription>
        <label className="field">
          <span>Type the project name to confirm</span>
          <input
            ref={deleteProjectInputRef}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <ModalActions className="form-actions">
          <Button type="button" onClick={closeDeleteProject} disabled={acting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={confirmation !== project.name || acting}
            onClick={() => void deleteProject()}
          >
            {acting ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </ModalActions>
      </Modal>
    </ProjectLayout>
  )
}
