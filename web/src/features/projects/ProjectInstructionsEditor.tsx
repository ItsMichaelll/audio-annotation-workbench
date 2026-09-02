import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '../../components/Button'
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
import styles from './ProjectInstructionsEditor.module.css'
import layoutStyles from './ProjectLayout.module.css'

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
      <main className={`${layoutStyles.page} ${styles.editor}`}>
        <div className={layoutStyles.breadcrumbs}>
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <Link to={projectPath(project.id)}>{project.name}</Link>
          <span aria-hidden="true">/</span>
          <span>Instructions editor</span>
        </div>
        <div className={`${layoutStyles.pageHeading} ${styles.heading}`}>
          <div>
            <p className={layoutStyles.eyebrow}>Project configuration</p>
            <h1 className={layoutStyles.pageHeadingTitle}>
              Instructions editor
            </h1>
            <p className={layoutStyles.pageHeadingDescription}>
              Edit local Markdown and verify the safely rendered preview.
            </p>
          </div>
          <output
            className={`${styles.saveState} ${
              saveState === 'Unsaved'
                ? styles.saveStateUnsaved
                : saveState === 'Saving'
                  ? styles.saveStateSaving
                  : saveState === 'Validation error'
                    ? styles.saveStateValidationError
                    : ''
            }`}
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

        <div className={styles.toolbar}>
          <span className={styles.mutedCopy}>
            {filename} · 512 KB maximum file size
          </span>
          <div className={styles.toolbarActions}>
            <Button
              type="button"
              onClick={() =>
                downloadText(source, filename, 'text/markdown;charset=utf-8')
              }
            >
              Download Markdown
            </Button>
            <Button
              type="button"
              disabled={!source}
              onClick={() => changeSource('')}
            >
              Clear instructions
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!dirty || Boolean(error) || saveState === 'Saving'}
              onClick={() => void save()}
            >
              {saveState === 'Saving' ? 'Saving…' : 'Save instructions'}
            </Button>
          </div>
        </div>

        <div className={styles.grid}>
          <section className={styles.sourcePanel}>
            <label className={styles.sourceField} htmlFor="instructions-source">
              <textarea
                ref={sourceRef}
                id="instructions-source"
                className={styles.sourceTextarea}
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
            className={styles.preview}
            aria-label="Rendered instructions preview"
            onScroll={(event) => {
              if (sourceRef.current) {
                synchronizeScroll(event.currentTarget, sourceRef.current)
              }
            }}
          >
            <div className={styles.previewHeading}>
              <div>
                <p className={layoutStyles.eyebrow}>Safe rendering</p>
                <h2 className={styles.previewTitle}>Preview</h2>
              </div>
            </div>
            {source ? (
              <MarkdownInstructions markdown={source} />
            ) : (
              <div className={styles.emptyState}>
                <h3 className={styles.emptyStateTitle}>
                  No instructions have been added.
                </h3>
                <p className={styles.mutedCopy}>
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
