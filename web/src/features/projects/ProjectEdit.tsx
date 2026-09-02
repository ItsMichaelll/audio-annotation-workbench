import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import type { ProjectAggregate } from '../../domain/models'
import type {
  PreparedInstructions,
  PreparedTaxonomy,
} from '../../domain/uploads'
import {
  prepareInstructionsFile,
  prepareTaxonomyFile,
} from '../../domain/uploads'
import {
  instructionsEditorPath,
  projectPath,
  taxonomyEditorPath,
} from '../../routes'
import {
  addProjectTaxonomy,
  clearProjectInstructions,
  setProjectInstructions,
  updateProjectDetails,
  updateProjectStatus,
} from './projectActions'
import { formatTimestamp } from './format'
import { PageNotice, ProjectLayout, ProjectPageState } from './ProjectLayout'
import formStyles from './ProjectForm.module.css'
import layoutStyles from './ProjectLayout.module.css'
import { useProject } from './projectHooks'

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The project could not be saved.'
}

type InstructionsChange =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'replace'; instructions: PreparedInstructions }

function LoadedProjectEdit({ aggregate }: { aggregate: ProjectAggregate }) {
  const navigate = useNavigate()
  const { project, activeTaxonomyVersion, taxonomyVersions, instructions } =
    aggregate
  const taxonomyInput = useRef<HTMLInputElement>(null)
  const instructionsInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [taxonomy, setTaxonomy] = useState<PreparedTaxonomy | null>(null)
  const [instructionsChange, setInstructionsChange] =
    useState<InstructionsChange>({ kind: 'keep' })
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
  const [instructionsError, setInstructionsError] = useState<string | null>(
    null,
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
    setInstructionsError(null)
    if (!file) return
    try {
      setInstructionsChange({
        kind: 'replace',
        instructions: await prepareInstructionsFile(file),
      })
    } catch (error) {
      setInstructionsError(messageFrom(error))
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || taxonomyError || instructionsError) return
    setSaving(true)
    setSaveError(null)
    setNotice(null)
    try {
      let duplicateTaxonomyNotice: string | null = null
      await updateProjectDetails(
        project.id,
        name,
        description.trim() ? description : undefined,
      )
      if (taxonomy) {
        const result = await addProjectTaxonomy(project.id, taxonomy)
        if (!result.created) {
          duplicateTaxonomyNotice = `The uploaded taxonomy matches existing version ${result.taxonomy.version}; no duplicate version was created.`
        }
      }
      if (instructionsChange.kind === 'replace') {
        await setProjectInstructions(
          project.id,
          instructionsChange.instructions,
        )
      } else if (instructionsChange.kind === 'remove') {
        await clearProjectInstructions(project.id)
      }
      if (duplicateTaxonomyNotice) {
        setNotice(duplicateTaxonomyNotice)
        setSaving(false)
      } else {
        navigate(projectPath(project.id), { replace: true })
      }
    } catch (error) {
      setSaveError(messageFrom(error))
      setSaving(false)
    }
  }

  const toggleArchive = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await updateProjectStatus(
        project.id,
        project.status === 'active' ? 'archived' : 'active',
      )
      navigate(projectPath(project.id), { replace: true })
    } catch (error) {
      setSaveError(messageFrom(error))
      setSaving(false)
    }
  }

  const pendingInstructionsName =
    instructionsChange.kind === 'replace'
      ? instructionsChange.instructions.sourceFilename
      : instructionsChange.kind === 'remove'
        ? null
        : instructions?.sourceFilename

  return (
    <ProjectLayout>
      <main className={`${layoutStyles.page} ${layoutStyles.pageForm}`}>
        <div className={layoutStyles.breadcrumbs}>
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <Link to={projectPath(project.id)}>{project.name}</Link>
          <span aria-hidden="true">/</span>
          <span>Edit</span>
        </div>
        <div className={layoutStyles.pageHeading}>
          <div>
            <p className={layoutStyles.eyebrow}>Project settings</p>
            <h1 className={layoutStyles.pageHeadingTitle}>Edit project</h1>
            <p className={layoutStyles.pageHeadingDescription}>
              Metadata can change. Taxonomy history remains immutable and new
              content creates a new version.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void toggleArchive()}
            disabled={saving}
          >
            {project.status === 'active'
              ? 'Archive project'
              : 'Restore project'}
          </Button>
        </div>

        <form
          className={formStyles.form}
          onSubmit={(event) => void submit(event)}
        >
          {saveError && (
            <PageNotice title="Project could not be saved" tone="error">
              <p>{saveError}</p>
            </PageNotice>
          )}
          {notice && (
            <PageNotice title="Taxonomy already exists">
              <p>{notice}</p>
              <ButtonLink to={projectPath(project.id)}>
                Return to project
              </ButtonLink>
            </PageNotice>
          )}

          <section className={formStyles.section}>
            <div className={formStyles.sectionHeading}>
              <span className={formStyles.sectionNumber}>01</span>
              <div>
                <h2 className={formStyles.sectionTitle}>Project details</h2>
                <p className={formStyles.sectionDescription}>
                  Renaming does not change the stable project ID.
                </p>
              </div>
            </div>
            <label className={formStyles.field}>
              <span>Project name *</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={160}
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
              <span className={formStyles.sectionNumber}>02</span>
              <div>
                <h2 className={formStyles.sectionTitle}>Taxonomy version</h2>
                <p className={formStyles.sectionDescription}>
                  Current: v{activeTaxonomyVersion.version} ·{' '}
                  {activeTaxonomyVersion.sourceFilename}
                </p>
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
            <div className={formStyles.sectionActions}>
              <Button
                type="button"
                onClick={() => taxonomyInput.current?.click()}
              >
                Upload replacement taxonomy
              </Button>
              <ButtonLink to={taxonomyEditorPath(project.id)}>
                Edit taxonomy in browser
              </ButtonLink>
            </div>
            {taxonomy && (
              <div className={formStyles.fileSelection}>
                <strong>{taxonomy.sourceFilename}</strong>
                <span className={formStyles.fileSelectionName}>
                  Pending new version
                </span>
                <Button type="button" onClick={() => setTaxonomy(null)}>
                  Clear
                </Button>
              </div>
            )}
            {taxonomyError && (
              <p className={formStyles.fieldError}>{taxonomyError}</p>
            )}
            <div className={formStyles.compactHistory}>
              {taxonomyVersions.map((version) => (
                <div className={formStyles.historyRow} key={version.id}>
                  <strong>v{version.version}</strong>
                  <span>{version.sourceFilename}</span>
                  <span>{formatTimestamp(version.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={formStyles.section}>
            <div className={formStyles.sectionHeading}>
              <span className={formStyles.sectionNumber}>03</span>
              <div>
                <h2 className={formStyles.sectionTitle}>
                  Annotation instructions
                </h2>
                <p className={formStyles.sectionDescription}>
                  Replace or remove the project Markdown instructions.
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
            <div className={formStyles.sectionActions}>
              <Button
                type="button"
                onClick={() => instructionsInput.current?.click()}
              >
                {pendingInstructionsName
                  ? 'Upload replacement instructions'
                  : 'Add instructions'}
              </Button>
              <ButtonLink to={instructionsEditorPath(project.id)}>
                Edit instructions in browser
              </ButtonLink>
            </div>
            {pendingInstructionsName && (
              <div className={formStyles.fileSelection}>
                <strong>{pendingInstructionsName}</strong>
                <Button
                  variant="danger"
                  className={formStyles.fileSelectionRemove}
                  type="button"
                  onClick={() => setInstructionsChange({ kind: 'remove' })}
                >
                  Remove
                </Button>
              </div>
            )}
            {!pendingInstructionsName &&
              instructionsChange.kind === 'remove' && (
                <p className={formStyles.mutedCopy}>
                  Instructions will be removed on save.
                </p>
              )}
            {instructionsError && (
              <p className={formStyles.fieldError}>{instructionsError}</p>
            )}
          </section>

          <div className={formStyles.actions}>
            <ButtonLink to={projectPath(project.id)}>Cancel</ButtonLink>
            <Button
              variant="primary"
              type="submit"
              disabled={
                !name.trim() ||
                Boolean(taxonomyError || instructionsError) ||
                saving
              }
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </main>
    </ProjectLayout>
  )
}

export function ProjectEdit() {
  const { projectId } = useParams()
  const state = useProject(projectId)
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
  if (!state.data) {
    return (
      <ProjectPageState
        title="Project not found"
        message="The requested project does not exist in this browser."
      />
    )
  }
  return <LoadedProjectEdit aggregate={state.data} />
}
