import { useId, useRef, useState } from 'react'
import type {
  AnnotationLabel,
  AnnotationScale,
  AnnotationTaxonomy,
} from '../../domain/annotationTaxonomy'
import {
  nextAvailableIdentifier,
  removeEntry,
  reorderEntry,
  replaceEntry,
} from '../../domain/taxonomyEditing'
import { AddButton } from './TaxonomyEditorControls'
import { LabelCard } from './TaxonomyLabelCard'
import { ScaleCard } from './TaxonomyScaleCard'
import {
  addExpandedLabel,
  removeLabelUi,
  reorderLabelUi,
  toggleExpandedLabel,
  type LabelUiState,
} from './taxonomyEditorUiState'

export type TaxonomyEditorMode = 'yaml' | 'structured'
type ScaleName = 'severity' | 'confidence'
type ChangeTaxonomy = (taxonomy: AnnotationTaxonomy) => Promise<boolean>

export function TaxonomyModeSwitch({
  mode,
  onChange,
}: {
  mode: TaxonomyEditorMode
  onChange: (mode: TaxonomyEditorMode) => void
}) {
  return (
    <div
      className="segmented-control taxonomy-mode-switch"
      role="group"
      aria-label="Taxonomy editor mode"
    >
      <button
        type="button"
        aria-pressed={mode === 'yaml'}
        onClick={() => onChange('yaml')}
      >
        YAML
      </button>
      <button
        type="button"
        aria-pressed={mode === 'structured'}
        onClick={() => onChange('structured')}
      >
        Structured
      </button>
    </div>
  )
}

