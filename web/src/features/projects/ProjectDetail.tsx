import { useRef, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import { Icon } from '../../components/Icon'
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
import { canTransitionTask } from '../../domain/taskIngestion'
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
import detailStyles from './ProjectDetail.module.css'
import layoutStyles from './ProjectLayout.module.css'
import { useProject } from './projectHooks'
import { SourceFolders } from './SourceFolders'
import { TaskImport } from './TaskImport'
import { ProjectDataPortability } from './ProjectDataPortability'
import statusStyles from './ProjectStatus.module.css'

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
  const [searchParams] = useSearchParams()
  const section = ['reference', 'data'].includes(searchParams.get('tab') ?? '')
    ? searchParams.get('tab')
    : 'tasks'

  if (state.loading) {
    return (
      <ProjectLayout theme="light">
        <main className={layoutStyles.page} aria-busy="true">
          <p role="status">Loading project…</p>
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
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(orderedVisibleTasks.length / 25) - 1),
  )
  const pageTasks = orderedVisibleTasks.slice(
    currentPage * 25,
    currentPage * 25 + 25,
  )
  const nextTask = nextActionableTask(tasks)
  const pageIds = pageTasks.map((task) => task.id)
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedTasks.includes(id))
  const somePageSelected = pageIds.some((id) => selectedTasks.includes(id))
  const selectedSkippableTaskIds = tasks
    .filter(
      (task) =>
        selectedTasks.includes(task.id) &&
        task.status !== 'skipped' &&
        canTransitionTask(task.status, 'skipped'),
    )
    .map((task) => task.id)
  const selectedRestorableTaskIds = tasks
    .filter(
      (task) =>
        selectedTasks.includes(task.id) &&
        (task.status === 'skipped' || task.status === 'blocked'),
    )
    .map((task) => task.id)

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
    <ProjectLayout theme="light">
      <main className={layoutStyles.page}>
        <div className={layoutStyles.breadcrumbs}>
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

        <header className={detailStyles.hero}>
          <div>
            <div className={detailStyles.heroStatus}>
              <span
                className={`${statusStyles.badge} ${
                  project.status === 'archived' ? statusStyles.archived : ''
                }`}
              >
                {project.status}
              </span>
              <span>Taxonomy v{activeTaxonomyVersion.version}</span>
            </div>
            <h1 className={detailStyles.heroTitle}>{project.name}</h1>
            {project.description && (
              <p className={detailStyles.heroDescription}>
                {project.description}
              </p>
            )}
          </div>
          <div className={detailStyles.heroActions}>
            {nextTask && !taxonomyError && project.status === 'active' ? (
              <ButtonLink
                className={detailStyles.heroAction}
                variant="primary"
                to={annotationPath(project.id, nextTask.id)}
              >
                <Icon name="play" /> Start Labeling
              </ButtonLink>
            ) : (
              <Button
                className={detailStyles.heroAction}
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
            <ButtonLink
              className={detailStyles.heroAction}
              to={editProjectPath(project.id)}
            >
              Edit project
            </ButtonLink>
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

        <section
          className={detailStyles.overview}
          aria-label="Project progress"
        >
          <div className={detailStyles.completion}>
            <span className={detailStyles.completionHeadline}>
              <strong>
                {progress.total
                  ? Math.round((progress.completed / progress.total) * 100)
                  : 0}
                %
              </strong>
              <span>complete</span>
            </span>
            <progress
              aria-label="Project task completion"
              value={progress.completed}
              max={Math.max(progress.total, 1)}
            />
            <small>
              {progress.submitted} submitted · {progress.skipped} skipped
            </small>
          </div>
          <div>
            <strong>{progress.total}</strong>
            <span>Total tasks</span>
          </div>
          <div>
            <strong>{progress.unstarted}</strong>
            <span>Unstarted</span>
          </div>
          <div>
            <strong>{progress.inProgress + progress.reopened}</strong>
            <span>In progress</span>
          </div>
          <div data-attention={progress.blocked > 0}>
            <strong>{progress.blocked}</strong>
            <span>Blocked</span>
          </div>
        </section>
        <nav className={detailStyles.navigation} aria-label="Project sections">
          {(
            [
              { value: 'tasks', label: 'Tasks', icon: 'waveform' },
              { value: 'reference', label: 'Reference', icon: 'book' },
              { value: 'data', label: 'Data & settings', icon: 'download' },
            ] as const
          ).map((item) => (
            <Link
              key={item.value}
              to={item.value === 'tasks' ? '?' : `?tab=${item.value}`}
              aria-current={section === item.value ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
              {item.value === 'tasks' && <span>{tasks.length}</span>}
            </Link>
          ))}
        </nav>
        <div hidden={section !== 'tasks'}>
          <section
            className={`${detailStyles.section} ${detailStyles.sectionWide}`}
            aria-label="Audio tasks"
          >
            <h2 className="u-visually-hidden">Audio tasks</h2>
            <SourceFolders
              project={project}
              tasks={tasks}
              onChanged={state.refresh}
            />
            <details
              className={detailStyles.importPanel}
              open={tasks.length === 0 ? true : undefined}
            >
              <summary>
                <Icon name="upload" /> Import audio{' '}
                <span>Files, directories, or a manifest</span>
              </summary>
              <TaskImport
                existing={tasks}
                onReady={(candidates) =>
                  void taskAction(() =>
                    importProjectTasks(project.id, candidates),
                  )
                }
              />
            </details>
            {tasks.length === 0 ? (
              <div className={detailStyles.emptyState}>
                <h3 className={detailStyles.emptyStateTitle}>
                  No tasks imported
                </h3>
                <p className={detailStyles.emptyStateDescription}>
                  Add audio files or a JSON/JSONL manifest. Manifest-only tasks
                  remain unresolved until linked.
                </p>
              </div>
            ) : (
              <>
                <div
                  className={detailStyles.taskControls}
                  aria-label="Task filters and bulk actions"
                >
                  <div className={detailStyles.taskFilters}>
                    <input
                      className={detailStyles.taskSearch}
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
                  <div className={detailStyles.taskActions}>
                    <span aria-live="polite">
                      {selectedTasks.length} selected
                    </span>
                    <Button
                      size="square"
                      type="button"
                      disabled={!selectedRestorableTaskIds.length || acting}
                      onClick={() =>
                        void taskAction(() =>
                          setTaskStatus(
                            project.id,
                            selectedRestorableTaskIds,
                            'unstarted',
                          ),
                        )
                      }
                    >
                      Restore selected
                    </Button>
                    <Button
                      size="square"
                      type="button"
                      disabled={!selectedSkippableTaskIds.length || acting}
                      onClick={() =>
                        void taskAction(() =>
                          setTaskStatus(
                            project.id,
                            selectedSkippableTaskIds,
                            'skipped',
                          ),
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
                  className={detailStyles.taskTable}
                  role="table"
                  aria-label="Project tasks"
                >
                  <div
                    className={`${detailStyles.taskRow} ${detailStyles.taskHeader}`}
                    role="row"
                  >
                    <span role="columnheader">
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
                      <span
                        className={detailStyles.selectPageLabel}
                        aria-hidden="true"
                      >
                        Select this page
                      </span>
                    </span>
                    <span role="columnheader">Name / source</span>
                    <span role="columnheader">External ID</span>
                    <span role="columnheader">Status</span>
                    <span role="columnheader">Availability</span>
                    <span role="columnheader">Updated</span>
                    <span role="columnheader">Action</span>
                  </div>
                  {pageTasks.length === 0 && (
                    <div className={detailStyles.noMatches} role="row">
                      <div role="cell" aria-colspan={7}>
                        <strong>No matching tasks</strong>
                        <p>Try another name, ID, path, or status.</p>
                        <Button
                          onClick={() => {
                            setQuery('')
                            setStatusFilter('all')
                            setPage(0)
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </div>
                  )}
                  {pageTasks.map((task) => {
                    const name =
                      task.displayName ?? task.primaryMedia.displayName
                    return (
                      <div
                        data-selected={selectedTasks.includes(task.id)}
                        className={detailStyles.taskRow}
                        role="row"
                        key={task.id}
                      >
                        <span role="cell">
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
                        <span role="cell">
                          <strong className={detailStyles.taskName}>
                            {name}
                          </strong>
                          {(task.relativePath ??
                            task.primaryMedia.displayName) !== name && (
                            <small className={detailStyles.taskPath}>
                              {task.relativePath ??
                                task.primaryMedia.displayName}
                            </small>
                          )}
                        </span>
                        <span role="cell" data-label="ID">
                          {task.externalId ?? '—'}
                        </span>
                        <span role="cell">
                          <span
                            className={detailStyles.taskStatus}
                            data-status={task.status}
                          >
                            {task.status}
                          </span>
                        </span>
                        <span role="cell" data-label="Audio">
                          {task.primaryMedia.kind === 'unresolved'
                            ? 'Missing/unresolved'
                            : task.primaryMedia.kind === 'external-reference'
                              ? 'Session-only'
                              : task.primaryMedia.kind === 'folder'
                                ? 'Connected folder'
                                : 'Available'}
                        </span>
                        <span role="cell" data-label="Updated">
                          {formatTimestamp(task.updatedAt)}
                        </span>
                        <span role="cell" className={detailStyles.taskAction}>
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
                              size="compact"
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
                <div className={detailStyles.taskPagination}>
                  <Button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <span>
                    {currentPage + 1} /{' '}
                    {Math.max(1, Math.ceil(orderedVisibleTasks.length / 25))}
                  </span>
                  <Button
                    type="button"
                    disabled={
                      (currentPage + 1) * 25 >= orderedVisibleTasks.length
                    }
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
        <div hidden={section !== 'reference'}>
          <section className={detailStyles.section}>
            <div className={detailStyles.sectionHeading}>
              <div>
                <p
                  className={`${layoutStyles.eyebrow} ${detailStyles.sectionHeadingEyebrow}`}
                >
                  Labeling configuration
                </p>
                <h2 className={detailStyles.sectionTitle}>Active taxonomy</h2>
              </div>
              <span className={detailStyles.countBadge}>
                v{activeTaxonomyVersion.version}
              </span>
            </div>

            <div className={detailStyles.activeTaxonomySummary}>
              <div>
                <span className={detailStyles.taxonomyNameLabel}>Taxonomy</span>
                <strong className={detailStyles.taxonomyName}>
                  {activeTaxonomyVersion.metadata.name ?? 'Unnamed taxonomy'}
                </strong>
                <small className={detailStyles.taxonomyFilename}>
                  {activeTaxonomyVersion.sourceFilename}
                </small>
              </div>

              <div className={detailStyles.metrics}>
                <div className={detailStyles.metric}>
                  <strong className={detailStyles.metricValue}>
                    {regionLabels.length}
                  </strong>
                  <span className={detailStyles.metricLabel}>
                    Region labels
                  </span>
                </div>
                <div className={detailStyles.metric}>
                  <strong className={detailStyles.metricValue}>
                    {clipLabels.length}
                  </strong>
                  <span className={detailStyles.metricLabel}>Clip labels</span>
                </div>
                <div className={detailStyles.metric}>
                  <strong className={detailStyles.metricValue}>
                    {scaleCount}
                  </strong>
                  <span className={detailStyles.metricLabel}>Scales</span>
                </div>
              </div>

              {regionLabels.length > 0 && (
                <div className={detailStyles.labelPreview}>
                  {regionLabels.map((label) => (
                    <span
                      className={detailStyles.labelPreviewItem}
                      key={label.id}
                    >
                      <i
                        className={detailStyles.labelPreviewSwatch}
                        aria-hidden="true"
                        style={{
                          backgroundColor:
                            label.color ?? 'var(--color-blue-500)',
                        }}
                      />
                      {label.name}
                    </span>
                  ))}
                </div>
              )}

              <p className={detailStyles.taxonomyVersionNote}>
                New annotations use this version. Existing drafts remain pinned
                to the version they were created with.
              </p>

              <ButtonLink size="compact" to={taxonomyEditorPath(project.id)}>
                Edit taxonomy
              </ButtonLink>
            </div>
          </section>

          <section className={detailStyles.section}>
            <div className={detailStyles.sectionHeading}>
              <div>
                <p
                  className={`${layoutStyles.eyebrow} ${detailStyles.sectionHeadingEyebrow}`}
                >
                  Immutable history
                </p>
                <h2 className={detailStyles.sectionTitle}>Taxonomy versions</h2>
              </div>
              <span className={detailStyles.countBadge}>
                {taxonomyVersions.length}
              </span>
            </div>
            <div
              className={detailStyles.history}
              role="table"
              aria-label="Taxonomy history"
            >
              <div
                className={`${detailStyles.historyRow} ${detailStyles.historyHeader}`}
                role="row"
              >
                <span role="columnheader">Version</span>
                <span role="columnheader">Source</span>
                <span role="columnheader">Created</span>
                <span role="columnheader">State</span>
              </div>
              {taxonomyVersions.map((taxonomy) => (
                <div
                  className={detailStyles.historyRow}
                  role="row"
                  key={taxonomy.id}
                >
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

          <section
            className={`${detailStyles.section} ${detailStyles.instructionsSection}`}
          >
            <div className={detailStyles.sectionHeading}>
              <div>
                <p
                  className={`${layoutStyles.eyebrow} ${detailStyles.sectionHeadingEyebrow}`}
                >
                  Reference
                </p>
                <h2 className={detailStyles.sectionTitle}>
                  Annotation instructions
                </h2>
              </div>
              <div className={detailStyles.headingActions}>
                {instructions && (
                  <span
                    className={detailStyles.headingFilename}
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
              <div className={detailStyles.emptyState}>
                <h3 className={detailStyles.emptyStateTitle}>
                  No instructions have been added.
                </h3>
                <p className={detailStyles.emptyStateDescription}>
                  Add instructions to help annotators understand the project and
                  the tasks.
                </p>
              </div>
            )}
          </section>
        </div>
        <div hidden={section !== 'data'}>
          <section className={detailStyles.metadata} aria-label="Project dates">
            <div className={detailStyles.metadataItem}>
              <span className={detailStyles.metadataLabel}>Created</span>
              <strong className={detailStyles.metadataValue}>
                {formatTimestamp(project.createdAt)}
              </strong>
            </div>
            <div className={detailStyles.metadataItem}>
              <span className={detailStyles.metadataLabel}>Last updated</span>
              <strong className={detailStyles.metadataValue}>
                {formatTimestamp(project.updatedAt)}
              </strong>
            </div>
            <div className={detailStyles.metadataItem}>
              <span className={detailStyles.metadataLabel}>Project ID</span>
              <strong className={detailStyles.metadataValue}>
                {project.id}
              </strong>
            </div>
          </section>

          <section className={detailStyles.administration}>
            <div>
              <h2>Project settings</h2>
              <p>Manage project details and archive availability.</p>
            </div>
            <ButtonLink to={editProjectPath(project.id)}>
              Edit project
            </ButtonLink>{' '}
            <Button
              type="button"
              onClick={() => void toggleArchive()}
              disabled={acting}
            >
              {project.status === 'active' ? 'Archive' : 'Restore'}
            </Button>
          </section>
          <ProjectDataPortability
            projectId={project.id}
            projectName={project.name}
          />

          <section className={detailStyles.dangerZone}>
            <div>
              <h2 className={detailStyles.dangerTitle}>Delete project</h2>
              <p className={detailStyles.dangerDescription}>
                Deletes project metadata, taxonomy history, instructions, and
                task records from this browser. Source audio is never deleted.
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
        </div>
      </main>

      <Modal
        open={deleteOpen}
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
          This cannot be undone without a project backup. Source audio files
          remain untouched.
        </ModalDescription>
        <label className={detailStyles.confirmField}>
          <span>Type the project name to confirm</span>
          <input
            ref={deleteProjectInputRef}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <ModalActions>
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
