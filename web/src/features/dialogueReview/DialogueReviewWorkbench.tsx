import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApplicationHeader } from '../../components/ApplicationHeader'
import { KeyboardHelp } from '../../components/KeyboardHelp'
import { EditorFocusControls } from '../../components/EditorFocusControls'
import { useEditorFocus } from '../../components/useEditorFocus'
import workspaceStyles from '../../components/EditorWorkspace.module.css'
import { isDialogTarget, isEditableTarget } from '../../domain/keyboard'
import { SnapshotHistory } from '../../domain/history'
import type { RegionMetadata } from '../../domain/region'
import { formatTime } from '../../domain/transport'
import {
  clampReviewAdjustment,
  createSavedDialogueReview,
  effectiveTrackOffset,
  orderedTimingProposals,
  proposedReviewRange,
  type DialogueReviewInput,
  type SavedDialogueReview,
  type ReviewDecision,
  type ReviewVersion,
} from '../../domain/dialogueReview'
import {
  createDialogueReviewRepository,
  type DialogueReviewRepository,
} from '../../storage/dialogueReviewRepository'
import {
  WaveformEditor,
  type WaveformEditorHandle,
} from '../waveform/WaveformEditor'
import {
  alignedWaveformWav,
  SYNTHETIC_DIALOGUE_REVIEW,
} from './dialogueFixture'
import {
  usePairedPlayback,
  type DialogueAudioSource,
} from './usePairedPlayback'
import styles from './DialogueReviewWorkbench.module.css'
import { PlaybackListeningControls } from '../playback/PlaybackListeningControls'
import type { ListeningRange } from '../../domain/listeningNormalization'
import { DIALOGUE_REVIEW_SHORTCUTS } from './dialogueShortcuts'

const ignore = () => {}
const DEFAULT_REPOSITORY = (): DialogueReviewRepository => ({
  load: (input) =>
    createDialogueReviewRepository(window.localStorage).load(input),
  save: (input, review) =>
    createDialogueReviewRepository(window.localStorage).save(input, review),
})

export interface DialogueReviewWorkbenchProps {
  input: DialogueReviewInput
  sources?: readonly DialogueAudioSource[]
  repository?: DialogueReviewRepository
}

const sourceFileIdentities = new WeakMap<File, number>()
let nextSourceFileIdentity = 1

function sourceIdentity(source: DialogueAudioSource): readonly unknown[] {
  if (source.file && !sourceFileIdentities.has(source.file))
    sourceFileIdentities.set(source.file, nextSourceFileIdentity++)
  return [
    source.sourceId,
    source.url ?? null,
    source.file ? sourceFileIdentities.get(source.file) : null,
  ]
}

export function DialogueReviewFixture() {
  return <DialogueReviewWorkbench input={SYNTHETIC_DIALOGUE_REVIEW} />
}

/** The host supplies identities, source resolvers, and its existing decision adapter. */
export function DialogueReviewWorkbench(props: DialogueReviewWorkbenchProps) {
  const identity = JSON.stringify([
    props.input,
    props.sources?.map(sourceIdentity),
  ])
  return <DialogueReviewSession key={identity} {...props} />
}

