import { useState } from 'react'
import type { RegionMetadata } from '../domain/region'
import { formatTime } from '../domain/transport'
import { Icon } from './Icon'
import styles from './RegionList.module.css'

export function RegionList({
  regions,
  selectedRegionId,
  onSelect,
  onAdd,
  canAdd,
  labels,
  issues = [],
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  regions: readonly RegionMetadata[]
  selectedRegionId: string | null
  onSelect: (region: RegionMetadata) => void
  onAdd: () => void
  canAdd: boolean
  labels?: Record<string, string>
  issues?: string[]
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}) {
  const [filter, setFilter] = useState<'all' | 'unlabeled'>('all')
  const ordered = [...regions].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id),
  )
  const shown =
    filter === 'unlabeled' && labels
      ? ordered.filter((region) => !labels[region.id])
      : ordered
  return (
    <section className={styles.root} aria-label="Regions">
      <header className={styles.header}>
        <h2 className={styles.title}>
          Regions <span>{regions.length.toString().padStart(2, '0')}</span>
        </h2>
        {labels && (
          <div className={styles.filters} aria-label="Filter regions">
            <button
              type="button"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={filter === 'unlabeled'}
              onClick={() => setFilter('unlabeled')}
            >
              Unlabeled{' '}
              <span>
                {ordered.filter((region) => !labels[region.id]).length}
              </span>
            </button>
          </div>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <Icon name="undo" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Icon name="redo" />
          </button>
          <button
            type="button"
            className={styles.add}
            disabled={!canAdd}
            onClick={onAdd}
            title="Create a one-second region at the playhead"
          >
            <Icon name="plus" />
            Add region
          </button>
        </div>
      </header>
      {shown.length ? (
        <div className={styles.list}>
          <div className={styles.columnLabels} aria-hidden="true">
            <span>#</span>
            <span>{labels ? 'Annotation' : 'Region'}</span>
            <span>Start</span>
            <span>End</span>
            <span>Length</span>
            <span>State</span>
          </div>
          {shown.map((region) => (
            <button
              key={region.id}
              type="button"
              className={styles.row}
              aria-pressed={selectedRegionId === region.id}
              onClick={() => onSelect(region)}
            >
              <span className={styles.number}>
                {(ordered.indexOf(region) + 1).toString().padStart(2, '0')}
              </span>
              <span className={styles.name}>
                <i
                  style={{
                    background:
                      typeof region.data.color === 'string'
                        ? region.data.color
                        : 'var(--accent-primary)',
                  }}
                />
                {labels
                  ? (labels[region.id] ?? 'Unlabeled region')
                  : `Region ${ordered.indexOf(region) + 1}`}
              </span>
              <span className={styles.time}>{formatTime(region.start)}</span>
              <span className={styles.time}>{formatTime(region.end)}</span>
              <span className={styles.time}>
                {formatTime(region.end - region.start)}
              </span>
              <span className={styles.state}>
                {labels ? (
                  issues.includes(region.id) ? (
                    <>
                      <span className={styles.issueDot} />
                      Needs review
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={13} />
                      Labeled
                    </>
                  )
                ) : selectedRegionId === region.id ? (
                  'Selected'
                ) : (
                  '—'
                )}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Icon
            name={
              filter === 'unlabeled' && regions.length ? 'check' : 'waveform'
            }
            size={24}
          />
          <div>
            <strong>
              {filter === 'unlabeled' && regions.length
                ? 'Every region has a label'
                : 'Make the first mark.'}
            </strong>
            <p>
              {filter === 'unlabeled' && regions.length
                ? 'Select All to review your annotations.'
                : 'Drag across the waveform, or add a region at the playhead.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
