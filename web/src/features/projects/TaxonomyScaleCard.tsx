import { useRef, useState } from 'react'
import type { AnnotationScale } from '../../domain/annotationTaxonomy'
import {
  nextAvailableIdentifier,
  removeEntry,
  reorderEntry,
  replaceEntry,
} from '../../domain/taxonomyEditing'
import {
  AddButton,
  DragHandle,
  IconButton,
  MoveButtons,
} from './TaxonomyEditorControls'

function RequiredSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      className="taxonomy-required-switch"
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
      Required
    </button>
  )
}

export function ScaleCard({
  name,
  scale,
  optionUiIds,
  createOptionUiId,
  onAdd,
  onChange,
  onRemove,
  onOptionUiIdsChange,
}: {
  name: 'severity' | 'confidence'
  scale: AnnotationScale | undefined
  optionUiIds: string[]
  createOptionUiId: () => string
  onAdd: () => void
  onChange: (scale: AnnotationScale) => Promise<boolean>
  onRemove: () => void
  onOptionUiIdsChange: (ids: string[]) => void
}) {
  const title = name === 'severity' ? 'Severity' : 'Confidence'
  const draggedOption = useRef<string | null>(null)
  const [draggedOptionUiId, setDraggedOptionUiId] = useState<string | null>(
    null,
  )
  const [optionDropTargetUiId, setOptionDropTargetUiId] = useState<
    string | null
  >(null)

  if (!scale) {
    return (
      <section className="taxonomy-scale-card taxonomy-scale-card--empty">
        <div>
          <p className="eyebrow">Optional scale</p>
          <h3>{title}</h3>
          <p>Add this scale when reviewers need to record {name}.</p>
        </div>
        <AddButton onClick={onAdd}>Add {name} scale</AddButton>
      </section>
    )
  }

  const reorderOption = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    if (
      await onChange({
        ...scale,
        options: reorderEntry(scale.options, fromIndex, toIndex),
      })
    ) {
      onOptionUiIdsChange(reorderEntry(optionUiIds, fromIndex, toIndex))
    }
  }

  return (
    <section className="taxonomy-scale-card">
      <header className="taxonomy-scale-header">
        <h3>{title}</h3>
        <div className="taxonomy-scale-header__actions">
          <RequiredSwitch
            checked={scale.required}
            onChange={(required) => void onChange({ ...scale, required })}
          />
          <button
            className="danger-button compact-danger-button taxonomy-delete-scale"
            type="button"
            onClick={onRemove}
          >
            Delete scale
          </button>
        </div>
      </header>

      <div className="taxonomy-options-header" aria-hidden="true">
        <span />
        <span>Stored value *</span>
        <span>Display label *</span>
        <span>Actions</span>
      </div>
      <div className="structured-options">
        {scale.options.map((option, optionIndex) => {
          const optionIdentity = option.label || option.value || 'option'
          const uiId = optionUiIds[optionIndex] ?? `${name}-${optionIndex}`
          const duplicateValue =
            Boolean(option.value) &&
            scale.options.some(
              (candidate, candidateIndex) =>
                candidateIndex !== optionIndex &&
                candidate.value === option.value,
            )
          return (
            <div
              className={`structured-option taxonomy-drag-item${draggedOptionUiId === uiId ? ' is-dragging' : ''}${optionDropTargetUiId === uiId && draggedOptionUiId !== uiId ? ' is-drag-over' : ''}`}
              key={uiId}
              data-option-ui-id={uiId}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setOptionDropTargetUiId(uiId)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const sourceUiId =
                  draggedOption.current ||
                  event.dataTransfer.getData('text/plain')
                void reorderOption(optionUiIds.indexOf(sourceUiId), optionIndex)
                draggedOption.current = null
                setDraggedOptionUiId(null)
                setOptionDropTargetUiId(null)
              }}
            >
              <DragHandle
                label={`Drag ${title} option ${optionIdentity} to reorder`}
                onDragStart={(event) => {
                  draggedOption.current = uiId
                  setDraggedOptionUiId(uiId)
                  setOptionDropTargetUiId(null)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', uiId)
                }}
                onDragEnd={() => {
                  draggedOption.current = null
                  setDraggedOptionUiId(null)
                  setOptionDropTargetUiId(null)
                }}
              />
              <label className="field">
                <span className="visually-hidden">Stored value *</span>
                <input
                  value={option.value}
                  aria-label={`${title} option ${optionIndex + 1} value`}
                  aria-invalid={!option.value.trim() || duplicateValue}
                  onChange={(event) =>
                    void onChange({
                      ...scale,
                      options: replaceEntry(
                        scale.options,
                        optionIndex,
                        (entry) => ({ ...entry, value: event.target.value }),
                      ),
                    })
                  }
                />
                {(!option.value.trim() || duplicateValue) && (
                  <small className="taxonomy-field-error">
                    {duplicateValue
                      ? 'Stored values must be unique.'
                      : 'Enter a stored value.'}
                  </small>
                )}
              </label>
              <label className="field">
                <span className="visually-hidden">Display label *</span>
                <input
                  value={option.label}
                  aria-label={`${title} option ${optionIndex + 1} label`}
                  aria-invalid={!option.label.trim()}
                  onChange={(event) =>
                    void onChange({
                      ...scale,
                      options: replaceEntry(
                        scale.options,
                        optionIndex,
                        (entry) => ({ ...entry, label: event.target.value }),
                      ),
                    })
                  }
                />
                {!option.label.trim() && (
                  <small className="taxonomy-field-error">
                    Enter a display label.
                  </small>
                )}
              </label>
              <div className="structured-option__actions">
                <MoveButtons
                  identity={`${title} option ${optionIdentity}`}
                  kind="option"
                  index={optionIndex}
                  count={scale.options.length}
                  onMove={(direction) =>
                    void reorderOption(optionIndex, optionIndex + direction)
                  }
                />
                <IconButton
                  label={`Delete ${title} option ${optionIdentity}`}
                  title="Delete option"
                  icon="trash"
                  danger
                  onClick={() => {
                    void (async () => {
                      if (
                        await onChange({
                          ...scale,
                          options: removeEntry(scale.options, optionIndex),
                        })
                      ) {
                        onOptionUiIdsChange(
                          removeEntry(optionUiIds, optionIndex),
                        )
                      }
                    })()
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {scale.options.length === 0 && (
        <div className="taxonomy-inline-empty" role="status">
          A scale needs at least one option. Add an option to restore validity.
        </div>
      )}
      <AddButton
        onClick={() => {
          void (async () => {
            const nextValue = nextAvailableIdentifier(
              'option',
              scale.options.map((option) => option.value),
            )
            if (
              await onChange({
                ...scale,
                options: [
                  ...scale.options,
                  {
                    value: nextValue,
                    label: `Option ${scale.options.length + 1}`,
                  },
                ],
              })
            ) {
              onOptionUiIdsChange([...optionUiIds, createOptionUiId()])
            }
          })()
        }}
      >
        Add option
      </AddButton>
    </section>
  )
}
