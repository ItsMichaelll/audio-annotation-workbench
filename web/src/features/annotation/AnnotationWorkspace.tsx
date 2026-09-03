import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { useConfirmation } from '../../components/confirmationContext'
import { StatusReadout } from '../../components/StatusReadout'
import { TransportBar } from '../../components/TransportBar'
import {
  annotationsEqual,
  createAnnotationDocument,
  normalizeAnnotation,
  setLabelAssignment,
  setRegionLabelAssignment,
  updateAssignment,
  validateSubmission,
} from '../../domain/annotations'
import { AutosaveRevisionGate } from '../../domain/autosave'
import { SnapshotHistory, type HistoryState } from '../../domain/history'
import {
  isEditableTarget,
  keyboardCommand,
  labelingShortcut,
} from '../../domain/keyboard'
import {
  getMediaSourceRegistry,
  registerRelinkSessionFile,
} from '../../domain/mediaSources'
import type {
  AnnotationDocument,
  LabelAssignment,
  ProjectAggregate,
  TaskRecord,
  TaxonomyVersion,
} from '../../domain/models'
import {
  parseAnnotationTaxonomy,
  type AnnotationTaxonomy,
} from '../../domain/annotationTaxonomy'
import {
  adjacentRegion,
  normalizeRegion,
  type RegionMetadata,
} from '../../domain/region'
import {
  assertRelinkSelectionMatchesTask,
  RelinkMismatchError,
} from '../../domain/relink'
import {
  nextActionableTask,
  nextActionableTaskAfterTransition,
  orderedTasks,
} from '../../domain/taskQueue'
import { annotationPath, editProjectPath, projectPath } from '../../routes'
import { getProjectRepository } from '../../storage/projectRepository'
import {
  WaveformEditor,
  type WaveformEditorHandle,
} from '../waveform/WaveformEditor'
import {
  PageNotice,
  ProjectLayout,
  ProjectPageState,
} from '../projects/ProjectLayout'
import layoutStyles from '../projects/ProjectLayout.module.css'
import { useProject } from '../projects/projectHooks'
import { AnnotationInspector } from './AnnotationInspector'
import styles from './AnnotationWorkspace.module.css'

type SaveState = 'Unsaved' | 'Saving' | 'Saved' | 'Save failed'
type AudioState =
  | { kind: 'loading'; message: string }
  | { kind: 'permission'; message: string }
  | { kind: 'missing'; message: string }
  | { kind: 'mismatch'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; url: string; name: string }

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.'
}

function annotationRegions(
  document: AnnotationDocument,
  taxonomy: AnnotationTaxonomy,
): RegionMetadata[] {
  return document.regions.map((region) => ({
    id: region.id,
    start: region.start,
    end: region.end,
    data: {
      color: region.assignments
        .map((assignment) =>
          taxonomy.labels.find((label) => label.id === assignment.labelId),
        )
        .find((label) => label?.color)?.color,
    },
  }))
}