function DialogueReviewSession({
  input,
  sources,
  repository,
}: DialogueReviewWorkbenchProps) {
  const focus = useEditorFocus()
  const [reviewRepository] = useState(() => repository ?? DEFAULT_REPOSITORY())
  const [initial] = useState(() => {
    try {
      return {
        review:
          reviewRepository.load(input) ?? createSavedDialogueReview(input),
        error: null,
      }
    } catch (cause) {
      return {
        review: createSavedDialogueReview(input),
        error:
          cause instanceof Error
            ? cause.message
            : 'Saved review could not be opened.',
      }
    }
  })
  const [review, setReview] = useState(initial.review)
  const historyRef = useRef(
    new SnapshotHistory<SavedDialogueReview>(
      initial.review,
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
    ),
  )
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const saveRevisionRef = useRef(0)
  const [error, setError] = useState<string | null>(initial.error)
  const [version, setVersion] = useState<ReviewVersion>('original')
  const [listening, setListening] = useState<'both' | string>('both')
  const [activeTrackId, setActiveTrackId] = useState(input.tracks[0].id)
  const [mutedTrackIds, setMutedTrackIds] = useState<string[]>([])
  const [collapsedTrackIds, setCollapsedTrackIds] = useState<string[]>([])
  const [partnerPeek, setPartnerPeek] = useState(false)
  const [spectrogramEnabled, setSpectrogramEnabled] = useState(false)
  const [spectrumEnabled, setSpectrumEnabled] = useState(false)
  const [meterEnabled, setMeterEnabled] = useState(false)
  const [viewport, setViewport] = useState<{
    zoom: number
    scrollLeft: number
  }>()
  const [loop, setLoop] = useState(false)
  const [regionSelection, setRegionSelection] = useState<{
    trackId: string
    regionId: string
  } | null>(null)
  const [regions, setRegions] = useState<
    Record<string, readonly RegionMetadata[]>
  >({})
  const handles = useRef<Record<string, WaveformEditorHandle | null>>({})
  const playback = usePairedPlayback(input, sources, meterEnabled)
  const [referenceRanges, setReferenceRanges] = useState<
    Record<string, ListeningRange[]>
  >({})
  const [clippingRanges, setClippingRanges] = useState<
    Record<string, ListeningRange[]>
  >({})
  const listeningCallbacks = useMemo(
    () =>
      new Map(
        input.tracks.map((track) => [
          track.id,
          {
            gain: (decibels: number) =>
              playback.setTrackGain(track.id, decibels),
            references: (ranges: ListeningRange[]) =>
              setReferenceRanges((previous) => ({
                ...previous,
                [track.id]: ranges,
              })),
            clipping: (ranges: ListeningRange[]) =>
              setClippingRanges((previous) => ({
                ...previous,
                [track.id]: ranges,
              })),
          },
        ]),
      ),
    [input.tracks, playback.setTrackGain],
  )
  const { buffers: sourceBuffers, setTracks } = playback
  const proposals = useMemo(
    () => orderedTimingProposals(input.proposals),
    [input],
  )
  const proposal =
    proposals.find((item) => item.id === review.activeProposalId) ?? null
  const decision = review.decisions.find(
    (item) => item.proposalId === proposal?.id,
  )
  const adjustment = decision?.adjustmentSeconds ?? 0
  const range = proposal
    ? version === 'original'
      ? proposal.original
      : proposedReviewRange(proposal, adjustment)
    : input.activeRange
  const selectedRegion = regionSelection
    ? regions[regionSelection.trackId]?.find(
        (item) => item.id === regionSelection.regionId,
      )
    : null
  const listeningRange = selectedRegion ?? range

  const persist = useCallback(
    (next: SavedDialogueReview, recordHistory = true) => {
      const result = recordHistory
        ? historyRef.current.commit(next).present
        : next
      setReview(result)
      if (initial.error) return
      const revision = ++saveRevisionRef.current
      saveQueueRef.current = saveQueueRef.current
        .then(() => reviewRepository.save(input, result))
        .then(() => {
          if (revision === saveRevisionRef.current) setError(null)
        })
        .catch((cause: unknown) => {
          if (revision === saveRevisionRef.current)
            setError(
              cause instanceof Error
                ? cause.message
                : 'Review could not be saved. Export your current review before closing.',
            )
        })
    },
    [initial.error, input, reviewRepository],
  )

  const updateDecision = (
    values: Partial<{
      decision: ReviewDecision
      adjustmentSeconds: number
      notes: string
    }>,
  ) => {
    if (!proposal) return
    const bounded =
      values.adjustmentSeconds === undefined
        ? values
        : {
            ...values,
            adjustmentSeconds: clampReviewAdjustment(
              input,
              proposal,
              values.adjustmentSeconds,
            ),
          }
    persist({
      ...review,
      decisions: review.decisions.map((item) =>
        item.proposalId === proposal.id ? { ...item, ...bounded } : item,
      ),
    })
  }

  const offsets = useMemo(
    () =>
      input.tracks.map((track) =>
        effectiveTrackOffset(track, proposal, version, adjustment),
      ),
    [adjustment, input, proposal, version],
  )
  useEffect(() => {
    const buffers = sourceBuffers
    if (!buffers) return
    setTracks(
      input.tracks.map((track, index) => ({
        id: track.id,
        buffer: buffers[index] ?? buffers[0],
        offsetSeconds: offsets[index] ?? track.offsetSeconds,
        muted:
          mutedTrackIds.includes(track.id) ||
          (listening !== 'both' && listening !== track.id),
      })),
    )
  }, [input, listening, mutedTrackIds, offsets, sourceBuffers, setTracks])

  const [waveforms, setWaveforms] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!sourceBuffers) return
    const urls: Record<string, string> = {}
    for (let index = 0; index < input.tracks.length; index++) {
      const track = input.tracks[index]
      const buffer = sourceBuffers[index]
      if (!track || !buffer) continue
      urls[track.id] = URL.createObjectURL(
        new Blob(
          [
            alignedWaveformWav(
              buffer,
              offsets[index] ?? 0,
              input.activeRange.end,
            ),
          ],
          { type: 'audio/wav' },
        ),
      )
    }
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) setWaveforms(urls)
    })
    return () => {
      disposed = true
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [input, offsets, sourceBuffers])

  const rawSeek = playback.seek
  const seek = useCallback(
    (time: number) => {
      if (loop && (time < listeningRange.start || time >= listeningRange.end))
        setLoop(false)
      rawSeek(time)
    },
    [listeningRange.end, listeningRange.start, loop, rawSeek],
  )
  const setPlaybackLoop = playback.setLoop
  const playPause = playback.playPause
  const playRegion = useCallback(
    (start: number, end: number) => {
      setLoop(true)
      setPlaybackLoop({ start, end })
      rawSeek(start)
      if (!playback.state.playing) playPause()
    },
    [playPause, playback.state.playing, rawSeek, setPlaybackLoop],
  )
  const controller = useMemo(
    () => ({
      playPause,
      seekTo: seek,
      playRegion,
      isPlaying: playback.state.playing,
    }),
    [playPause, playRegion, playback.state.playing, seek],
  )

  const onViewportChange = useCallback(
    (next: { zoom: number; scrollLeft: number }) => {
      setViewport((current) =>
        current &&
        Math.abs(current.zoom - next.zoom) < 0.01 &&
        Math.abs(current.scrollLeft - next.scrollLeft) < 0.5
          ? current
          : next,
      )
    },
    [],
  )

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        isEditableTarget(event.target) ||
        isDialogTarget(event.target)
      )
        return
      if (event.key.toLowerCase() === 'p') setPartnerPeek(true)
      if (event.key === ' ') {
        event.preventDefault()
        playPause()
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        seek(
          playback.state.time +
            (event.key === 'ArrowLeft' ? -1 : 1) *
              (event.shiftKey ? 0.25 : 0.05),
        )
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        persist(
          (event.shiftKey
            ? historyRef.current.redo()
            : historyRef.current.undo()
          ).present,
          false,
        )
      }
    }
    const stopPeek = () => setPartnerPeek(false)
    const keyup = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'p') stopPeek()
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', stopPeek)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', stopPeek)
    }
  }, [persist, playPause, playback.state.time, seek])

  const exportReview = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(review, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'dialogue-review.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div
      className={`${styles.shell} ${workspaceStyles.shell}`}
      data-editor-theme="light"
      data-focus-mode={focus.mode}
      data-inspector-in-focus={focus.inspectorInFocus}
    >
      <ApplicationHeader>
        <KeyboardHelp groups={DIALOGUE_REVIEW_SHORTCUTS} />
      </ApplicationHeader>
      <header className={styles.context}>
        <div>
          <h1>{input.title}</h1>
          <span>
            {proposals.length} timing proposals ·{' '}
            {
              review.decisions.filter((item) => item.decision !== 'pending')
                .length
            }{' '}
            reviewed
          </span>
        </div>
        <button type="button" onClick={exportReview}>
          Export review
        </button>
      </header>
      {(error || playback.error) && (
        <p className={styles.error} role="alert">
          {error ?? playback.error}
        </p>
      )}
      <main
        className={`${styles.workspace} ${workspaceStyles.workspace} ${workspaceStyles.withInspector}`}
      >
        <section
          className={`${styles.editor} ${workspaceStyles.editor}`}
          aria-label="Paired audio review"
        >
          <nav className={styles.toolbar} aria-label="Paired waveform controls">
            <button
              type="button"
              onClick={() =>
                Object.values(handles.current).forEach((handle) =>
                  handle?.zoom('out'),
                )
              }
            >
              − Zoom
            </button>
            <button
              type="button"
              onClick={() =>
                Object.values(handles.current).forEach((handle) =>
                  handle?.zoom('in'),
                )
              }
            >
              + Zoom
            </button>
            <button
              type="button"
              onClick={() =>
                Object.values(handles.current).forEach((handle) =>
                  handle?.fit(),
                )
              }
            >
              Fit
            </button>
            <label>
              Listen{' '}
              <select
                value={listening}
                onChange={(event) => setListening(event.target.value)}
              >
                <option value="both">Both tracks</option>
                {input.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name} only
                  </option>
                ))}
              </select>
            </label>
            <EditorFocusControls
              mode={focus.mode}
              onCycle={focus.cycle}
              inspectorInFocus={focus.inspectorInFocus}
              onInspectorInFocusChange={focus.setInspectorInFocus}
            />
            <button
              type="button"
              aria-pressed={spectrogramEnabled}
              onClick={() => setSpectrogramEnabled((value) => !value)}
            >
              Spectrogram
            </button>
            <button
              type="button"
              aria-pressed={spectrumEnabled}
              onClick={() => setSpectrumEnabled((value) => !value)}
            >
              Spectrum
            </button>
            <button
              type="button"
              aria-pressed={meterEnabled}
              onClick={() => setMeterEnabled((value) => !value)}
            >
              Meter
            </button>
          </nav>
          {!sourceBuffers ? (
            <div className={styles.load}>
              <h2>
                {sources
                  ? 'Open paired local audio'
                  : 'Generated two-track fixture'}
              </h2>
              <p>
                {sources
                  ? 'Audio remains in the browser and its local source service.'
                  : 'Two synthetic tone tracks demonstrate alignment and reversible timing proposals.'}
              </p>
              <button
                type="button"
                disabled={playback.loading}
                onClick={() => void playback.initialize()}
              >
                {playback.loading
                  ? 'Opening audio…'
                  : sources
                    ? 'Open audio'
                    : 'Load generated fixture'}
              </button>
            </div>
          ) : (
            input.tracks.map((track) => (
              <section
                className={`${styles.lane} ${workspaceStyles.editorSurface}`}
                key={track.id}
                aria-label={track.name}
              >
                <header>
                  <button
                    type="button"
                    aria-pressed={activeTrackId === track.id}
                    onClick={() => setActiveTrackId(track.id)}
                  >
                    {track.name}
                  </button>
                  <span>
                    Offset{' '}
                    {(offsets[input.tracks.indexOf(track)] ?? 0).toFixed(3)} s
                  </span>
                  <button
                    type="button"
                    aria-pressed={mutedTrackIds.includes(track.id)}
                    onClick={() =>
                      setMutedTrackIds((current) =>
                        current.includes(track.id)
                          ? current.filter((id) => id !== track.id)
                          : [...current, track.id],
                      )
                    }
                  >
                    Mute {track.name}
                  </button>
                  <button
                    type="button"
                    aria-expanded={
                      partnerPeek || !collapsedTrackIds.includes(track.id)
                    }
                    title="Hold P to temporarily reveal both aligned tracks"
                    onClick={() =>
                      setCollapsedTrackIds((current) =>
                        current.includes(track.id)
                          ? current.filter((id) => id !== track.id)
                          : [...current, track.id],
                      )
                    }
                  >
                    {collapsedTrackIds.includes(track.id)
                      ? 'Expand'
                      : 'Collapse'}{' '}
                    {track.name}
                  </button>
                </header>
                <div
                  hidden={collapsedTrackIds.includes(track.id) && !partnerPeek}
                >
                  {waveforms[track.id] && (
                    <WaveformEditor
                      ref={(handle) => {
                        handles.current[track.id] = handle
                      }}
                      audioUrl={waveforms[track.id] ?? ''}
                      audioIdentity={track.sourceId}
                      externalReferenceRanges={(
                        referenceRanges[track.id] ?? []
                      ).map((range) => ({
                        ...range,
                        start:
                          range.start +
                          (offsets[input.tracks.indexOf(track)] ?? 0),
                        end:
                          range.end +
                          (offsets[input.tracks.indexOf(track)] ?? 0),
                      }))}
                      externalPlaybackClippingRanges={(
                        clippingRanges[track.id] ?? []
                      ).map((range) => ({
                        ...range,
                        start:
                          range.start +
                          (offsets[input.tracks.indexOf(track)] ?? 0),
                        end:
                          range.end +
                          (offsets[input.tracks.indexOf(track)] ?? 0),
                      }))}
                      regions={regions[track.id] ?? []}
                      markers={
                        proposal
                          ? [
                              {
                                id: `${proposal.id}-original-start`,
                                time: proposal.original.start,
                              },
                              {
                                id: `${proposal.id}-original-end`,
                                time: proposal.original.end,
                              },
                              ...(version === 'proposed'
                                ? [
                                    {
                                      id: `${proposal.id}-proposed-start`,
                                      time: range.start,
                                    },
                                    {
                                      id: `${proposal.id}-proposed-end`,
                                      time: range.end,
                                    },
                                  ]
                                : []),
                            ]
                          : []
                      }
                      selectedRegionId={
                        regionSelection?.trackId === track.id
                          ? regionSelection.regionId
                          : null
                      }
                      selectedMarkerId={null}
                      loopEnabled={false}
                      meterEnabled={meterEnabled && activeTrackId === track.id}
                      reserveMeterSpace={meterEnabled}
                      spectrumEnabled={
                        spectrumEnabled && activeTrackId === track.id
                      }
                      spectrogramEnabled={
                        spectrogramEnabled && activeTrackId === track.id
                      }
                      externalDecodedAudio={
                        sourceBuffers[input.tracks.indexOf(track)] ??
                        sourceBuffers[0]
                      }
                      externalAnalysisOffset={
                        offsets[input.tracks.indexOf(track)] ?? 0
                      }
                      {...(playback.analysers[track.id]
                        ? { externalAnalyser: playback.analysers[track.id] }
                        : {})}
                      externalLoudnessSnapshot={
                        playback.liveLoudness[track.id] ?? null
                      }
                      inspectionRange={range}
                      activeRange={input.activeRange}
                      isPlaying={playback.state.playing}
                      externalTime={playback.state.time}
                      playbackController={controller}
                      mutePlayback
                      {...(viewport ? { viewport } : {})}
                      onViewportChange={onViewportChange}
                      onLoading={ignore}
                      onReady={ignore}
                      onError={setError}
                      onTimeChange={ignore}
                      onPlaybackChange={ignore}
                      onZoomChange={ignore}
                      onVerticalScaleChange={ignore}
                      onRegionCreate={(region) =>
                        setRegions((current) => ({
                          ...current,
                          [track.id]: [...(current[track.id] ?? []), region],
                        }))
                      }
                      onRegionLiveChange={(region) =>
                        setRegions((current) => ({
                          ...current,
                          [track.id]: (current[track.id] ?? []).map((item) =>
                            item.id === region.id ? region : item,
                          ),
                        }))
                      }
                      onRegionCommit={(region) =>
                        setRegions((current) => ({
                          ...current,
                          [track.id]: (current[track.id] ?? []).map((item) =>
                            item.id === region.id ? region : item,
                          ),
                        }))
                      }
                      onRegionSelect={(regionId) =>
                        setRegionSelection({ trackId: track.id, regionId })
                      }
                      onClearRegionSelection={() => setRegionSelection(null)}
                      onMarkerCommit={ignore}
                      onMarkerSelect={ignore}
                      onClearMarkerSelection={ignore}
                      onEditorFocusChange={ignore}
                      onHideSpectrogram={() => setSpectrogramEnabled(false)}
                      onHideSpectrum={() => setSpectrumEnabled(false)}
                      onHideMeter={() => setMeterEnabled(false)}
                    />
                  )}
                </div>
              </section>
            ))
          )}
          <section className={styles.ledger} aria-label="Timing proposals">
            <h2>Timing proposals</h2>
            {proposals.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={proposal?.id === item.id}
                onClick={() => {
                  setLoop(false)
                  setPlaybackLoop(null)
                  persist({ ...review, activeProposalId: item.id })
                  seek(item.original.start)
                }}
              >
                <span>
                  {formatTime(item.original.start)} –{' '}
                  {formatTime(item.original.end)}
                </span>
                <span>{(item.shiftSeconds * 1000).toFixed(0)} ms</span>
                <span>
                  {review.decisions.find(
                    (saved) => saved.proposalId === item.id,
                  )?.decision ?? 'pending'}
                </span>
              </button>
            ))}
          </section>
        </section>
        <aside
          className={styles.inspector}
          aria-label="Timing review inspector"
        >
          <h2>Timing review</h2>
          {proposal && (
            <>
              <p>{proposal.provenance}</p>
              <dl>
                <div>
                  <dt>Original bounds</dt>
                  <dd>
                    {formatTime(proposal.original.start)} –{' '}
                    {formatTime(proposal.original.end)}
                  </dd>
                </div>
                <div>
                  <dt>Proposed bounds</dt>
                  <dd>
                    {formatTime(
                      proposedReviewRange(proposal, adjustment).start,
                    )}{' '}
                    –{' '}
                    {formatTime(proposedReviewRange(proposal, adjustment).end)}
                  </dd>
                </div>
              </dl>
              <label>
                Adjustment (ms)
                <input
                  type="number"
                  step="1"
                  value={adjustment * 1000}
                  onChange={(event) => {
                    const value = event.target.valueAsNumber
                    if (Number.isFinite(value))
                      updateDecision({ adjustmentSeconds: value / 1000 })
                  }}
                />
              </label>
              <label>
                Review notes
                <textarea
                  value={decision?.notes ?? ''}
                  onChange={(event) =>
                    updateDecision({ notes: event.target.value })
                  }
                />
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  aria-pressed={decision?.decision === 'accepted'}
                  onClick={() => updateDecision({ decision: 'accepted' })}
                >
                  Accept
                </button>
                <button
                  type="button"
                  aria-pressed={decision?.decision === 'rejected'}
                  onClick={() => updateDecision({ decision: 'rejected' })}
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const index = proposals.findIndex(
                      (item) => item.id === proposal.id,
                    )
                    const next = proposals[(index + 1) % proposals.length]
                    if (next) {
                      setLoop(false)
                      setPlaybackLoop(null)
                      persist({ ...review, activeProposalId: next.id })
                      seek(next.original.start)
                    }
                  }}
                >
                  Next
                </button>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() =>
                    persist(historyRef.current.undo().present, false)
                  }
                >
                  Undo decision
                </button>
                <button
                  type="button"
                  onClick={() =>
                    persist(historyRef.current.redo().present, false)
                  }
                >
                  Redo decision
                </button>
              </div>
              <p>
                Decisions and notes save locally for this handoff. Audio sources
                remain unchanged.
              </p>
            </>
          )}
        </aside>
      </main>
      <nav className={styles.transport} aria-label="Paired playback">
        <button
          type="button"
          disabled={!playback.buffers}
          onClick={() => {
            setLoop(false)
            setPlaybackLoop(null)
            seek(input.activeRange.start)
          }}
        >
          Start
        </button>
        <button type="button" disabled={!playback.buffers} onClick={playPause}>
          {playback.state.playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          disabled={!playback.buffers}
          onClick={() => {
            setLoop(false)
            setPlaybackLoop(null)
            seek(input.activeRange.end)
          }}
        >
          End
        </button>
        <output>{formatTime(playback.state.time)}</output>
        <button
          type="button"
          disabled={!playback.buffers}
          aria-pressed={loop}
          onClick={() => {
            setLoop(!loop)
            setPlaybackLoop(loop ? null : listeningRange)
          }}
        >
          Loop selection
        </button>
        <label>
          Speed
          <select
            value={playback.state.rate}
            onChange={(event) => playback.setRate(Number(event.target.value))}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Timing comparison">
          <button
            type="button"
            aria-pressed={version === 'original'}
            onClick={() => setVersion('original')}
          >
            Original
          </button>
          <button
            type="button"
            aria-pressed={version === 'proposed'}
            onClick={() => setVersion('proposed')}
          >
            Proposed
          </button>
        </div>
        {input.tracks.map((track, index) => {
          const callbacks = listeningCallbacks.get(track.id)
          const buffer = sourceBuffers?.[index]
          if (!callbacks || !buffer) return null
          const offset = offsets[index] ?? 0
          return (
            <div key={track.sourceId} hidden={activeTrackId !== track.id}>
              <PlaybackListeningControls
                audioBuffer={buffer}
                mediaElement={null}
                sourceId={track.sourceId}
                audioIdentity={track.sourceId}
                hideSpeed
                currentSourceTime={Math.max(0, playback.state.time - offset)}
                setPlaybackGain={callbacks.gain}
                onReferenceRangesChange={callbacks.references}
                onPlaybackClippingChange={callbacks.clipping}
                onAudition={(start, end) =>
                  playRegion(start + offset, end + offset)
                }
              />
            </div>
          )
        })}
      </nav>
    </div>
  )
}
