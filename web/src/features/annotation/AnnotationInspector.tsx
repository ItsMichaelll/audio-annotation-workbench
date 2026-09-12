import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { RegionTiming } from '../../components/RegionTiming'
import { CustomSelectField } from '../../components/CustomSelect'
import {
  clampInspectorWidth,
  DEFAULT_INSPECTOR_WIDTH,
  maximumInspectorWidth,
} from '../../domain/editorLayout'
import type { AnnotationDocument, LabelAssignment } from '../../domain/models'
import type {
  AnnotationLabel,
  AnnotationTaxonomy,
} from '../../domain/annotationTaxonomy'
import { formatTime } from '../../domain/transport'
import { MarkdownInstructions } from '../projects/MarkdownInstructions'
import styles from './AnnotationInspector.module.css'

type InspectorTab = 'labels' | 'clip' | 'instructions'

interface AnnotationInspectorProps {
  annotation: AnnotationDocument
  taxonomy: AnnotationTaxonomy
  selectedRegionId: string | null
  instructions: string | null
  readOnly: boolean
  duration: number
  sourceName: string
  taxonomyVersion: number
  metadata: Record<string, unknown>
  onClose(): void
  onRegionBoundsChange(start: number, end: number): void
  onToggleLabel(target: 'region' | 'clip', labelId: string): void
  onAssignmentChange(
    target: 'region' | 'clip',
    labelId: string,
    values: Pick<LabelAssignment, 'severity' | 'confidence'>,
  ): void
  onRegionNotesChange(notes: string): void
  onTaskNotesChange(notes: string): void
}

function AssignmentScales({
  assignment,
  taxonomy,
  disabled,
  onChange,
}: {
  assignment: LabelAssignment
  taxonomy: AnnotationTaxonomy
  disabled: boolean
  onChange(values: Pick<LabelAssignment, 'severity' | 'confidence'>): void
}) {
  return (
    <div className={styles.assignmentScales}>
      {(['severity', 'confidence'] as const).map((name) => {
        const scale = taxonomy.scales[name]
        if (!scale) return null
        return (
          <CustomSelectField
            key={name}
            label={
              <>
                {name}{' '}
                {scale.required && (
                  <em className={styles.required}>required</em>
                )}
              </>
            }
            value={assignment[name] ?? ''}
            disabled={disabled}
            invalid={scale.required && !assignment[name]}
            {...(disabled ? { className: styles.readOnlySelect } : {})}
            variant="inspector"
            options={[
              { value: '', label: 'Select…' },
              ...scale.options.map((option) => ({
                value: option.value,
                label: option.label,
              })),
            ]}
            onChange={(selected) =>
              onChange(
                (() => {
                  const values: Pick<
                    LabelAssignment,
                    'severity' | 'confidence'
                  > = {
                    ...(assignment.severity
                      ? { severity: assignment.severity }
                      : {}),
                    ...(assignment.confidence
                      ? { confidence: assignment.confidence }
                      : {}),
                  }
                  if (name === 'severity') {
                    if (selected) values.severity = selected
                    else delete values.severity
                  } else if (selected) values.confidence = selected
                  else delete values.confidence
                  return values
                })(),
              )
            }
          />
        )
      })}
    </div>
  )
}

