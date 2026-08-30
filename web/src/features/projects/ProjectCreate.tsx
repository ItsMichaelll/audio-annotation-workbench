import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import type {
  PreparedInstructions,
  PreparedTaxonomy,
} from '../../domain/uploads'
import {
  prepareInstructionsFile,
  prepareTaxonomyFile,
} from '../../domain/uploads'
import { projectPath } from '../../routes'
import { createProject } from './projectActions'
import { PageNotice, ProjectLayout } from './ProjectLayout'
import { TaskImport } from './TaskImport'
import type { ImportCandidate } from '../../domain/taskIngestion'

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The project could not be created.'
}

export function ProjectCreate() {
  const navigate = useNavigate()
  const taxonomyInput = useRef<HTMLInputElement>(null)
  const instructionsInput = useRef<HTMLInputElement>(null)
  const submissionInProgress = useRef(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taxonomy, setTaxonomy] = useState<PreparedTaxonomy | null>(null)
  const [instructions, setInstructions] = useState<PreparedInstructions | null>(
    null,
  )
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
  const [instructionsError, setInstructionsError] = useState<string | null>(
    null,
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [tasks, setTasks] = useState<ImportCandidate[]>([])

  const selectTaxonomy = async (file: File | undefined) => {
    setTaxonomy(null)
    setTaxonomyError(null)
    if (!file) return
    try {
      setTaxonomy(await prepareTaxonomyFile(file))
    } catch (error) {
      setTaxonomyError(messageFrom(error))
    }
  }

  const selectInstructions = async (file: File | undefined) => {
    setInstructions(null)
    setInstructionsError(null)
    if (!file) return
    try {
      setInstructions(await prepareInstructionsFile(file))
    } catch (error) {
      setInstructionsError(messageFrom(error))
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    if (
      submissionInProgress.current ||
      !name.trim() ||
      !taxonomy ||
      taxonomyError ||
      instructionsError
    )
      return
    submissionInProgress.current = true
    setSubmitting(true)
    try {
      const input = {
        name,
        taxonomy,
        ...(description.trim() ? { description } : {}),
        ...(instructions ? { instructions } : {}),
        ...(tasks.length ? { tasks } : {}),
      }
      const project = await createProject(input)
      navigate(projectPath(project.id), { replace: true })
    } catch (error) {
      setSubmitError(messageFrom(error))
      submissionInProgress.current = false
      setSubmitting(false)
    }
  }

  const problems = [
    !name.trim() ? 'Enter a project name.' : null,
    !taxonomy ? 'Upload a valid taxonomy file.' : null,
    taxonomyError,
    instructionsError,
  ].filter((problem): problem is string => Boolean(problem))

  return (
    <ProjectLayout>
      <main className="project-page project-page--form">
        <div className="breadcrumbs">
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span>New project</span>
        </div>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Project foundation</p>
            <h1>Create project</h1>
            <p>
              Define the project and taxonomy, then optionally preflight tasks.
            </p>
          </div>
        </div>

        <form className="project-form" onSubmit={(event) => void submit(event)}>
          {submitError && (
            <PageNotice title="Project was not created" tone="error">
              <p>{submitError}</p>
            </PageNotice>
          )}

          <section className="form-section">
            <div className="form-section__heading">
              <span>01</span>
              <div>
                <h2>Project details</h2>
                <p>Names are display values; projects use independent UUIDs.</p>
              </div>
            </div>
            <label className="field">
              <span>Project name *</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={160}
                autoFocus
                required
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={2000}
              />
            </label>
          </section>

          <section className="form-section">
            <div className="form-section__heading">
              <span>04</span>
              <div>
                <h2>Initial tasks</h2>
                <p>
                  Optional. Review the preview before task records are written.
                </p>
              </div>
            </div>
            <TaskImport onReady={setTasks} />
            {tasks.length > 0 && (
              <div className="file-selection">
                <strong>{tasks.length} tasks ready for creation</strong>
                <button type="button" onClick={() => setTasks([])}>
                  Clear
                </button>
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section__heading">
              <span>02</span>
              <div>
                <h2>Taxonomy *</h2>
                <p>JSON or YAML, up to 1 MB. The root must be an object.</p>
              </div>
            </div>
            <input
              ref={taxonomyInput}
              className="visually-hidden"
              type="file"
              accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void selectTaxonomy(file)
              }}
            />
            <button
              type="button"
              onClick={() => taxonomyInput.current?.click()}
            >
              {taxonomy ? 'Replace taxonomy file' : 'Upload taxonomy file'}
            </button>
            {taxonomy && (
              <div className="file-selection">
                <strong>{taxonomy.sourceFilename}</strong>
                <span>
                  {taxonomy.sourceFormat.toUpperCase()} · SHA-256{' '}
                  {taxonomy.contentHash.slice(0, 12)}…
                </span>
              </div>
            )}
            {taxonomyError && <p className="field-error">{taxonomyError}</p>}
          </section>

          <section className="form-section">
            <div className="form-section__heading">
              <span>03</span>
              <div>
                <h2>Annotation instructions</h2>
                <p>
                  Optional Markdown, up to 512 KB. Raw HTML is not rendered.
                </p>
              </div>
            </div>
            <input
              ref={instructionsInput}
              className="visually-hidden"
              type="file"
              accept=".md,text/markdown"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void selectInstructions(file)
              }}
            />
            <button
              type="button"
              onClick={() => instructionsInput.current?.click()}
            >
              {instructions ? 'Replace instructions' : 'Upload Markdown file'}
            </button>
            {instructions && (
              <div className="file-selection">
                <strong>{instructions.sourceFilename}</strong>
                <button type="button" onClick={() => setInstructions(null)}>
                  Remove
                </button>
              </div>
            )}
            {instructionsError && (
              <p className="field-error">{instructionsError}</p>
            )}
          </section>

          <section className="validation-summary" aria-live="polite">
            <h2>Validation summary</h2>
            {problems.length === 0 ? (
              <p className="validation-summary__ready">Ready to create.</p>
            ) : (
              <ul>
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </section>

          <div className="form-actions">
            <Link className="button-link button-link--secondary" to="/projects">
              Cancel
            </Link>
            <button
              className="primary-button"
              type="submit"
              disabled={problems.length > 0 || submitting}
            >
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </main>
    </ProjectLayout>
  )
}
