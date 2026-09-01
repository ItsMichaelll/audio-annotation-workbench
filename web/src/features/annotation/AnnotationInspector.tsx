import { useCallback, useEffect, useId, useRef, useState } from 'react'
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

type InspectorTab = 'labels' | 'instructions' | 'shortcuts'

interface AnnotationInspectorProps {
  annotation: AnnotationDocument
  taxonomy: AnnotationTaxonomy
  selectedRegionId: string | null
  instructions: string | null
  readOnly: boolean
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
    <div className="assignment-scales">
      {(['severity', 'confidence'] as const).map((name) => {
        const scale = taxonomy.scales[name]
        if (!scale) return null
        return (
          <CustomSelectField
            key={name}
            label={
              <>
                {name} {scale.required && <em>required</em>}
              </>
            }
            value={assignment[name] ?? ''}
            disabled={disabled}
            className={scale.required && !assignment[name] ? 'is-missing' : ''}
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
    <section className="inspector-section">
      <h3>{title}</h3>
      {labels.length === 0 ? (
        <p className="muted-copy">No taxonomy labels support this target.</p>
      ) : (
        <div
          className="label-list"
          role={target === 'region' ? 'radiogroup' : undefined}
          aria-label={target === 'region' ? title : undefined}
        >
          {labels.map((label) => {
            const assignment = assignments.find(
              (item) => item.labelId === label.id,
            )
            return (
              <div
                className={
                  assignment ? 'label-control is-assigned' : 'label-control'
                }
                key={`${target}-${label.id}`}
              >
                <label>
                  <input
                    type={target === 'region' ? 'radio' : 'checkbox'}
                    name={target === 'region' ? 'region-label' : undefined}
                    checked={Boolean(assignment)}
                    disabled={disabled}
                    onChange={() => onToggle(label.id)}
                  />
                  <i
                    style={{ background: label.color ?? 'var(--accent)' }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{label.name}</strong>
                    {label.description && <small>{label.description}</small>}
                  </span>
                  {label.shortcut && <kbd>{label.shortcut}</kbd>}
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
  return (
    <aside
      ref={inspectorRef}
      className="annotation-inspector"
      aria-label="Annotation inspector"
    >
      <div
        className="annotation-inspector__resize-handle"
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
      <div
        className="inspector-tabs"
        role="tablist"
        aria-label="Inspector sections"
      >
        {(['labels', 'instructions', 'shortcuts'] as const).map((name) => (
          <button
            type="button"
            role="tab"
            id={`${tabId}-${name}-tab`}
            aria-controls={`${tabId}-${name}-panel`}
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => {
              const tabs: InspectorTab[] = [
                'labels',
                'instructions',
                'shortcuts',
              ]
              const current = tabs.indexOf(name)
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
              const nextTab = tabs[next]!
              setTab(nextTab)
              document.getElementById(`${tabId}-${nextTab}-tab`)?.focus()
            }}
            key={name}
          >
            {name[0]!.toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>
      <div className="inspector-scroll">
        {tab === 'labels' && (
          <div
            role="tabpanel"
            id={`${tabId}-labels-panel`}
            aria-labelledby={`${tabId}-labels-tab`}
          >
            {props.taxonomy.labels.length > 8 && (
              <input
                className="inspector-search"
                type="search"
                aria-label="Filter taxonomy labels"
                placeholder="Filter labels"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            )}
            {selectedRegion ? (
              <>
                <div className="selected-region-summary">
                  <span>Selected region</span>
                  <strong>
                    {formatTime(selectedRegion.start)} –{' '}
                    {formatTime(selectedRegion.end)}
                  </strong>
                </div>
                <LabelControls
                  title="Region labels"
                  target="region"
                  labels={matchingLabels.filter((label) =>
                    label.scopes.includes('region'),
                  )}
                  assignments={selectedRegion.assignments}
                  taxonomy={props.taxonomy}
                  disabled={props.readOnly}
                  onToggle={(labelId) => props.onToggleLabel('region', labelId)}
                  onAssignmentChange={(labelId, values) =>
                    props.onAssignmentChange('region', labelId, values)
                  }
                />
                <label className="inspector-notes">
                  <span>Region notes</span>
                  <textarea
                    rows={3}
                    value={selectedRegion.notes ?? ''}
                    disabled={props.readOnly}
                    onChange={(event) =>
                      props.onRegionNotesChange(event.target.value)
                    }
                  />
                </label>
              </>
            ) : (
              <div className="inspector-empty">
                <strong>No region selected</strong>
                <p>
                  Create or select a region to apply region labels. Shortcut
                  labels apply to the clip while no region is selected.
                </p>
              </div>
            )}
            <LabelControls
              title="Clip labels"
              target="clip"
              labels={matchingLabels.filter((label) =>
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
            <label className="inspector-notes">
              <span>Task notes</span>
              <textarea
                rows={4}
                value={props.annotation.taskNotes ?? ''}
                disabled={props.readOnly}
                onChange={(event) =>
                  props.onTaskNotesChange(event.target.value)
                }
              />
            </label>
          </div>
        )}
        {tab === 'instructions' && (
          <div
            role="tabpanel"
            id={`${tabId}-instructions-panel`}
            aria-labelledby={`${tabId}-instructions-tab`}
          >
            {props.instructions ? (
              <MarkdownInstructions markdown={props.instructions} />
            ) : (
              <div className="inspector-empty">
                <strong>No instructions</strong>
                <p>This project does not include annotation instructions.</p>
              </div>
            )}
          </div>
        )}
        {tab === 'shortcuts' && (
          <div
            role="tabpanel"
            id={`${tabId}-shortcuts-panel`}
            aria-labelledby={`${tabId}-shortcuts-tab`}
            className="shortcut-reference"
          >
            <h3>Transport and regions</h3>
            <dl>
              <div>
                <dt>Space</dt>
                <dd>Play / pause</dd>
              </div>
              <div>
                <dt>← / →</dt>
                <dd>Step playhead</dd>
              </div>
              <div>
                <dt>Ctrl + ← / →</dt>
                <dd>Previous / next region</dd>
              </div>
              <div>
                <dt>F</dt>
                <dd>Fit file</dd>
              </div>
              <div>
                <dt>+ / −</dt>
                <dd>Zoom</dd>
              </div>
              <div>
                <dt>L</dt>
                <dd>Toggle loop</dd>
              </div>
              <div>
                <dt>Delete</dt>
                <dd>Delete selected region</dd>
              </div>
              <div>
                <dt>Ctrl + Z / Y</dt>
                <dd>Undo / redo</dd>
              </div>
            </dl>
            <h3>Workflow</h3>
            <dl>
              <div>
                <dt>Ctrl + Enter</dt>
                <dd>Submit and next</dd>
              </div>
              <div>
                <dt>Ctrl + Shift + Enter</dt>
                <dd>Skip and next</dd>
              </div>
              {props.taxonomy.labels
                .filter((label) => label.shortcut)
                .map((label) => (
                  <div key={label.id}>
                    <dt>{label.shortcut}</dt>
                    <dd>Select or toggle {label.name}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </div>
    </aside>
  )
}