function LabelControls({
  title,
  target,
  labels,
  assignments,
  taxonomy,
  disabled,
  onToggle,
  onAssignmentChange,
}: {
  title: string
  target: 'region' | 'clip'
  labels: AnnotationLabel[]
  assignments: LabelAssignment[]
  taxonomy: AnnotationTaxonomy
  disabled: boolean
  onToggle(labelId: string): void
  onAssignmentChange(
    labelId: string,
    values: Pick<LabelAssignment, 'severity' | 'confidence'>,
  ): void
}) {
  return (
    <section className={styles.inspectorSection}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {labels.length === 0 ? (
        <p className={styles.mutedCopy}>No matching labels.</p>
      ) : (
        <div
          className={styles.labelList}
          role={target === 'region' ? 'radiogroup' : undefined}
          aria-label={target === 'region' ? title : undefined}
        >
          {labels.map((label) => {
            const assignment = assignments.find(
              (item) => item.labelId === label.id,
            )
            return (
              <div
                className={`${styles.labelControl}${assignment ? ` ${styles.assigned}` : ''}`}
                key={`${target}-${label.id}`}
              >
                <label className={styles.labelRow}>
                  <input
                    className={styles.labelInput}
                    type={target === 'region' ? 'radio' : 'checkbox'}
                    name={target === 'region' ? 'region-label' : undefined}
                    checked={Boolean(assignment)}
                    disabled={disabled}
                    onChange={() => onToggle(label.id)}
                  />
                  <i
                    className={styles.swatch}
                    style={{
                      background: label.color ?? 'var(--color-blue-500)',
                    }}
                    aria-hidden="true"
                  />
                  <span className={styles.labelCopy}>
                    <strong className={styles.labelName}>{label.name}</strong>
                    {label.description && (
                      <small className={styles.labelDescription}>
                        {label.description}
                      </small>
                    )}
                  </span>
                  {label.shortcut && (
                    <kbd className={styles.shortcutKey}>{label.shortcut}</kbd>
                  )}
                </label>
                {assignment && (
                  <AssignmentScales
                    assignment={assignment}
                    taxonomy={taxonomy}
                    disabled={disabled}
                    onChange={(values) => onAssignmentChange(label.id, values)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function AnnotationInspector(props: AnnotationInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>('labels')
  const [query, setQuery] = useState('')
  const [previousSelection, setPreviousSelection] = useState(
    props.selectedRegionId,
  )
  if (previousSelection !== props.selectedRegionId) {
    setPreviousSelection(props.selectedRegionId)
    if (props.selectedRegionId) setTab('labels')
  }
  const tabId = useId()
  const inspectorRef = useRef<HTMLElement>(null)
  const resizeRef = useRef<
    { pointerId: number; startX: number; startWidth: number } | undefined
  >(undefined)
  const [width, setWidth] = useState(DEFAULT_INSPECTOR_WIDTH)

  const updateWidth = useCallback((nextWidth: number) => {
    setWidth(clampInspectorWidth(nextWidth, window.innerWidth))
  }, [])

  useEffect(() => {
    const workspace = inspectorRef.current?.parentElement
    workspace?.style.setProperty('--annotation-inspector-width', `${width}px`)
    return () => {
      workspace?.style.removeProperty('--annotation-inspector-width')
    }
  }, [width])

  useEffect(() => {
    const clampToViewport = () => updateWidth(width)
    window.addEventListener('resize', clampToViewport)
    return () => window.removeEventListener('resize', clampToViewport)
  }, [updateWidth, width])
  const selectedRegion = props.annotation.regions.find(
    (region) => region.id === props.selectedRegionId,
  )
  const matchingLabels = props.taxonomy.labels.filter((label) =>
    [label.name, label.id, label.description]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query.toLowerCase())),
  )
  const tabs: { value: InspectorTab; label: string }[] = [
    { value: 'labels', label: 'Region' },
    { value: 'clip', label: 'Clip & info' },
    { value: 'instructions', label: 'Guide' },
  ]
  const regionIndex = [...props.annotation.regions]
    .sort((a, b) => a.start - b.start)
    .findIndex((region) => region.id === props.selectedRegionId)
  return (
    <aside
      id="annotation-inspector"
      ref={inspectorRef}
      className={`${styles.root}${props.readOnly ? ` ${styles.readOnly}` : ''}`}
      aria-label="Annotation inspector"
    >
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-label="Resize annotation inspector"
        aria-orientation="vertical"
        aria-valuemin={DEFAULT_INSPECTOR_WIDTH}
        aria-valuemax={Math.round(maximumInspectorWidth(window.innerWidth))}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault()
          resizeRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: width,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const resize = resizeRef.current
          if (!resize || resize.pointerId !== event.pointerId) return
          updateWidth(resize.startWidth + resize.startX - event.clientX)
        }}
        onPointerUp={(event) => {
          if (resizeRef.current?.pointerId !== event.pointerId) return
          resizeRef.current = undefined
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={() => {
          resizeRef.current = undefined
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          updateWidth(width + (event.key === 'ArrowLeft' ? 10 : -10))
        }}
      />
      <div className={styles.heading}>
        <strong>Inspector</strong>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close annotation inspector"
        >
          <Icon name="close" />
        </button>
      </div>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Inspector sections"
      >
        {tabs.map(({ value: name, label }) => (
          <button
            type="button"
            className={styles.tab}
            role="tab"
            id={`${tabId}-${name}-tab`}
            aria-controls={`${tabId}-${name}-panel`}
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => {
              const current = tabs.findIndex((item) => item.value === name)
              const next =
                event.key === 'ArrowRight'
                  ? (current + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (current - 1 + tabs.length) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1
              if (next < 0) return
              event.preventDefault()
              const nextTab = tabs[next]!.value
              setTab(nextTab)
              document.getElementById(`${tabId}-${nextTab}-tab`)?.focus()
            }}
            key={name}
          >
            {label}
            {name === 'clip' && props.annotation.clipAssignments.length > 0 && (
              <span className={styles.tabCount}>
                {props.annotation.clipAssignments.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={styles.scroll}>
        <div
          role="tabpanel"
          id={`${tabId}-${tab}-panel`}
          aria-labelledby={`${tabId}-${tab}-tab`}
        >
          {tab === 'labels' && (
            <>
              {selectedRegion ? (
                <>
                  <div className={styles.selectedRegionSummary}>
                    <div>
                      <span className={styles.overline}>Selected region</span>
                      <strong className={styles.regionTitle}>
                        Region {String(regionIndex + 1).padStart(2, '0')}
                      </strong>
                    </div>
                    <span className={styles.selectedRegionTime}>
                      {formatTime(selectedRegion.end - selectedRegion.start)}
                    </span>
                  </div>
                  <RegionTiming
                    key={selectedRegion.id}
                    region={selectedRegion}
                    duration={props.duration}
                    readOnly={props.readOnly}
                    onChange={props.onRegionBoundsChange}
                  />
                  <div className={styles.sectionHeading}>
                    <h3 className={styles.sectionTitle}>Annotation label</h3>
                    <span>Choose one</span>
                  </div>
                  {props.taxonomy.labels.length > 8 && (
                    <input
                      className={styles.search}
                      type="search"
                      aria-label="Filter taxonomy labels"
                      placeholder="Find a label…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  )}
                  <LabelControls
                    title="Region labels"
                    target="region"
                    labels={matchingLabels.filter((label) =>
                      label.scopes.includes('region'),
                    )}
                    assignments={selectedRegion.assignments}
                    taxonomy={props.taxonomy}
                    disabled={props.readOnly}
                    onToggle={(labelId) =>
                      props.onToggleLabel('region', labelId)
                    }
                    onAssignmentChange={(labelId, values) =>
                      props.onAssignmentChange('region', labelId, values)
                    }
                  />
                  {selectedRegion.assignments.length === 0 &&
                    !props.readOnly && (
                      <p className={styles.validation}>
                        <Icon name="info" size={13} />
                        Choose a label before submitting.
                      </p>
                    )}
                  <label className={styles.notes}>
                    <span className={styles.notesLabel}>
                      Region notes <small>Optional</small>
                    </span>
                    <textarea
                      className={styles.notesInput}
                      rows={3}
                      placeholder="Add context about this moment…"
                      value={selectedRegion.notes ?? ''}
                      disabled={props.readOnly}
                      onChange={(event) =>
                        props.onRegionNotesChange(event.target.value)
                      }
                    />
                  </label>
                </>
              ) : (
                <div className={styles.emptyState}>
                  <Icon name="waveform" size={32} />
                  <strong className={styles.emptyTitle}>Select a region</strong>
                  <p className={styles.emptyDescription}>
                    {props.readOnly
                      ? 'Choose an interval in Regions to review its labels and timing.'
                      : 'Drag across the waveform or choose an interval in Regions to add labels.'}{' '}
                    Markers are timestamp-only references.
                  </p>
                  <button
                    type="button"
                    className={styles.clipLink}
                    onClick={() => setTab('clip')}
                  >
                    {props.readOnly
                      ? 'Review clip labels'
                      : 'Annotate the whole clip'}{' '}
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              )}
            </>
          )}
          {tab === 'clip' && (
            <>
              <div className={styles.selectedRegionSummary}>
                <div>
                  <span className={styles.overline}>Whole recording</span>
                  <strong className={styles.regionTitle}>
                    Clip annotation
                  </strong>
                </div>
                <span className={styles.selectedRegionTime}>
                  {formatTime(props.duration)}
                </span>
              </div>
              <p className={styles.mutedCopy}>
                These labels apply to the entire file. Multiple labels are
                allowed.
              </p>
              <LabelControls
                title="Clip labels"
                target="clip"
                labels={props.taxonomy.labels.filter((label) =>
                  label.scopes.includes('clip'),
                )}
                assignments={props.annotation.clipAssignments}
                taxonomy={props.taxonomy}
                disabled={props.readOnly}
                onToggle={(labelId) => props.onToggleLabel('clip', labelId)}
                onAssignmentChange={(labelId, values) =>
                  props.onAssignmentChange('clip', labelId, values)
                }
              />
              <label className={styles.notes}>
                <span className={styles.notesLabel}>
                  Task notes <small>Optional</small>
                </span>
                <textarea
                  className={styles.notesInput}
                  rows={4}
                  placeholder="Leave context for this recording…"
                  value={props.annotation.taskNotes ?? ''}
                  disabled={props.readOnly}
                  onChange={(event) =>
                    props.onTaskNotesChange(event.target.value)
                  }
                />
              </label>
              <section className={styles.metadata}>
                <h3 className={styles.sectionTitle}>Source & metadata</h3>
                <dl>
                  <div>
                    <dt>File</dt>
                    <dd>{props.sourceName}</dd>
                  </div>
                  <div>
                    <dt>Taxonomy</dt>
                    <dd>Version {props.taxonomyVersion} · pinned</dd>
                  </div>
                  {Object.entries(props.metadata).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>
                        {Array.isArray(value)
                          ? value.join(', ')
                          : String(value ?? '—')}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </>
          )}
          {tab === 'instructions' && (
            <>
              {props.instructions ? (
                <MarkdownInstructions markdown={props.instructions} />
              ) : (
                <div className={styles.emptyState}>
                  <Icon name="info" size={28} />
                  <strong className={styles.emptyTitle}>
                    No project guide yet
                  </strong>
                  <p className={styles.emptyDescription}>
                    Project instructions will appear here when added in project
                    settings.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className={styles.footer}>
        <Icon name={props.readOnly ? 'lock' : 'keyboard'} size={14} />
        {props.readOnly
          ? 'Submitted · read-only'
          : 'Select a region, then use a label shortcut.'}
      </div>
    </aside>
  )
}
