import type { DragEvent, MouseEvent } from 'react'
import { Button } from '../../components/Button'
import type { AnnotationLabel } from '../../domain/annotationTaxonomy'
import {
  ColorSwatchInput,
  DragHandle,
  IconButton,
  MoveButtons,
} from './TaxonomyEditorControls'
import styles from './TaxonomyLabelCard.module.css'

function optionalText<T extends AnnotationLabel>(
  item: T,
  field: 'description' | 'color' | 'shortcut',
  value: string,
): T {
  const next = { ...item }
  if (value) next[field] = value
  else delete next[field]
  return next
}

function labelDisplayName(label: AnnotationLabel): string {
  return label.name.trim() || label.id.trim() || 'Unnamed label'
}

function ScopeButtons({
  label,
  onChange,
}: {
  label: AnnotationLabel
  onChange: (label: AnnotationLabel) => void
}) {
  const identity = labelDisplayName(label)
  return (
    <div className={styles.scopeField}>
      <span className={styles.fieldLabel}>Scope *</span>
      <div
        className={styles.toggleGroup}
        role="group"
        aria-label={`Scopes for ${identity}`}
      >
        {(['region', 'clip'] as const).map((scope) => {
          const pressed = label.scopes.includes(scope)
          return (
            <Button
              size="compact"
              key={scope}
              className={styles.toggleButton}
              type="button"
              aria-pressed={pressed}
              onClick={() =>
                onChange({
                  ...label,
                  scopes: pressed
                    ? label.scopes.filter((item) => item !== scope)
                    : [...label.scopes, scope],
                })
              }
            >
              {scope === 'region' ? 'Region' : 'Clip'}
            </Button>
          )
        })}
      </div>
      {label.scopes.length === 0 && (
        <small className={styles.fieldError} role="status">
          Select Region, Clip, or both.
        </small>
      )}
    </div>
  )
}

export function LabelCard({
  label,
  uiId,
  index,
  count,
  expanded,
  dragging,
  dragOver,
  onChange,
  onMove,
  onRemove,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  label: AnnotationLabel
  uiId: string
  index: number
  count: number
  expanded: boolean
  dragging: boolean
  dragOver: boolean
  onChange: (label: AnnotationLabel) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onToggle: () => void
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}) {
  const identity = labelDisplayName(label)
  const bodyId = `${uiId}-body`
  const validColor = !label.color || /^#[0-9a-f]{6}$/i.test(label.color)
  const shouldToggleHeader = (event: MouseEvent<HTMLElement>) =>
    !(event.target instanceof Element) ||
    !event.target.closest('button, input, label, select, textarea, a')

  const toggleFromHeaderClick = (event: MouseEvent<HTMLElement>) => {
    if (shouldToggleHeader(event)) onToggle()
  }

  return (
    <article
      className={`${styles.root}${dragging ? ` ${styles.dragging}` : ''}${
        dragOver ? ` ${styles.dragOver}` : ''
      }`}
      data-label-ui-id={uiId}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <header className={styles.header} onClick={toggleFromHeaderClick}>
        <div className={styles.identity}>
          <DragHandle
            label={`Drag ${identity} to reorder`}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <ColorSwatchInput
            value={label.color}
            label={`Choose header color for ${identity}`}
            onChange={(color) => onChange(optionalText(label, 'color', color))}
          />
          <div className={styles.identityText}>
            <strong className={styles.identityName}>{identity}</strong>
            <small className={styles.identityId}>
              {label.id || 'Stable ID required'}
            </small>
          </div>
        </div>
        <div className={styles.summary}>
          <div className={styles.badges} aria-label="Active scopes">
            {label.scopes.includes('region') && (
              <span className={styles.badge}>Region</span>
            )}
            {label.scopes.includes('clip') && (
              <span className={styles.badge}>Clip</span>
            )}
          </div>
          {label.shortcut && (
            <kbd className={styles.shortcut} title="Keyboard shortcut">
              {label.shortcut}
            </kbd>
          )}
          <IconButton
            label={`${expanded ? 'Collapse' : 'Expand'} ${identity}`}
            icon="chevron-down"
            expanded={expanded}
            controls={bodyId}
            onClick={onToggle}
          />
          <IconButton
            label={`Delete ${identity}`}
            title="Delete label"
            icon="trash"
            danger
            onClick={onRemove}
          />
        </div>
      </header>

      <div id={bodyId} className={styles.body} hidden={!expanded}>
        <div className={styles.identityRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name *</span>
            <input
              className={styles.identityInput}
              value={label.name}
              aria-label={`Name for ${identity}`}
              aria-invalid={!label.name.trim()}
              onChange={(event) =>
                onChange({ ...label, name: event.target.value })
              }
            />
            {!label.name.trim() && (
              <small className={styles.fieldError}>Enter a display name.</small>
            )}
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Stable ID *</span>
            <input
              className={styles.identityInput}
              value={label.id}
              aria-label={`Stable ID for ${identity}`}
              aria-invalid={!label.id.trim()}
              onChange={(event) =>
                onChange({ ...label, id: event.target.value })
              }
            />
            {!label.id.trim() && (
              <small className={styles.fieldError}>Enter a stable ID.</small>
            )}
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Description</span>
          <textarea
            className={`${styles.standardInput} ${styles.descriptionTextarea}`}
            rows={4}
            value={label.description ?? ''}
            aria-label={`Description for ${identity}`}
            onChange={(event) =>
              onChange(optionalText(label, 'description', event.target.value))
            }
          />
        </label>

        <div className={styles.detailsRow}>
          <ScopeButtons label={label} onChange={onChange} />

          <div className={styles.colorField}>
            <span className={styles.fieldLabel}>Color</span>
            <div className={styles.colorControl}>
              <ColorSwatchInput
                className={styles.detailSwatch}
                value={label.color}
                label={`Choose color for ${identity}`}
                onChange={(color) =>
                  onChange(optionalText(label, 'color', color))
                }
              />
              <input
                type="text"
                className={styles.colorInput}
                placeholder="#4f8cff"
                value={label.color ?? ''}
                aria-label={`Color value for ${identity}`}
                aria-invalid={!validColor}
                onChange={(event) =>
                  onChange(optionalText(label, 'color', event.target.value))
                }
              />
            </div>
            {!validColor && (
              <small className={styles.fieldError}>
                Use a six-digit hex color, such as #4f8cff.
              </small>
            )}
          </div>

          <label className={`${styles.field} ${styles.shortcutField}`}>
            <span className={styles.fieldLabel}>Shortcut</span>
            <input
              className={styles.shortcutInput}
              maxLength={1}
              value={label.shortcut ?? ''}
              aria-label={`Shortcut for ${identity}`}
              onChange={(event) =>
                onChange(optionalText(label, 'shortcut', event.target.value))
              }
            />
          </label>
        </div>

        <div className={styles.reorder}>
          <span className={styles.fieldLabel}>Reorder</span>
          <div className={styles.reorderControls}>
            <MoveButtons
              identity={identity}
              kind="label"
              index={index}
              count={count}
              onMove={onMove}
            />
          </div>
        </div>
      </div>
    </article>
  )
}
