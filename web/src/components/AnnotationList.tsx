import { useId, useRef, useState } from 'react'
import type { MarkerAnnotation } from '../domain/models'
import type { RegionMetadata } from '../domain/region'
import { formatTime } from '../domain/transport'
import { Icon } from './Icon'
import { MarkerControls, type MarkerControlsProps } from './MarkerControls'
import { RegionControls, type RegionControlsProps } from './RegionControls'
import styles from './AnnotationList.module.css'

export function AnnotationList({
  regions,
  selectedRegionId,
  selectedRegionIds = selectedRegionId ? [selectedRegionId] : [],
  regionControls,
  onSelect,
  onAdd,
  canAdd,
  labels,
  issues = [],
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  markers,
  selectedMarkerId,
  onSelectMarker,
  markerControls,
}: {
  regions: readonly RegionMetadata[]
  selectedRegionId: string | null
  selectedRegionIds?: readonly string[]
  regionControls: Omit<
    RegionControlsProps,
    'onAdd' | 'canAdd' | 'selectedCount'
  >
  onSelect: (region: RegionMetadata, toggle: boolean) => void
  onAdd: () => void
  canAdd: boolean
  labels?: Record<string, string>
  issues?: string[]
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  markers: readonly MarkerAnnotation[]
  selectedMarkerId: string | null
  onSelectMarker: (marker: MarkerAnnotation) => void
  markerControls: MarkerControlsProps
}) {
  const [tab, setTab] = useState<'regions' | 'markers'>('regions')
  const tabId = useId()
  const tabsRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<'all' | 'unlabeled'>('all')
  const orderedMarkers = [...markers].sort(
    (a, b) => a.time - b.time || a.id.localeCompare(b.id),
  )
  const ordered = [...regions].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id),
  )
  const shown =
    filter === 'unlabeled' && labels
      ? ordered.filter((region) => !labels[region.id])
      : ordered
  return (
    <section className={styles.root} aria-label="Annotations">
      <header className={styles.header}>
        <div
          className={styles.tabs}
          ref={tabsRef}
          role="tablist"
          aria-label="Annotation type"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
              return
            event.preventDefault()
            const next =
              event.key === 'Home'
                ? 'regions'
                : event.key === 'End'
                  ? 'markers'
                  : tab === 'regions'
                    ? 'markers'
                    : 'regions'
            setTab(next)
            tabsRef.current
              ?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)
              ?.focus()
          }}
        >
          {(['regions', 'markers'] as const).map((name) => (
            <button
              key={name}
              id={`${tabId}-${name}-tab`}
              type="button"
              role="tab"
              data-tab={name}
              aria-selected={tab === name}
              aria-controls={`${tabId}-${name}-panel`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
            >
              {name === 'regions' ? 'Regions' : 'Markers'}
              <span>
                {(name === 'regions' ? regions.length : markers.length)
                  .toString()
                  .padStart(2, '0')}
              </span>
            </button>
          ))}
        </div>
        {labels && tab === 'regions' && (
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
        </div>
      </header>
      <div
        id={`${tabId}-regions-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-regions-tab`}
        hidden={tab !== 'regions'}
      >
        <RegionControls
          {...regionControls}
          onAdd={onAdd}
          canAdd={canAdd}
          selectedCount={selectedRegionIds.length}
        />
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
                aria-pressed={selectedRegionIds.includes(region.id)}
                onClick={(event) =>
                  onSelect(region, event.ctrlKey || event.metaKey)
                }
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
                  ) : selectedRegionIds.includes(region.id) ? (
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
                  : 'Mark a time interval.'}
              </strong>
              <p>
                {filter === 'unlabeled' && regions.length
                  ? 'Select All to review your annotations.'
                  : 'Drag across the waveform, or add a region at the playhead.'}
              </p>
            </div>
          </div>
        )}
      </div>
      <div
        id={`${tabId}-markers-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-markers-tab`}
        hidden={tab !== 'markers'}
      >
        <MarkerControls {...markerControls} />
        {orderedMarkers.length ? (
          <div className={styles.list}>
            <div
              className={`${styles.columnLabels} ${styles.markerColumns}`}
              aria-hidden="true"
            >
              <span>#</span>
              <span>Marker</span>
              <span>Position</span>
              <span>State</span>
            </div>
            {orderedMarkers.map((marker, index) => (
              <button
                key={marker.id}
                type="button"
                className={`${styles.row} ${styles.markerColumns} ${styles.markerRow}`}
                aria-pressed={selectedMarkerId === marker.id}
                disabled={!markerControls.isLoaded}
                onClick={() => onSelectMarker(marker)}
                title={`Seek to ${formatTime(marker.time)} without changing playback`}
              >
                <span className={styles.number}>
                  {(index + 1).toString().padStart(2, '0')}
                </span>
                <span className={styles.name}>
                  <Icon name="marker" />
                  Marker {index + 1}
                </span>
                <span className={styles.time}>{formatTime(marker.time)}</span>
                <span className={styles.state}>
                  {selectedMarkerId === marker.id ? 'Selected' : '—'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <Icon name="marker" size={24} />
            <div>
              <strong>
                {markerControls.markerEditingEnabled
                  ? 'Pinpoint a moment.'
                  : 'No markers in this annotation.'}
              </strong>
              <p>
                {markerControls.markerEditingEnabled
                  ? 'Add a marker at the playhead, or press T while the waveform is focused.'
                  : 'This task has no timestamp markers to review.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