function LoadedAnnotationRoute({
  aggregate,
  task,
}: {
  aggregate: ProjectAggregate
  task: TaskRecord
}) {
  const [loaded, setLoaded] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | {
        kind: 'ready'
        annotation: AnnotationDocument
        taxonomyVersion: TaxonomyVersion
        taxonomy: AnnotationTaxonomy
      }
  >({ kind: 'loading' })

  useEffect(() => {
    let current = true
    void getProjectRepository()
      .then(async (repository) => {
        const existing = await repository.getAnnotation(task.id)
        const taxonomyVersion = existing
          ? aggregate.taxonomyVersions.find(
              (item) => item.id === existing.taxonomyVersionId,
            )
          : aggregate.activeTaxonomyVersion
        if (!taxonomyVersion) {
          throw new Error(
            'The taxonomy version pinned to this annotation is missing. Return to the project; the draft was not changed.',
          )
        }
        const taxonomy = parseAnnotationTaxonomy(taxonomyVersion.document)
        const annotation =
          existing ??
          createAnnotationDocument({
            id: crypto.randomUUID(),
            projectId: aggregate.project.id,
            taskId: task.id,
            taxonomyVersionId: taxonomyVersion.id,
            now: new Date().toISOString(),
          })
        return { annotation, taxonomyVersion, taxonomy }
      })
      .then((result) => {
        if (current) setLoaded({ kind: 'ready', ...result })
      })
      .catch((error: unknown) => {
        if (current) setLoaded({ kind: 'error', message: messageFrom(error) })
      })
    return () => {
      current = false
    }
  }, [aggregate, task.id])

  if (loaded.kind === 'loading') {
    return <ProjectLayout>{null}</ProjectLayout>
  }
  if (loaded.kind === 'error') {
    return (
      <ProjectLayout>
        <main className={layoutStyles.page}>
          <PageNotice title="Task cannot be opened" tone="error">
            <p>{loaded.message}</p>
            <div className={styles.recoveryActions}>
              <ButtonLink to={projectPath(aggregate.project.id)}>
                Return to project
              </ButtonLink>
              <ButtonLink to={editProjectPath(aggregate.project.id)}>
                Replace taxonomy
              </ButtonLink>
            </div>
          </PageNotice>
        </main>
      </ProjectLayout>
    )
  }
  return (
    <ActiveAnnotationWorkspace
      key={task.id}
      aggregate={aggregate}
      task={task}
      initialAnnotation={loaded.annotation}
      taxonomyVersion={loaded.taxonomyVersion}
      taxonomy={loaded.taxonomy}
    />
  )
}

