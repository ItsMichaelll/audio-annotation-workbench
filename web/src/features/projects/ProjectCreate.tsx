import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
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
import formStyles from './ProjectForm.module.css'
import layoutStyles from './ProjectLayout.module.css'
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
      <main className={`${layoutStyles.page} ${layoutStyles.pageForm}`}>
        <div className={layoutStyles.breadcrumbs}>
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span>New project</span>
        </div>
        <div className={layoutStyles.pageHeading}>
          <div>
            <p className={layoutStyles.eyebrow}>Project foundation</p>
            <h1 className={layoutStyles.pageHeadingTitle}>Create project</h1>
            <p className={layoutStyles.pageHeadingDescription}>
              Define the project and taxonomy, then optionally preflight tasks.
            </p>
          </div>
        </div>

        <form
          className={formStyles.form}
          onSubmit={(event) => void submit(event)}
        >
          {submitError && (
            <PageNotice title="Project was not created" tone="error">
              <p>{submitError}</p>
            </PageNotice>
          )}

          <section className={formStyles.section}>
            <div className={formStyles.sectionHeading}>
              <span className={formStyles.sectionNumber}>01</span>
              <div>
                <h2 className={formStyles.sectionTitle}>Project details</h2>
                <p className={formStyles.sectionDescription}>
                  Names are display values; projects use independent UUIDs.
                </p>
              </div>
            </div>
            <label className={formStyles.field}>
              <span>Project name *</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={160}
                autoFocus
                required
              />
            </label>
            <label className={formStyles.field}>
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={2000}
              />
            </label>
          </section>

          <section className={formStyles.section}>
            <div className={formStyles.sectionHeading}>
              <span className={formStyles.sectionNumber}>04</span>
              <div>
                <h2 className={formStyles.sectionTitle}>Initial tasks</h2>
                <p className={formStyles.sectionDescription}>
                  Optional. Review the preview before task records are written.
                </p>
              </div>
            </div>
            <TaskImport onReady={setTasks} />
            {tasks.length > 0 && (
              <div className={formStyles.fileSelection}>
                <strong>{tasks.length} tasks ready for creation</strong>
                <Button type="button" onClick={() => setTasks([])}>
                  Clear
                </Button>
              </div>
            )}
          </section>

          <section className={formStyles.section}>
            <div className={formStyles.sectionHeading}>
              <span className={formStyles.sectionNumber}>02</span>
              <div>
                <h2 className={formStyles.sectionTitle}>Taxonomy *</h2>
                <p className={formStyles.sectionDescription}>
                  JSON or YAML, up to 1 MB. Annotation schema version one and at
                  least one stable label are required.
                </p>
              </div>
            </div>
            <input
              ref={taxonomyInput}
              className="u-visually-hidden"
              type="file"
              accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void selectTaxonomy(file)
              }}
            />
            <Button
              type="button"
              onClick={() => taxonomyInput.current?.click()}
            >
              {taxonomy ? 'Replace taxonomy file' : 'Upload taxonomy file'}
            </Button>
            {taxonomy && (
              <div className={formStyles.fileSelection}>
                <strong>{taxonomy.sourceFilename}</strong>
                <span className={formStyles.fileSelectionName}>
                  {taxonomy.sourceFormat.toUpperCase()} · SHA-256{' '}
                  {taxonomy.contentHash.slice(0, 12)}…
                </span>
              </div>
            )}
            {taxonomyError && (
              <p className={formStyles.fieldError}>{taxonomyError}</p>
            )}
          </section>

          <section className={formStyles.section}>
            <div className={formStyles.sectionHeading}>
              <span className={formStyles.sectionNumber}>03</span>
              <div>
                <h2 className={formStyles.sectionTitle}>
                  Annotation instructions
                </h2>
                <p className={formStyles.sectionDescription}>
                  Optional Markdown, up to 512 KB. Raw HTML is not rendered.
                </p>
              </div>
            </div>
            <input
              ref={instructionsInput}
              className="u-visually-hidden"
              type="file"
              accept=".md,text/markdown"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void selectInstructions(file)
              }}
            />
            <Button
              type="button"
              onClick={() => instructionsInput.current?.click()}
            >
              {instructions ? 'Replace instructions' : 'Upload Markdown file'}
            </Button>
            {instructions && (
              <div className={formStyles.fileSelection}>
                <strong>{instructions.sourceFilename}</strong>
                <Button type="button" onClick={() => setInstructions(null)}>
                  Remove
                </Button>
              </div>
            )}
            {instructionsError && (
              <p className={formStyles.fieldError}>{instructionsError}</p>
            )}
          </section>

          <section className={formStyles.validationSummary} aria-live="polite">
            <h2 className={formStyles.validationSummaryTitle}>
              Validation summary
            </h2>
            {problems.length === 0 ? (
              <p className={formStyles.validationSummaryReady}>
                Ready to create.
              </p>
            ) : (
              <ul className={formStyles.validationSummaryList}>
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </section>

          <div className={formStyles.actions}>
            <ButtonLink to="/projects">Cancel</ButtonLink>
            <Button
              variant="primary"
              type="submit"
              disabled={problems.length > 0 || submitting}
            >
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </form>
      </main>
    </ProjectLayout>
  )
}
