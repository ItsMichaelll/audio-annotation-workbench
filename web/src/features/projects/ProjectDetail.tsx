import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { editProjectPath } from '../../routes'
import { permanentlyDeleteProject, updateProjectStatus } from './projectActions'
import { formatTimestamp } from './format'
import { MarkdownInstructions } from './MarkdownInstructions'
import { PageNotice, ProjectLayout, ProjectPageState } from './ProjectLayout'
import { useProject } from './projectHooks'

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.'
}

export function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const state = useProject(projectId)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')

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
  } = state.data

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
            <div className="task-empty-state">
              <h3>No tasks imported</h3>
              <p>
                Task ingestion is the next milestone. It will add direct file,
                directory, and manifest import with duplicate and missing-file
                checks.
              </p>
            </div>
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
