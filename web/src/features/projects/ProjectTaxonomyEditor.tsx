import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useConfirmation } from '../../components/confirmationContext'
import type { AnnotationTaxonomy } from '../../domain/annotationTaxonomy'
import {
  parseTaxonomyEditorSource,
  serializeStructuredTaxonomy,
  STRUCTURED_CANONICALIZATION_WARNING,
} from '../../domain/taxonomyEditing'
import { prepareTaxonomySource } from '../../domain/uploads'
import { projectPath } from '../../routes'
import { addProjectTaxonomy } from './projectActions'
import {
  downloadText,
  useEditorProtection,
  useUnsavedRouteProtection,
} from './editorBehavior'
import { PageNotice, ProjectLayout, ProjectPageState } from './ProjectLayout'
import { useProject } from './projectHooks'
import {
  StructuredTaxonomyEditor,
  TaxonomyModeSwitch,
  type TaxonomyEditorMode,
} from './TaxonomyStructuredEditor'

type SaveState = 'Saved' | 'Unsaved' | 'Saving' | 'Validation error'

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The taxonomy could not be saved.'
}

function LoadedTaxonomyEditor({
  aggregate,
}: {
  aggregate: NonNullable<ReturnType<typeof useProject>['data']>
}) {
  const { project, activeTaxonomyVersion } = aggregate
  const confirm = useConfirmation()
  const initialSource = activeTaxonomyVersion.rawSource
  let initial: ReturnType<typeof parseTaxonomyEditorSource>
  let initialError: string | null = null
  try {
    initial = parseTaxonomyEditorSource(initialSource)
  } catch (validationError) {
    initialError = messageFrom(validationError)
    initial = {
      rawSource: initialSource,
      document: activeTaxonomyVersion.document,
      taxonomy: { schemaVersion: 1, labels: [], scales: {} },
    }
  }
  const [mode, setMode] = useState<TaxonomyEditorMode>('yaml')
  const [source, setSource] = useState(initialSource)
  const [structured, setStructured] = useState(initial.taxonomy)
  const [error, setError] = useState<string | null>(initialError)
  const [dirty, setDirty] = useState(false)
  const [canonicalized, setCanonicalized] = useState(false)
  const canonicalizedRef = useRef(false)
  const canonicalizationRequestRef = useRef<Promise<boolean> | null>(null)
  const [saveState, setSaveState] = useState<SaveState>(
    initialError ? 'Validation error' : 'Saved',
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [activeVersion, setActiveVersion] = useState(
    activeTaxonomyVersion.version,
  )

  const validate = (nextSource: string) => {
    try {
      const snapshot = parseTaxonomyEditorSource(nextSource)
      setStructured(snapshot.taxonomy)
      setError(null)
      setSaveState('Unsaved')
      return true
    } catch (validationError) {
      setError(messageFrom(validationError))
      setSaveState('Validation error')
      return false
    }
  }

  const changeSource = (nextSource: string) => {
    setSource(nextSource)
    setDirty(true)
    setNotice(null)
    validate(nextSource)
  }

  const beginStructuredEdit = async (): Promise<boolean> => {
    if (canonicalizedRef.current || canonicalized) return true
    if (canonicalizationRequestRef.current)
      return canonicalizationRequestRef.current

    const request = confirm({
      title: 'Rewrite taxonomy YAML?',
      message: STRUCTURED_CANONICALIZATION_WARNING,
      confirmLabel: 'Continue editing',
    }).then((accepted) => {
      if (accepted) {
        canonicalizedRef.current = true
        setCanonicalized(true)
      }
      return accepted
    })
    canonicalizationRequestRef.current = request
    try {
      return await request
    } finally {
      canonicalizationRequestRef.current = null
    }
  }

  const changeStructured = async (next: AnnotationTaxonomy) => {
    if (!(await beginStructuredEdit())) return false
    setStructured(next)
    const nextSource = serializeStructuredTaxonomy(next)
    setSource(nextSource)
    setDirty(true)
    setNotice(null)
    try {
      parseTaxonomyEditorSource(nextSource)
      setError(null)
      setSaveState('Unsaved')
    } catch (validationError) {
      setError(messageFrom(validationError))
      setSaveState('Validation error')
    }
    return true
  }

  const save = async () => {
    if (!dirty || error || saveState === 'Saving') return
    setSaveState('Saving')
    setNotice(null)
    try {
      const prepared = await prepareTaxonomySource(source, 'taxonomy.yaml')
      const result = await addProjectTaxonomy(project.id, prepared)
      setActiveVersion(result.taxonomy.version)
      setDirty(false)
      setSaveState('Saved')
      setNotice(
        result.created
          ? `Taxonomy v${result.taxonomy.version} was created and activated.`
          : `This taxonomy matches v${result.taxonomy.version}; no duplicate version was created.`,
      )
    } catch (saveError) {
      setError(messageFrom(saveError))
      setSaveState('Validation error')
    }
  }

  useEditorProtection(dirty, () => void save())
  useUnsavedRouteProtection(dirty)

  return (
    <ProjectLayout>
      <main className="project-page configuration-editor">
        <div className="breadcrumbs">
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <Link to={projectPath(project.id)}>{project.name}</Link>
          <span aria-hidden="true">/</span>
          <span>Taxonomy editor</span>
        </div>
        <div className="page-heading configuration-editor__heading">
          <div>
            <p className="eyebrow">Project configuration</p>
            <h1>Taxonomy editor</h1>
            <p>
              Editing active v{activeVersion}{' '}
              <span className="taxonomy-schema-version">Schema v1</span>. Saving
              creates and activates an immutable version.
            </p>
          </div>
          <output
            className={`editor-save-state editor-save-state--${saveState.toLowerCase().replace(' ', '-')}`}
            aria-live="polite"
          >
            {saveState}
          </output>
        </div>

        {error && mode === 'yaml' && (
          <PageNotice title="Taxonomy needs attention" tone="error">
            <p>{error}</p>
          </PageNotice>
        )}
        {notice && (
          <PageNotice title="Taxonomy saved">
            <p>{notice}</p>
          </PageNotice>
        )}

        <div className="configuration-toolbar taxonomy-toolbar">
          <TaxonomyModeSwitch mode={mode} onChange={setMode} />
          <div className="configuration-toolbar__actions">
            <button
              type="button"
              onClick={() =>
                downloadText(source, 'taxonomy.yaml', 'application/yaml')
              }
            >
              Download YAML
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={!dirty || Boolean(error) || saveState === 'Saving'}
              onClick={() => void save()}
            >
              {saveState === 'Saving' ? 'Saving…' : 'Save new version'}
            </button>
          </div>
        </div>

        {mode === 'yaml' ? (
          <section className="configuration-panel taxonomy-source-panel taxonomy-editor-surface">
            <label
              className="field taxonomy-source-field"
              htmlFor="taxonomy-source"
            >
              <span className="visually-hidden">Taxonomy YAML</span>
              <textarea
                id="taxonomy-source"
                className="code-textarea"
                value={source}
                onChange={(event) => changeSource(event.target.value)}
                spellCheck={false}
                rows={30}
                aria-describedby="taxonomy-yaml-help"
                aria-invalid={Boolean(error)}
              />
            </label>
            <p id="taxonomy-yaml-help" className="taxonomy-source-help">
              <span>YAML · schema version 1</span>
              <span>
                Ctrl+S saves valid changes. Invalid source stays local and
                cannot replace the saved version.
              </span>
            </p>
          </section>
        ) : (
          <StructuredTaxonomyEditor
            taxonomy={structured}
            validationError={error}
            onChange={changeStructured}
          />
        )}
      </main>
    </ProjectLayout>
  )
}

export function ProjectTaxonomyEditor() {
  const { projectId } = useParams()
  const state = useProject(projectId)
  if (state.loading) return <ProjectLayout>{null}</ProjectLayout>
  if (state.error)
    return (
      <ProjectPageState
        title="Taxonomy could not be loaded"
        message={state.error}
      />
    )
  if (!state.data)
    return (
      <ProjectPageState
        title="Project not found"
        message="The requested project does not exist in this browser."
      />
    )
  return <LoadedTaxonomyEditor aggregate={state.data} />
}
