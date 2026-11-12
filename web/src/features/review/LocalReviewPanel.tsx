import { useEffect, useRef, useState } from 'react'
import { SnapshotHistory, type HistoryState } from '../../domain/history'
import {
  decideProposal,
  exportLocalReview,
  parseLocalProposals,
  validEvidenceBounds,
  type LocalProposal,
  type LocalReviewContent,
  type LocalReviewSession,
} from '../../domain/localReview'
import { formatTime } from '../../domain/transport'
import {
  loadLocalReview,
  saveLocalReview,
} from '../../storage/localReviewRepository'
import styles from './LocalReviewPanel.module.css'

export interface LocalReviewPanelProps {
  sourceIdentity: string
  duration: number
  currentTime: number
  selection: { start: number; end: number } | null
  onReveal(start: number, end: number): void
  onLoopRange?(start: number, end: number): void
  onEvidenceRangeChange?(range: { start: number; end: number } | null): void
}

const PAGE_SIZE = 30

export function LocalReviewPanel(props: LocalReviewPanelProps) {
  return (
    <ReviewPanel key={`${props.sourceIdentity}/${props.duration}`} {...props} />
  )
}

function ReviewPanel({
  sourceIdentity,
  duration,
  currentTime,
  selection,
  onReveal,
  onLoopRange,
  onEvidenceRangeChange,
}: LocalReviewPanelProps) {
  const [session, setSession] = useState<LocalReviewSession | null>(null)
  const [saved, setSaved] = useState<LocalReviewSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'accepted' | 'dismissed'
  >('pending')
  const [visible, setVisible] = useState(true)
  const [rangeActive, setRangeActive] = useState(false)
  const [minimumScore, setMinimumScore] = useState('')
  const [page, setPage] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(Math.min(0.5, duration))
  const history = useRef(
    new SnapshotHistory<LocalReviewContent>({ decisions: [], feedback: [] }),
  )
  const [historyState, setHistoryState] = useState<
    HistoryState<LocalReviewContent>
  >({
    present: { decisions: [], feedback: [] },
    canUndo: false,
    canRedo: false,
  })
  const saveQueue = useRef(Promise.resolve())
  const fileInput = useRef<HTMLInputElement>(null)
  const importGeneration = useRef(0)
  const latestSession = useRef<LocalReviewSession | null>(null)
  const validRange = validEvidenceBounds(start, end, duration)

  useEffect(() => {
    latestSession.current = session
  }, [session])
  useEffect(
    () => () => {
      importGeneration.current++
    },
    [],
  )

  useEffect(() => {
    let disposed = false
    void loadLocalReview(sourceIdentity, duration)
      .then((loaded) => {
        if (disposed) return
        setSession(loaded)
        setSaved(loaded)
        setHistoryState(history.current.reset(loaded.content))
      })
      .catch((failure: unknown) => {
        if (!disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Local review could not be loaded.',
          )
      })
    return () => {
      disposed = true
    }
  }, [sourceIdentity, duration])

  useEffect(() => {
    if (!session || session === saved) return
    let disposed = false
    saveQueue.current = saveQueue.current
      .then(() => saveLocalReview(session))
      .then(() => {
        if (!disposed) {
          setSaved(session)
          setError(null)
        }
      })
      .catch((failure: unknown) => {
        if (!disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Local review could not be saved.',
          )
      })
    return () => {
      disposed = true
    }
  }, [session, saved])

  useEffect(() => {
    onEvidenceRangeChange?.(rangeActive && validRange ? { start, end } : null)
    return () => onEvidenceRangeChange?.(null)
  }, [start, end, rangeActive, validRange, onEvidenceRangeChange])

  if (!session)
    return (
      <section className={styles.root} aria-label="Local review">
        <p>{error ?? 'Loading local review…'}</p>
      </section>
    )

  const decisionFor = (id: string) =>
    session.content.decisions.find((decision) => decision.proposalId === id)
      ?.status ?? 'pending'
  const shown = session.proposals.filter(
    (proposal) =>
      (filter === 'all' || decisionFor(proposal.id) === filter) &&
      (minimumScore === '' ||
        proposal.score === undefined ||
        proposal.score >= Number(minimumScore)),
  )
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const active = session.proposals.find((proposal) => proposal.id === activeId)
  const noteKey = activeId ?? '__range__'
  const notes = Object.hasOwn(session.drafts, noteKey)
    ? (session.drafts[noteKey] ?? '')
    : ''

  function commit(content: LocalReviewContent) {
    const state = history.current.commit(content)
    setHistoryState(state)
    setSession((current) =>
      current ? { ...current, content: state.present } : current,
    )
  }

  function restore(state: HistoryState<LocalReviewContent>) {
    setHistoryState(state)
    setSession((current) =>
      current ? { ...current, content: state.present } : current,
    )
  }

  function select(proposal: LocalProposal) {
    setRangeActive(true)
    setActiveId(proposal.id)
    setStart(proposal.start)
    setEnd(proposal.end)
    onReveal(proposal.start, proposal.end)
  }

  function decide(status: 'accepted' | 'dismissed') {
    if (session && activeId)
      commit(decideProposal(session.content, activeId, status))
  }

  async function importProposals(file: File | undefined) {
    if (!file || !session) return
    const generation = ++importGeneration.current
    try {
      if (file.size > 4_000_000)
        throw new Error('Choose a proposal JSON file smaller than 4 MB.')
      const imported = parseLocalProposals(
        await file.text(),
        sourceIdentity,
        duration,
      )
      if (generation !== importGeneration.current) return
      const currentSession = latestSession.current
      if (!currentSession) return
      const merged = new Map(
        currentSession.proposals.map((proposal) => [proposal.id, proposal]),
      )
      for (const proposal of imported) {
        const original = merged.get(proposal.id)
        if (original && JSON.stringify(original) !== JSON.stringify(proposal))
          throw new Error(
            `Proposal ${proposal.id} already has different original evidence. Supply a new proposal id.`,
          )
        merged.set(proposal.id, proposal)
      }
      const proposals = [...merged.values()].sort(
        (a, b) =>
          a.start - b.start || a.end - b.end || a.id.localeCompare(b.id),
      )
      setSession((current) => (current ? { ...current, proposals } : current))
      setActiveId(null)
      setPage(0)
      setError(null)
    } catch (failure) {
      if (generation !== importGeneration.current) return
      setError(
        failure instanceof Error ? failure.message : 'Proposal import failed.',
      )
    }
  }

  function download() {
    if (!session) return
    const url = URL.createObjectURL(
      new Blob([exportLocalReview(session)], { type: 'application/json' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'local-audio-review.json'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  function next() {
    if (!shown.length) return
    const index = shown.findIndex((proposal) => proposal.id === activeId)
    const nextIndex = (index + 1) % shown.length
    const proposal = shown[nextIndex]
    if (proposal) {
      select(proposal)
      setPage(Math.floor(nextIndex / PAGE_SIZE))
    }
  }

  return (
    <section
      className={styles.root}
      aria-label="Local review"
      tabIndex={0}
      onKeyDown={(event) => {
        const target = event.target
        if (
          target instanceof Element &&
          target.closest('input, textarea, select, [contenteditable="true"]')
        )
          return
        const key = event.key.toLowerCase()
        const modifier = event.ctrlKey || event.metaKey
        if (modifier && (key === 'z' || key === 'y')) {
          event.preventDefault()
          event.stopPropagation()
          restore(
            key === 'y' || event.shiftKey
              ? history.current.redo()
              : history.current.undo(),
          )
        } else if (
          event.key === 'Enter' &&
          event.target === event.currentTarget &&
          activeId
        ) {
          event.preventDefault()
          event.stopPropagation()
          decide('accepted')
        }
      }}
    >
      <header className={styles.header}>
        <h2>Local review</h2>
        <span>
          {session.proposals.length} proposals ·{' '}
          {session.content.feedback.length} feedback ranges
        </span>
        <span role="status">
          {error
            ? 'Save or import needs attention'
            : saved === session
              ? 'Saved locally'
              : 'Saving…'}
        </span>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="u-visually-hidden"
          aria-label="Import local review proposals"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void importProposals(file)
          }}
        />
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import proposals
        </button>
        <button type="button" onClick={download}>
          Export review
        </button>
        <button
          type="button"
          disabled={!historyState.canUndo}
          onClick={() => restore(history.current.undo())}
        >
          Undo review
        </button>
        <button
          type="button"
          disabled={!historyState.canRedo}
          onClick={() => restore(history.current.redo())}
        >
          Redo review
        </button>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
          <button
            type="button"
            onClick={() => {
              setSession({ ...session })
              setError(null)
            }}
          >
            Retry save
          </button>
        </p>
      )}
      {session.proposals.length > 0 && (
        <>
          <div className={styles.controls}>
            <button
              type="button"
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              Show proposals
            </button>
            <label>
              Status{' '}
              <select
                value={filter}
                onChange={(event) => {
                  const value = event.target.value
                  if (
                    value === 'all' ||
                    value === 'pending' ||
                    value === 'accepted' ||
                    value === 'dismissed'
                  )
                    setFilter(value)
                  setPage(0)
                }}
              >
                {(['pending', 'accepted', 'dismissed', 'all'] as const).map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
            {session.proposals.some(
              (proposal) => proposal.score !== undefined,
            ) && (
              <label>
                Minimum score{' '}
                <input
                  type="number"
                  step="any"
                  value={minimumScore}
                  onChange={(event) => {
                    setMinimumScore(event.target.value)
                    setPage(0)
                  }}
                />
              </label>
            )}
            <button type="button" disabled={!shown.length} onClick={next}>
              Next proposal
            </button>
            <button
              type="button"
              disabled={!activeId}
              onClick={() => decide('accepted')}
            >
              Accept
            </button>
            <button
              type="button"
              disabled={!activeId}
              onClick={() => decide('dismissed')}
            >
              Dismiss
            </button>
          </div>
          {visible && (
            <div className={styles.list}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Proposal</th>
                    <th>Source</th>
                    <th>Score</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {shown
                    .slice(
                      currentPage * PAGE_SIZE,
                      (currentPage + 1) * PAGE_SIZE,
                    )
                    .map((proposal) => (
                      <tr
                        key={proposal.id}
                        className={
                          activeId === proposal.id ? styles.selected : undefined
                        }
                        aria-current={
                          currentTime >= proposal.start &&
                          currentTime < proposal.end
                            ? 'time'
                            : undefined
                        }
                      >
                        <td>
                          <button
                            type="button"
                            onClick={() => select(proposal)}
                          >
                            {formatTime(proposal.start)} –{' '}
                            {formatTime(proposal.end)}
                          </button>
                        </td>
                        <td>{proposal.label}</td>
                        <td>{proposal.source}</td>
                        <td>{proposal.score ?? '—'}</td>
                        <td>{decisionFor(proposal.id)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className={styles.controls}>
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous page
              </button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <button
                type="button"
                disabled={currentPage >= pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Next page
              </button>
            </div>
          )}
        </>
      )}
      <div className={styles.feedback}>
        <h3>Feedback evidence{active ? ` · ${active.label}` : ''}</h3>
        <div className={styles.controls}>
          <button
            type="button"
            onClick={() => {
              setRangeActive(true)
              setActiveId(null)
              setStart(selection?.start ?? currentTime)
              setEnd(selection?.end ?? Math.min(duration, currentTime + 0.5))
            }}
          >
            Use current selection / playhead
          </button>
          <label>
            Start{' '}
            <input
              aria-label="Feedback range start"
              type="number"
              step="0.001"
              min={0}
              max={duration}
              value={Number.isFinite(start) ? start : ''}
              onChange={(event) => {
                setRangeActive(true)
                setStart(event.target.valueAsNumber)
              }}
            />
          </label>
          <label>
            End{' '}
            <input
              aria-label="Feedback range end"
              type="number"
              step="0.001"
              min={0}
              max={duration}
              value={Number.isFinite(end) ? end : ''}
              onChange={(event) => {
                setRangeActive(true)
                setEnd(event.target.valueAsNumber)
              }}
            />
          </label>
          <button
            type="button"
            disabled={!validRange}
            onClick={() => onReveal(start, end)}
          >
            Reveal range
          </button>
          {onLoopRange && (
            <button
              type="button"
              disabled={!validRange}
              onClick={() => onLoopRange(start, end)}
            >
              Loop feedback
            </button>
          )}
        </div>
        <label className={styles.notes}>
          Review notes
          <textarea
            value={notes}
            onChange={(event) =>
              setSession({
                ...session,
                drafts: { ...session.drafts, [noteKey]: event.target.value },
              })
            }
          />
        </label>
        <div className={styles.controls}>
          <button
            type="button"
            disabled={!validRange || !notes.trim()}
            onClick={() =>
              commit({
                ...session.content,
                feedback: [
                  ...session.content.feedback,
                  {
                    id: crypto.randomUUID(),
                    proposalId: activeId,
                    start,
                    end,
                    notes,
                  },
                ],
              })
            }
          >
            Save feedback evidence
          </button>
          <span>Notes and decisions stay separate from annotations.</span>
        </div>
        {session.content.feedback.length > 0 && (
          <ul className={styles.evidence}>
            {session.content.feedback.map((feedback) => (
              <li key={feedback.id}>
                <button
                  type="button"
                  onClick={() => {
                    setRangeActive(true)
                    setStart(feedback.start)
                    setEnd(feedback.end)
                    onReveal(feedback.start, feedback.end)
                  }}
                >
                  {formatTime(feedback.start)} – {formatTime(feedback.end)}
                </button>
                <span>{feedback.notes}</span>
                <button
                  type="button"
                  aria-label={`Remove feedback at ${formatTime(feedback.start)}`}
                  onClick={() =>
                    commit({
                      ...session.content,
                      feedback: session.content.feedback.filter(
                        (item) => item.id !== feedback.id,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