export function StructuredTaxonomyEditor({
  taxonomy,
  validationError,
  onChange,
}: {
  taxonomy: AnnotationTaxonomy
  validationError: string | null
  onChange: ChangeTaxonomy
}) {
  const instanceId = useId().replaceAll(':', '')
  const nextUiIdentity = useRef(
    taxonomy.labels.length +
      (taxonomy.scales.severity?.options.length ?? 0) +
      (taxonomy.scales.confidence?.options.length ?? 0),
  )
  const createUiIdentity = (kind: string) =>
    `${instanceId}-${kind}-${nextUiIdentity.current++}`
  const [labelUiState, setLabelUiState] = useState<LabelUiState>(() => ({
    ids: taxonomy.labels.map((_, index) => `${instanceId}-label-${index}`),
    expanded: new Set(),
  }))
  const [optionUiIds, setOptionUiIds] = useState<Record<ScaleName, string[]>>(
    () => ({
      severity: (taxonomy.scales.severity?.options ?? []).map(
        (_, index) => `${instanceId}-severity-option-${index}`,
      ),
      confidence: (taxonomy.scales.confidence?.options ?? []).map(
        (_, index) => `${instanceId}-confidence-option-${index}`,
      ),
    }),
  )
  const draggedLabel = useRef<string | null>(null)
  const [draggedLabelUiId, setDraggedLabelUiId] = useState<string | null>(null)
  const [labelDropTargetUiId, setLabelDropTargetUiId] = useState<string | null>(
    null,
  )

  const commit = (next: AnnotationTaxonomy) => onChange(next)

  const changeLabel = async (
    index: number,
    update: (label: AnnotationLabel) => AnnotationLabel,
  ) =>
    commit({
      ...taxonomy,
      labels: replaceEntry(taxonomy.labels, index, update),
    })

  const changeScale = async (
    name: ScaleName,
    update: (scale: AnnotationScale) => AnnotationScale,
  ): Promise<boolean> => {
    const scale = taxonomy.scales[name]
    if (!scale) return false
    return commit({
      ...taxonomy,
      scales: { ...taxonomy.scales, [name]: update(scale) },
    })
  }

  const addLabel = async () => {
    const id = nextAvailableIdentifier(
      'label',
      taxonomy.labels.map((label) => label.id),
    )
    const uiId = createUiIdentity('label')
    if (
      await commit({
        ...taxonomy,
        labels: [
          ...taxonomy.labels,
          { id, name: 'New label', scopes: ['region'] },
        ],
      })
    ) {
      setLabelUiState((current) => addExpandedLabel(current, uiId))
    }
  }

  const reorderLabel = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    if (
      await commit({
        ...taxonomy,
        labels: reorderEntry(taxonomy.labels, fromIndex, toIndex),
      })
    ) {
      setLabelUiState((current) => reorderLabelUi(current, fromIndex, toIndex))
    }
  }

  return (
    <section
      className="configuration-panel structured-taxonomy taxonomy-editor-surface"
      aria-label="Structured taxonomy editor"
    >
      {validationError && (
        <div className="structured-validation" role="alert">
          <strong>Fix the structured values before saving</strong>
          <p>{validationError}</p>
          <small>
            Your current values remain in both editors; saving stays disabled.
          </small>
        </div>
      )}

      <section
        className="taxonomy-section"
        aria-labelledby="taxonomy-labels-heading"
      >
        <div className="structured-taxonomy__heading">
          <div>
            <p className="eyebrow">Annotation vocabulary</p>
            <h2 id="taxonomy-labels-heading">Labels</h2>
            <p>
              Configure label identity, display metadata, shortcuts, and scope.
            </p>
          </div>
          <AddButton onClick={() => void addLabel()}>Add label</AddButton>
        </div>

        {taxonomy.labels.length === 0 ? (
          <div className="taxonomy-empty-state">
            <div>
              <strong>No labels configured</strong>
              <p>A valid taxonomy needs at least one annotation label.</p>
            </div>
            <AddButton onClick={() => void addLabel()}>
              Add first label
            </AddButton>
          </div>
        ) : (
          <div className="structured-list">
            {taxonomy.labels.map((label, index) => {
              const uiId =
                labelUiState.ids[index] ?? `${instanceId}-label-${index}`
              const expanded = labelUiState.expanded.has(uiId)
              return (
                <LabelCard
                  key={uiId}
                  label={label}
                  uiId={uiId}
                  index={index}
                  count={taxonomy.labels.length}
                  expanded={expanded}
                  dragging={draggedLabelUiId === uiId}
                  dragOver={
                    labelDropTargetUiId === uiId && draggedLabelUiId !== uiId
                  }
                  onChange={(nextLabel) =>
                    void changeLabel(index, () => nextLabel)
                  }
                  onMove={(direction) =>
                    void reorderLabel(index, index + direction)
                  }
                  onRemove={async () => {
                    if (
                      await commit({
                        ...taxonomy,
                        labels: removeEntry(taxonomy.labels, index),
                      })
                    ) {
                      setLabelUiState((current) =>
                        removeLabelUi(current, index),
                      )
                    }
                  }}
                  onToggle={() =>
                    setLabelUiState((current) =>
                      toggleExpandedLabel(current, uiId),
                    )
                  }
                  onDragStart={(event) => {
                    draggedLabel.current = uiId
                    setDraggedLabelUiId(uiId)
                    setLabelDropTargetUiId(null)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', uiId)
                  }}
                  onDragEnd={() => {
                    draggedLabel.current = null
                    setDraggedLabelUiId(null)
                    setLabelDropTargetUiId(null)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setLabelDropTargetUiId(uiId)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const sourceUiId =
                      draggedLabel.current ||
                      event.dataTransfer.getData('text/plain')
                    void reorderLabel(
                      labelUiState.ids.indexOf(sourceUiId),
                      index,
                    )
                    draggedLabel.current = null
                    setDraggedLabelUiId(null)
                    setLabelDropTargetUiId(null)
                  }}
                />
              )
            })}
          </div>
        )}
      </section>

      <section
        className="taxonomy-section taxonomy-section--scales"
        aria-labelledby="taxonomy-scales-heading"
      >
        <div className="structured-taxonomy__heading">
          <div>
            <p className="eyebrow">Review dimensions</p>
            <h2 id="taxonomy-scales-heading">Scales</h2>
            <p>
              Severity and Confidence are optional fixed schema keys. Option
              order is preserved in YAML and annotation controls.
            </p>
          </div>
        </div>
        <div className="scale-grid">
          {(['severity', 'confidence'] as const).map((name) => (
            <ScaleCard
              key={name}
              name={name}
              scale={taxonomy.scales[name]}
              optionUiIds={optionUiIds[name]}
              createOptionUiId={() => createUiIdentity(`${name}-option`)}
              onAdd={async () => {
                const uiId = createUiIdentity(`${name}-option`)
                if (
                  await commit({
                    ...taxonomy,
                    scales: {
                      ...taxonomy.scales,
                      [name]: {
                        required: false,
                        options: [{ value: 'option', label: 'Option 1' }],
                      },
                    },
                  })
                ) {
                  setOptionUiIds((current) => ({
                    ...current,
                    [name]: [uiId],
                  }))
                }
              }}
              onChange={(nextScale) => changeScale(name, () => nextScale)}
              onRemove={async () => {
                const scales = { ...taxonomy.scales }
                delete scales[name]
                if (await commit({ ...taxonomy, scales })) {
                  setOptionUiIds((current) => ({
                    ...current,
                    [name]: [],
                  }))
                }
              }}
              onOptionUiIdsChange={(ids) =>
                setOptionUiIds((current) => ({ ...current, [name]: ids }))
              }
            />
          ))}
        </div>
      </section>
    </section>
  )
}
