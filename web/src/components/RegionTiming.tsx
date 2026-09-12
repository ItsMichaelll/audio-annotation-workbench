import { useId, useState } from 'react'
import type { RegionMetadata } from '../domain/region'
import styles from './RegionTiming.module.css'

export function RegionTiming({
  region,
  duration,
  readOnly = false,
  onChange,
}: {
  region: Pick<RegionMetadata, 'id' | 'start' | 'end'>
  duration: number
  readOnly?: boolean
  onChange: (start: number, end: number) => void
}) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const commit = (start: number, end: number, input: HTMLInputElement) => {
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > duration ||
      end - start < 0.001
    ) {
      setError('Use valid times within the file, with the end after the start.')
      input.value = Number(input.dataset.original).toFixed(3)
      return
    }
    setError(null)
    if (start !== region.start || end !== region.end) onChange(start, end)
  }
  return (
    <div className={styles.root}>
      <div className={styles.fields}>
        {(['start', 'end'] as const).map((name) => (
          <label key={`${region.id}-${name}-${region[name]}`}>
            <span>
              {name === 'start' ? 'Start' : 'End'} <small>seconds</small>
            </span>
            <input
              type="number"
              step="0.001"
              min="0"
              max={duration}
              defaultValue={region[name].toFixed(3)}
              data-original={region[name]}
              disabled={readOnly || duration <= 0}
              aria-describedby={error ? id : undefined}
              aria-invalid={Boolean(error)}
              onBlur={(event) =>
                commit(
                  name === 'start' ? event.target.valueAsNumber : region.start,
                  name === 'end' ? event.target.valueAsNumber : region.end,
                  event.target,
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p className={styles.error} id={id} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
