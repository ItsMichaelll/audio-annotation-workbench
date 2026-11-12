import { useEffect, useRef, useState } from 'react'
import type {
  InspectionScore,
  TranscriptRow,
} from '../../domain/inspectionEvidence'
import { formatTime } from '../../domain/transport'
import styles from './InspectionEvidencePanel.module.css'

const PAGE_SIZE = 50

export function InspectionEvidencePanel({
  transcript,
  scores,
  currentTime,
  onSeek,
  onImport,
}: {
  transcript: readonly TranscriptRow[]
  scores: readonly InspectionScore[]
  currentTime: number
  onSeek(start: number, end: number): void
  onImport?: ((value: Record<string, unknown>) => void) | undefined
}) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)
  const importGeneration = useRef(0)
  useEffect(
    () => () => {
      importGeneration.current++
    },
    [],
  )
  const rows = transcript.filter((row) =>
    `${row.speaker} ${row.text}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <div className={styles.root}>
      {onImport && (
        <label>
          Open local transcript or score JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              const generation = ++importGeneration.current
              setError(null)
              if (file.size > 1024 * 1024) {
                setError('Evidence JSON must be at most 1 MB.')
                return
              }
              void file
                .text()
                .then((raw) => {
                  if (generation !== importGeneration.current) return
                  const parsed: unknown = JSON.parse(raw)
                  if (
                    typeof parsed !== 'object' ||
                    parsed === null ||
                    Array.isArray(parsed)
                  )
                    throw new Error(
                      'Evidence must be a JSON object with transcript or scores arrays.',
                    )
                  if (!('transcript' in parsed) && !('scores' in parsed))
                    throw new Error('Include a transcript or scores array.')
                  onImport(Object.fromEntries(Object.entries(parsed)))
                })
                .catch((failure: unknown) => {
                  if (generation !== importGeneration.current) return
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : 'Could not read evidence JSON.',
                  )
                })
            }}
          />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {transcript.length > 0 && (
        <section aria-label="Supplied transcript">
          <label>
            Search transcript
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setLimit(PAGE_SIZE)
              }}
            />
          </label>
          <p>{rows.length} rows · supplied local transcript</p>
          {rows.slice(0, limit).map((row) => (
            <button
              key={row.id}
              type="button"
              className={styles.row}
              aria-current={
                currentTime >= row.start && currentTime < row.end
                  ? 'time'
                  : undefined
              }
              onClick={() => onSeek(row.start, row.end)}
            >
              <span>
                {row.speaker} · {formatTime(row.start)}
              </span>
              <strong>{row.text}</strong>
            </button>
          ))}
          {rows.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((value) => value + PAGE_SIZE)}
            >
              Show next {PAGE_SIZE} rows
            </button>
          )}
        </section>
      )}
      {scores.length > 0 && (
        <section aria-label="Supplied measurements">
          <h3>Supplied measurements</h3>
          {scores.map((score) => (
            <div key={score.id} className={styles.score}>
              <strong>
                {score.name} · {score.value} {score.unit}
              </strong>
              <span>Source · {score.source}</span>
              {score.start !== undefined && score.end !== undefined && (
                <button
                  type="button"
                  onClick={() => onSeek(score.start ?? 0, score.end ?? 0)}
                >
                  Reveal evidence · {formatTime(score.start)}–
                  {formatTime(score.end)}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
