import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { prepareInstructionsSource } from '../../domain/uploads'
import { projectPath } from '../../routes'
import {
  clearProjectInstructions,
  setProjectInstructions,
} from './projectActions'
import {
  downloadText,
  useEditorProtection,
  useUnsavedRouteProtection,
} from './editorBehavior'
import { MarkdownInstructions } from './MarkdownInstructions'
import { PageNotice, ProjectLayout, ProjectPageState } from './ProjectLayout'
import { useProject } from './projectHooks'

type SaveState = 'Saved' | 'Unsaved' | 'Saving' | 'Validation error'

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The instructions could not be saved.'
}

function LoadedInstructionsEditor({
  aggregate,
}: {
  aggregate: NonNullable<ReturnType<typeof useProject>['data']>
}) {
  const { project, instructions } = aggregate
  const initialSource = instructions?.rawMarkdown ?? ''
  const filename = instructions?.sourceFilename ?? 'instructions.md'
  const [source, setSource] = useState(initialSource)
  const [savedSource, setSavedSource] = useState(initialSource)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('Saved')

  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLElement>(null)
  const syncingScrollRef = useRef(false)

  const synchronizeScroll = (
    sourceElement: HTMLElement,
    targetElement: HTMLElement,
  ) => {
    if (syncingScrollRef.current) return

    const sourceRange = sourceElement.scrollHeight - sourceElement.clientHeight
    const targetRange = targetElement.scrollHeight - targetElement.clientHeight

    syncingScrollRef.current = true
    targetElement.scrollTop =
      sourceRange > 0
        ? (sourceElement.scrollTop / sourceRange) * targetRange
        : 0

    requestAnimationFrame(() => {
      syncingScrollRef.current = false
    })
  }

  const changeSource = (nextSource: string) => {
    setSource(nextSource)
    setDirty(nextSource !== savedSource)
    setNotice(null)
    try {
      prepareInstructionsSource(nextSource, filename)
      setError(null)
      setSaveState(nextSource === savedSource ? 'Saved' : 'Unsaved')
    } catch (validationError) {
      setError(messageFrom(validationError))
      setSaveState('Validation error')
    }
  }

  const save = async () => {
    if (!dirty || error || saveState === 'Saving') return
    setSaveState('Saving')
    setNotice(null)
    try {
      if (source.length === 0) {
        await clearProjectInstructions(project.id)
        setNotice('Project instructions were removed.')
      } else {
        await setProjectInstructions(
          project.id,
          prepareInstructionsSource(source, filename),
        )
        setNotice('Project instructions were saved locally.')
      }
      setDirty(false)
      setSavedSource(source)
      setSaveState('Saved')
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
          <span>Instructions editor</span>
        </div>
        <div className="page-heading configuration-editor__heading">
          <div>
            <p className="eyebrow">Project configuration</p>
            <h1>Instructions editor</h1>
            <p>Edit local Markdown and verify the safely rendered preview.</p>
          </div>
          <output
            className={`editor-save-state editor-save-state--${saveState.toLowerCase().replace(' ', '-')}`}
            aria-live="polite"
          >
            {saveState}
          </output>
        </div>

        {error && (
          <PageNotice title="Instructions need attention" tone="error">
            <p>{error}</p>
          </PageNotice>
        )}
        {notice && (
          <PageNotice title="Instructions saved">
            <p>{notice}</p>
          </PageNotice>
        )}

        <div className="configuration-toolbar">
          <span className="muted-copy">
            {filename} · 512 KB maximum file size
          </span>
          <div className="configuration-toolbar__actions">
            <button
              type="button"
              onClick={() =>
                downloadText(source, filename, 'text/markdown;charset=utf-8')
              }
            >
              Download Markdown
            </button>
            <button
              type="button"
              disabled={!source}
              onClick={() => changeSource('')}
            >
              Clear instructions
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={!dirty || Boolean(error) || saveState === 'Saving'}
              onClick={() => void save()}
            >
              {saveState === 'Saving' ? 'Saving…' : 'Save instructions'}
            </button>
          </div>
        </div>

        <div className="instructions-editor-grid">
          <section className="configuration-panel instructions-source-panel">
            <label
              className="field instructions-source-field"
              htmlFor="instructions-source"
            >
              <textarea
                ref={sourceRef}
                id="instructions-source"
                className="code-textarea"
                value={source}
                onChange={(event) => changeSource(event.target.value)}
                onScroll={(event) => {
                  if (previewRef.current) {
                    synchronizeScroll(event.currentTarget, previewRef.current)
                  }
                }}
                spellCheck
                placeholder="# Review instructions"
              />
            </label>
          </section>

          <section
            ref={previewRef}
            className="configuration-panel instructions-preview"
            aria-label="Rendered instructions preview"
            onScroll={(event) => {
              if (sourceRef.current) {
                synchronizeScroll(event.currentTarget, sourceRef.current)
              }
            }}
          >
            <div className="structured-taxonomy__heading">
              <div>
                <p className="eyebrow">Safe rendering</p>
                <h2>Preview</h2>
              </div>
            </div>
            {source ? (
              <MarkdownInstructions markdown={source} />
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
        </div>
      </main>
    </ProjectLayout>
  )
}

export function ProjectInstructionsEditor() {
  const { projectId } = useParams()
  const state = useProject(projectId)
  if (state.loading) return <ProjectLayout>{null}</ProjectLayout>
  if (state.error)
    return (
      <ProjectPageState
        title="Instructions could not be loaded"
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
  return <LoadedInstructionsEditor aggregate={state.data} />
}