function ActiveAnnotationWorkspace({
  aggregate,
  task: initialTask,
  initialAnnotation,
  taxonomyVersion,
  taxonomy,
}: {
  aggregate: ProjectAggregate
  task: TaskRecord
  initialAnnotation: AnnotationDocument
  taxonomyVersion: TaxonomyVersion
  taxonomy: AnnotationTaxonomy
}) {
  const confirm = useConfirmation()
  const navigate = useNavigate()
  const waveformRef = useRef<WaveformEditorHandle>(null)
  const relinkInputRef = useRef<HTMLInputElement>(null)
  const documentRef = useRef(initialAnnotation)
  const historyRef = useRef(
    new SnapshotHistory(initialAnnotation, annotationsEqual),
  )
  const revisionRef = useRef(initialAnnotation.revision)
  const savedRevisionRef = useRef(initialAnnotation.revision)
  const autosaveTimerRef = useRef<number | null>(null)
  const saveGateRef = useRef(new AutosaveRevisionGate())
  const submitInFlightRef = useRef(false)
  const [task, setTask] = useState(initialTask)
  const [annotation, setAnnotation] = useState(initialAnnotation)
  const [saveState, setSaveState] = useState<SaveState>('Saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [audioState, setAudioState] = useState<AudioState>({
    kind: 'loading',
    message: 'Resolving local audio…',
  })
  const [audioRevision, setAudioRevision] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [zoom, setZoom] = useState(0)
  const [verticalScale, setVerticalScale] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [audioError, setAudioError] = useState<string | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [spectrumEnabled, setSpectrumEnabled] = useState(false)
  const [spectrogramEnabled, setSpectrogramEnabled] = useState(false)
  const [meterEnabled, setMeterEnabled] = useState(false)
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const readOnly = task.status === 'submitted'
  const ordered = useMemo(
    () => orderedTasks(aggregate.tasks),
    [aggregate.tasks],
  )
  const position = ordered.findIndex((item) => item.id === task.id) + 1
  const nextTask = nextActionableTask(aggregate.tasks, task.id)
  const regions = useMemo(
    () => annotationRegions(annotation, taxonomy),
    [annotation, taxonomy],
  )
  const selectedRegion =
    regions.find((region) => region.id === selectedRegionId) ?? null
  const previousRegion = adjacentRegion(regions, selectedRegionId, 'previous')
  const nextRegion = adjacentRegion(regions, selectedRegionId, 'next')

  const navigateRegion = useCallback(
    (direction: 'previous' | 'next') => {
      const destination = adjacentRegion(regions, selectedRegionId, direction)
      if (!destination) return
      setSelectedRegionId(destination.id)
      setLoopEnabled(true)
      waveformRef.current?.revealRegion(destination.start, destination.end)
    },
    [regions, selectedRegionId],
  )

  useEffect(() => {
    let disposed = false
    let objectUrl: string | null = null
    const resolve = async () => {
      setAudioState({ kind: 'loading', message: 'Resolving local audio…' })
      const reference = task.primaryMedia
      if (reference.kind === 'unresolved') {
        setAudioState({
          kind: 'missing',
          message:
            'The task audio is missing or unresolved. Relink the original local file to continue.',
        })
        return
      }
      const adapter = getMediaSourceRegistry().adapterFor(reference)
      if (!adapter) {
        setAudioState({
          kind: 'missing',
          message:
            'No compatible media-source adapter is available. Relink the audio file.',
        })
        return
      }
      try {
        const permission = await adapter.queryPermission(reference)
        if (disposed) return
        if (permission === 'prompt' || permission === 'denied') {
          setAudioState({
            kind: 'permission',
            message:
              permission === 'denied'
                ? 'Browser permission to read this saved audio source is denied. Grant access or relink the file.'
                : 'Browser permission is required to read this saved audio source.',
          })
          return
        }
        const resolved = await adapter.resolve(reference)
        if (disposed) return
        objectUrl = URL.createObjectURL(resolved.file)
        setAudioState({
          kind: 'ready',
          url: objectUrl,
          name: resolved.file.name,
        })
      } catch (error) {
        if (!disposed)
          setAudioState({ kind: 'error', message: messageFrom(error) })
      }
    }
    void resolve()
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [audioRevision, task.primaryMedia])

  const applyHistoryState = useCallback(
    (state: HistoryState<AnnotationDocument>) => {
      const bounded =
        duration > 0
          ? normalizeAnnotation(state.present, duration)
          : state.present
      const rebased = { ...bounded, revision: ++revisionRef.current }
      documentRef.current = rebased
      setAnnotation(rebased)
      setSaveState('Unsaved')
      setSaveError(null)
    },
    [duration],
  )

  const commit = useCallback(
    (mutate: (current: AnnotationDocument) => AnnotationDocument) => {
      if (readOnly) return
      const next = mutate(documentRef.current)
      if (annotationsEqual(historyRef.current.state.present, next)) return
      const revisioned = { ...next, revision: ++revisionRef.current }
      const state = historyRef.current.commit(revisioned)
      documentRef.current = state.present
      setAnnotation(state.present)
      setSaveState('Unsaved')
      setSaveError(null)
    },
    [readOnly],
  )

  const persist = useCallback(
    async (document: AnnotationDocument): Promise<boolean> => {
      const token = saveGateRef.current.issue()
      setSaveState('Saving')
      try {
        const repository = await getProjectRepository()
        const saved = await repository.saveAnnotationDraft(document)
        savedRevisionRef.current = Math.max(
          savedRevisionRef.current,
          saved.revision,
        )
        if (saveGateRef.current.isCurrent(token)) {
          setSaveState('Saved')
          setSaveError(null)
          setTask((current) =>
            current.status === 'unstarted'
              ? { ...current, status: 'draft' }
              : current,
          )
        }
        return true
      } catch (error) {
        if (saveGateRef.current.isCurrent(token)) {
          setSaveState('Save failed')
          setSaveError(messageFrom(error))
        }
        return false
      }
    },
    [],
  )

  useEffect(() => {
    if (readOnly || annotation.revision <= savedRevisionRef.current) return
    if (autosaveTimerRef.current !== null)
      window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null
      void persist(documentRef.current)
    }, 600)
    return () => {
      if (autosaveTimerRef.current !== null)
        window.clearTimeout(autosaveTimerRef.current)
    }
  }, [annotation.revision, persist, readOnly])

  const flush = useCallback(async () => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    if (documentRef.current.revision <= savedRevisionRef.current) return true
    return persist(documentRef.current)
  }, [persist])

  const navigateAfter = useCallback(
    (status: TaskRecord['status'], completionMessage: string) => {
      const eligible = nextActionableTaskAfterTransition(
        aggregate.tasks,
        task.id,
        status,
      )
      if (eligible) navigate(annotationPath(aggregate.project.id, eligible.id))
      else
        navigate(projectPath(aggregate.project.id), {
          state: { completionMessage },
        })
    },
    [aggregate.project.id, aggregate.tasks, navigate, task.id],
  )

  const submit = useCallback(async () => {
    if (readOnly || submitInFlightRef.current) return
    submitInFlightRef.current = true
    setSubmitting(true)
    setWorkflowError(null)
    try {
      if (loadStatus !== 'ready') {
        setWorkflowError('Load or relink the task audio before submitting.')
        return
      }
      if (!(await flush())) {
        setWorkflowError(
          'The latest draft could not be saved. Submission was stopped.',
        )
        return
      }
      const validation = validateSubmission(
        documentRef.current,
        taxonomy,
        duration,
        false,
      )
      if (!validation.valid) {
        setWorkflowError(validation.errors.join(' '))
        return
      }
      if (
        validation.empty &&
        !(await confirm({
          title: 'Submit an empty annotation?',
          message:
            'This confirms that the audio was reviewed and no regions or clip labels apply.',
          confirmLabel: 'Submit empty task',
        }))
      )
        return

      const repository = await getProjectRepository()
      const submitted = await repository.submitAnnotation(documentRef.current)
      documentRef.current = submitted
      setAnnotation(submitted)
      setTask((current) => ({ ...current, status: 'submitted' }))
      navigateAfter('submitted', 'All actionable tasks are complete.')
    } catch (error) {
      setWorkflowError(messageFrom(error))
    } finally {
      submitInFlightRef.current = false
      setSubmitting(false)
    }
  }, [confirm, duration, flush, loadStatus, navigateAfter, readOnly, taxonomy])

  const skip = useCallback(async () => {
    if (readOnly) return
    setWorkflowError(null)
    if (!(await flush())) {
      setWorkflowError(
        'The latest draft could not be saved. Navigation was stopped.',
      )
      return
    }
    try {
      const repository = await getProjectRepository()
      await repository.skipTask(aggregate.project.id, task.id)
      navigateAfter('skipped', 'No actionable tasks remain.')
    } catch (error) {
      setWorkflowError(messageFrom(error))
    }
  }, [aggregate.project.id, flush, navigateAfter, readOnly, task.id])

  const returnToProject = useCallback(async () => {
    if (await flush()) navigate(projectPath(aggregate.project.id))
    else
      setWorkflowError(
        'The latest draft could not be saved. Return was stopped.',
      )
  }, [aggregate.project.id, flush, navigate])

  const replaceRegion = useCallback(
    (region: RegionMetadata, history: boolean) => {
      const bounds = normalizeRegion(region.start, region.end, duration)
      if (!bounds) return
      const mutate = (current: AnnotationDocument) => ({
        ...current,
        regions: current.regions.map((item) =>
          item.id === region.id ? { ...item, ...bounds } : item,
        ),
      })
      if (history) commit(mutate)
      else {
        // WaveSurfer owns continuous drag rendering. Updating React state for
        // every pointer event feeds the controlled bounds back into the plugin
        // and makes dragging visibly stutter. Keep the latest bounded geometry
        // for the eventual commit without rerendering during the gesture.
        const next = mutate(documentRef.current)
        documentRef.current = next
      }
    },
    [commit, duration],
  )

  const toggleLabel = useCallback(
    (target: 'region' | 'clip', labelId: string) => {
      commit((current) => {
        if (target === 'clip') {
          const exists = current.clipAssignments.some(
            (item) => item.labelId === labelId,
          )
          return {
            ...current,
            clipAssignments: setLabelAssignment(
              current.clipAssignments,
              labelId,
              !exists,
            ),
          }
        }
        if (!selectedRegionId) return current
        return {
          ...current,
          regions: current.regions.map((region) => {
            if (region.id !== selectedRegionId) return region
            return {
              ...region,
              assignments: setRegionLabelAssignment(
                region.assignments,
                labelId,
              ),
            }
          }),
        }
      })
    },
    [commit, selectedRegionId],
  )

  const assignmentChange = useCallback(
    (
      target: 'region' | 'clip',
      labelId: string,
      values: Pick<LabelAssignment, 'severity' | 'confidence'>,
    ) => {
      commit((current) =>
        target === 'clip'
          ? {
              ...current,
              clipAssignments: updateAssignment(
                current.clipAssignments,
                labelId,
                values,
              ),
            }
          : {
              ...current,
              regions: current.regions.map((region) =>
                region.id === selectedRegionId
                  ? {
                      ...region,
                      assignments: updateAssignment(
                        region.assignments,
                        labelId,
                        values,
                      ),
                    }
                  : region,
              ),
            },
      )
    },
    [commit, selectedRegionId],
  )

  const deleteSelectedRegion = useCallback(() => {
    if (!selectedRegionId) return
    commit((current) => ({
      ...current,
      regions: current.regions.filter(
        (region) => region.id !== selectedRegionId,
      ),
    }))
    setSelectedRegionId(null)
    setLoopEnabled(false)
  }, [commit, selectedRegionId])

  const undo = useCallback(
    () => applyHistoryState(historyRef.current.undo()),
    [applyHistoryState],
  )
  const redo = useCallback(
    () => applyHistoryState(historyRef.current.redo()),
    [applyHistoryState],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const command = keyboardCommand(event)
      if (command) {
        event.preventDefault()
        switch (command.type) {
          case 'toggle-playback':
            if (loadStatus === 'ready') waveformRef.current?.playPause()
            break
          case 'move-playhead':
            if (loadStatus === 'ready')
              waveformRef.current?.seekBy(command.seconds)
            break
          case 'seek-boundary':
            if (loadStatus === 'ready')
              waveformRef.current?.seekTo(
                command.boundary === 'start' ? 0 : duration,
              )
            break
          case 'fit':
            waveformRef.current?.fit()
            break
          case 'zoom':
            waveformRef.current?.zoom(command.direction)
            break
          case 'toggle-loop':
            if (selectedRegionId) setLoopEnabled((value) => !value)
            break
          case 'delete-region':
            if (!readOnly) deleteSelectedRegion()
            break
          case 'clear-selection':
            setSelectedRegionId(null)
            setLoopEnabled(false)
            break
          case 'undo':
            if (!readOnly) undo()
            break
          case 'redo':
            if (!readOnly) redo()
            break
          case 'submit-next':
            void submit()
            break
          case 'skip-next':
            void skip()
            break
          case 'navigate-region':
            if (loadStatus === 'ready') navigateRegion(command.direction)
            break
        }
        return
      }
      if (readOnly) return
      const labelId = labelingShortcut(event, taxonomy.labels)
      if (!labelId) return
      const label = taxonomy.labels.find((item) => item.id === labelId)
      const target = selectedRegionId ? 'region' : 'clip'
      if (!label?.scopes.includes(target)) return
      event.preventDefault()
      toggleLabel(target, labelId)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    deleteSelectedRegion,
    duration,
    loadStatus,
    navigateRegion,
    readOnly,
    redo,
    selectedRegionId,
    skip,
    submit,
    taxonomy.labels,
    toggleLabel,
    undo,
  ])

  const grantPermission = async () => {
    const adapter = getMediaSourceRegistry().adapterFor(task.primaryMedia)
    if (!adapter) return
    try {
      const permission = await adapter.requestPermission(task.primaryMedia)
      if (permission !== 'granted')
        throw new Error(
          'Permission was not granted. You can relink the file instead.',
        )
      setAudioRevision((value) => value + 1)
    } catch (error) {
      setAudioState({ kind: 'error', message: messageFrom(error) })
    }
  }

  const relink = async (file: File | undefined) => {
    if (!file) return
    try {
      const selection = {
        name: file.name,
        size: file.size,
        ...(file.webkitRelativePath
          ? { relativePath: file.webkitRelativePath }
          : {}),
      }
      assertRelinkSelectionMatchesTask(task, selection)
      const locator = `relink:${task.id}:${file.name}:${file.size}:${file.lastModified}`
      const source = {
        kind: 'external-reference' as const,
        locator,
        displayName: file.name,
        permission: 'granted' as const,
      }
      const repository = await getProjectRepository()
      await repository.relinkTask(
        aggregate.project.id,
        task.id,
        source,
        selection,
      )
      registerRelinkSessionFile(task, locator, file)
      setTask((current) => ({ ...current, primaryMedia: source }))
      setAudioRevision((value) => value + 1)
    } catch (error) {
      if (error instanceof RelinkMismatchError) {
        setAudioState({ kind: 'mismatch', message: error.message })
        return
      }
      setAudioState({ kind: 'error', message: messageFrom(error) })
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.projectName}>{aggregate.project.name}</span>
          <strong className={styles.taskName}>
            {task.displayName ?? task.primaryMedia.displayName}
          </strong>
          <small className={styles.taskMeta}>
            Task {position} of {ordered.length} · Taxonomy v
            {taxonomyVersion.version}
          </small>
        </div>
        <output
          className={`${styles.saveState} ${
            saveState === 'Unsaved'
              ? styles.unsaved
              : saveState === 'Saving'
                ? styles.saving
                : saveState === 'Save failed'
                  ? styles.saveFailed
                  : ''
          }`}
          aria-live="polite"
        >
          {saveState}
        </output>
        <div className={styles.headerActions}>
          <Button type="button" onClick={() => void returnToProject()}>
            Return to Project
          </Button>
          {!readOnly && (
            <Button type="button" onClick={() => void skip()}>
              Skip &amp; Next
            </Button>
          )}
          {!readOnly && (
            <Button
              variant="primary"
              type="button"
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting
                ? 'Submitting…'
                : nextTask
                  ? 'Submit & Next'
                  : 'Submit Task'}
            </Button>
          )}
        </div>
      </header>
      <div className={styles.notices}>
        {readOnly && (
          <div className={styles.workspaceNotice}>
            Submitted task · read-only. Reopen it from the project page to make
            changes.
          </div>
        )}
        {(workflowError || saveError) && (
          <div className={styles.errorBanner} role="alert">
            <strong className={styles.errorTitle}>Annotation notice</strong>
            <span>{workflowError ?? saveError}</span>
          </div>
        )}
      </div>
      <StatusReadout
        fileName={
          audioState.kind === 'ready'
            ? audioState.name
            : task.primaryMedia.displayName
        }
        duration={duration}
        currentTime={currentTime}
        zoom={zoom}
        verticalScale={verticalScale}
        isPlaying={isPlaying}
        selectedRegion={selectedRegion}
      />
      <TransportBar
        isLoaded={loadStatus === 'ready'}
        isPlaying={isPlaying}
        loopEnabled={loopEnabled}
        spectrogramEnabled={spectrogramEnabled}
        spectrumEnabled={spectrumEnabled}
        meterEnabled={meterEnabled}
        hasSelection={selectedRegion !== null}
        canDelete={!readOnly && selectedRegion !== null}
        canPreviousRegion={previousRegion !== null}
        canNextRegion={nextRegion !== null}
        verticalScale={verticalScale}
        onPlayPause={() => waveformRef.current?.playPause()}
        onFit={() => waveformRef.current?.fit()}
        onZoomIn={() => waveformRef.current?.zoom('in')}
        onZoomOut={() => waveformRef.current?.zoom('out')}
        onResetVerticalScale={() => waveformRef.current?.resetVerticalScale()}
        onToggleLoop={() => setLoopEnabled((value) => !value)}
        onDelete={deleteSelectedRegion}
        onPreviousRegion={() => navigateRegion('previous')}
        onNextRegion={() => navigateRegion('next')}
        onToggleSpectrogram={() => setSpectrogramEnabled((value) => !value)}
        onToggleSpectrum={() => {
          const enabled = !spectrumEnabled
          setSpectrumEnabled(enabled)
          if (enabled) waveformRef.current?.activateSpectrum()
        }}
        onToggleMeter={() => {
          const enabled = !meterEnabled
          setMeterEnabled(enabled)
          if (enabled) waveformRef.current?.activateMeter()
        }}
      />
      <main className={styles.workspace}>
        <section className={styles.editor} aria-label="Task waveform editor">
          {audioState.kind !== 'ready' ? (
            <div
              className={`${styles.sourceRecovery}${
                audioState.kind === 'loading'
                  ? ''
                  : ` ${styles.sourceRecoveryError}`
              }`}
              role="status"
            >
              <h2 className={styles.sourceRecoveryTitle}>
                {audioState.kind === 'loading'
                  ? 'Loading task audio'
                  : 'Error: Audio file not found'}
              </h2>
              {audioState.kind === 'mismatch' ? (
                <div>
                  <p className={styles.sourceRecoveryDescription}>
                    The uploaded file doesn't match the original.
                  </p>
                  <p className={styles.sourceRecoveryDescription}>
                    {audioState.message}
                  </p>
                  <p className={styles.sourceRecoveryDescription}>
                    Please re-upload the original file to continue.
                  </p>
                </div>
              ) : audioState.kind === 'error' ? (
                <div>
                  <p className={styles.sourceRecoveryDescription}>
                    {audioState.message}
                  </p>
                  <p className={styles.sourceRecoveryDescription}>
                    This often happens when you close the browser tab or refresh
                    the page.
                  </p>
                  <p className={styles.sourceRecoveryDescription}>
                    Don't worry; your task progress is saved locally and should
                    be preserved.
                  </p>
                  <p className={styles.sourceRecoveryDescription}>
                    Just re-upload the original file below to pick up where you
                    left off.
                  </p>
                </div>
              ) : (
                <p className={styles.sourceRecoveryDescription}>
                  {audioState.message}
                </p>
              )}
              <input
                ref={relinkInputRef}
                className="u-visually-hidden"
                type="file"
                accept="audio/*,.wav,.wave,.flac,.mp3,.m4a,.aac,.aif,.aiff,.ogg,.oga,.opus,.webm"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  void relink(file)
                }}
              />
              <div className={styles.sourceRecoveryActions}>
                {audioState.kind === 'permission' && (
                  <Button type="button" onClick={() => void grantPermission()}>
                    Grant file permission
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => relinkInputRef.current?.click()}
                >
                  Upload audio file
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.editorSurface}>
              {loadStatus === 'loading' && (
                <div className={styles.loadingOverlay} role="status">
                  <span
                    className={styles.loadingIndicator}
                    aria-hidden="true"
                  />
                  Decoding waveform…
                </div>
              )}
              {audioError && (
                <div className={styles.errorBanner} role="alert">
                  <strong className={styles.errorTitle}>Audio notice</strong>
                  <span>{audioError}</span>
                </div>
              )}
              <WaveformEditor
                ref={waveformRef}
                audioUrl={audioState.url}
                regions={regions}
                selectedRegionId={selectedRegionId}
                loopEnabled={loopEnabled}
                meterEnabled={meterEnabled}
                spectrumEnabled={spectrumEnabled}
                spectrogramEnabled={spectrogramEnabled}
                isPlaying={isPlaying}
                readOnly={readOnly}
                onLoading={() => setLoadStatus('loading')}
                onReady={(value) => {
                  setDuration(value)
                  const normalized = normalizeAnnotation(
                    documentRef.current,
                    value,
                  )
                  if (!annotationsEqual(normalized, documentRef.current)) {
                    const bounded = readOnly
                      ? normalized
                      : {
                          ...normalized,
                          revision: ++revisionRef.current,
                        }
                    historyRef.current.reset(bounded)
                    documentRef.current = bounded
                    setAnnotation(bounded)
                    if (!readOnly) {
                      setSaveState('Unsaved')
                      setSaveError(null)
                    }
                  }
                  setLoadStatus('ready')
                  setAudioError(null)
                }}
                onError={(message) => {
                  setAudioError(message)
                  if (message.startsWith('Unable to load audio'))
                    setLoadStatus('error')
                }}
                onTimeChange={setCurrentTime}
                onPlaybackChange={setIsPlaying}
                onZoomChange={setZoom}
                onVerticalScaleChange={setVerticalScale}
                onRegionCreate={(region) =>
                  commit((current) => ({
                    ...current,
                    regions: [
                      ...current.regions,
                      {
                        id: region.id,
                        start: region.start,
                        end: region.end,
                        assignments: [],
                      },
                    ],
                  }))
                }
                onRegionLiveChange={(region) => replaceRegion(region, false)}
                onRegionCommit={(region) => replaceRegion(region, true)}
                onRegionSelect={(id) => {
                  setSelectedRegionId(id)
                  setLoopEnabled(true)
                }}
                onClearRegionSelection={() => {
                  setSelectedRegionId(null)
                  setLoopEnabled(false)
                }}
                onHideSpectrogram={() => setSpectrogramEnabled(false)}
                onHideSpectrum={() => setSpectrumEnabled(false)}
                onHideMeter={() => setMeterEnabled(false)}
              />
            </div>
          )}
          <footer className={styles.editorFooter}>
            <span>
              {regions.length} {regions.length === 1 ? 'region' : 'regions'}
            </span>
            <span>{loopEnabled ? 'Selected region loops' : 'Loop off'}</span>
            <span>Drafts stay in this browser</span>
          </footer>
        </section>
        <AnnotationInspector
          annotation={annotation}
          taxonomy={taxonomy}
          selectedRegionId={selectedRegionId}
          instructions={aggregate.instructions?.rawMarkdown ?? null}
          readOnly={readOnly}
          onToggleLabel={toggleLabel}
          onAssignmentChange={assignmentChange}
          onRegionNotesChange={(notes) =>
            commit((current) => ({
              ...current,
              regions: current.regions.map((region) => {
                if (region.id !== selectedRegionId) return region
                if (notes) return { ...region, notes }
                const withoutNotes = { ...region }
                delete withoutNotes.notes
                return withoutNotes
              }),
            }))
          }
          onTaskNotesChange={(taskNotes) =>
            commit((current) => {
              if (taskNotes) return { ...current, taskNotes }
              const withoutTaskNotes = { ...current }
              delete withoutTaskNotes.taskNotes
              return withoutTaskNotes
            })
          }
        />
      </main>
    </div>
  )
}

export function AnnotationWorkspace() {
  const { projectId, taskId } = useParams()
  const state = useProject(projectId)
  if (state.loading) return <ProjectLayout>{null}</ProjectLayout>
  if (state.error)
    return (
      <ProjectPageState
        title="Project could not be loaded"
        message={state.error}
      />
    )
  if (!state.data || !projectId)
    return (
      <ProjectPageState
        title="Project not found"
        message="Return to Projects and choose a project stored in this browser."
      />
    )
  const task = state.data.tasks.find((item) => item.id === taskId)
  if (!task)
    return (
      <ProjectPageState
        title="Task not found"
        message="This task is no longer in the project. Return to the project task list."
      />
    )
  if (task.status === 'skipped' || task.status === 'blocked') {
    return (
      <ProjectPageState
        title="Task is not actionable"
        message="Restore this task to unstarted from the project page before labeling it."
      />
    )
  }
  if (state.data.project.status === 'archived' && task.status !== 'submitted') {
    return (
      <ProjectPageState
        title="Project is archived"
        message="Restore the project before continuing annotation work."
      />
    )
  }
  return <LoadedAnnotationRoute aggregate={state.data} task={task} />
}
