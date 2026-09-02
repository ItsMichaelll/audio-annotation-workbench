import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
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
import styles from './TaxonomyScaleCard.module.css'

function RequiredSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Button
      className={styles.requiredSwitch}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.requiredIndicator} aria-hidden="true" />
      Required
    </Button>
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
      <section className={`${styles.root} ${styles.empty}`}>
        <div>
          <p className={styles.eyebrow}>Optional scale</p>
          <h3 className={styles.emptyTitle}>{title}</h3>
          <p className={styles.emptyDescription}>
            Add this scale when reviewers need to record {name}.
          </p>
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
    <section className={styles.root}>
      <header className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.headerActions}>
          <RequiredSwitch
            checked={scale.required}
            onChange={(required) => void onChange({ ...scale, required })}
          />
          <Button
            variant="danger"
            size="compact"
            className={styles.deleteScale}
            type="button"
            onClick={onRemove}
          >
            Delete scale
          </Button>
        </div>
      </header>

      <div className={styles.optionsHeader} aria-hidden="true">
        <span />
        <span>Stored value *</span>
        <span>Display label *</span>
        <span>Actions</span>
      </div>
      <div className={styles.options}>
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
              className={`${styles.option}${
                draggedOptionUiId === uiId ? ` ${styles.dragging}` : ''
              }${
                optionDropTargetUiId === uiId && draggedOptionUiId !== uiId
                  ? ` ${styles.dragOver}`
                  : ''
              }`}
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
              <label className={styles.field}>
                <span className="visually-hidden">Stored value *</span>
                <input
                  className={styles.input}
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
                  <small className={styles.fieldError}>
                    {duplicateValue
                      ? 'Stored values must be unique.'
                      : 'Enter a stored value.'}
                  </small>
                )}
              </label>
              <label className={styles.field}>
                <span className="visually-hidden">Display label *</span>
                <input
                  className={styles.input}
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
                  <small className={styles.fieldError}>
                    Enter a display label.
                  </small>
                )}
              </label>
              <div className={styles.optionActions}>
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
        <div className={styles.inlineEmpty} role="status">
          A scale needs at least one option. Add an option to restore validity.
        </div>
      )}
      <AddButton
        className={styles.addOption}
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
