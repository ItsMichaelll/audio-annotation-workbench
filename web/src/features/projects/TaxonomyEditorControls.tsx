import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { Modal } from '../../components/Modal'
import {
  hexToHsv,
  hsvToHex,
  normalizeHexColor,
  type HsvColor,
} from '../../domain/colorPicker'

type IconName =
  'add' | 'chevron-down' | 'drag' | 'move-down' | 'move-up' | 'trash'

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'trash') {
    return (
      <svg {...common}>
        <path d="M3 4.5h10M6 2.5h4l.5 2H5.5l.5-2ZM5 6.5v6m3-6v6m3-6v6M4 4.5l.6 9h6.8l.6-9" />
      </svg>
    )
  }
  if (name === 'drag') {
    return (
      <svg {...common}>
        <circle cx="5" cy="4" r=".75" fill="currentColor" stroke="none" />
        <circle cx="11" cy="4" r=".75" fill="currentColor" stroke="none" />
        <circle cx="5" cy="8" r=".75" fill="currentColor" stroke="none" />
        <circle cx="11" cy="8" r=".75" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r=".75" fill="currentColor" stroke="none" />
        <circle cx="11" cy="12" r=".75" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (name === 'add') {
    return (
      <svg {...common}>
        <path d="M8 3.25v9.5M3.25 8h9.5" />
      </svg>
    )
  }
  if (name === 'chevron-down') {
    return (
      <svg {...common}>
        <path d="m4 6 4 4 4-4" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path
        d={
          name === 'move-up'
            ? 'm4.5 7.5 3.5-3.5 3.5 3.5M8 4v8'
            : 'M8 4v8m-3.5-3.5L8 12l3.5-3.5'
        }
      />
    </svg>
  )
}

export function IconButton({
  label,
  title = label,
  icon,
  disabled = false,
  danger = false,
  expanded,
  controls,
  onClick,
}: {
  label: string
  title?: string
  icon: IconName
  disabled?: boolean
  danger?: boolean
  expanded?: boolean
  controls?: string
  onClick: () => void
}) {
  return (
    <button
      className={`compact-icon-button${danger ? ' danger-button compact-danger-button' : ''}${icon === 'chevron-down' ? ' expand-button' : ''}`}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  )
}

export function DragHandle({
  label,
  onDragStart,
  onDragEnd,
}: {
  label: string
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
}) {
  return (
    <button
      className="compact-icon-button drag-handle"
      type="button"
      draggable
      aria-label={label}
      title={label}
      onDragStart={(event) => {
        const dragItem = event.currentTarget.closest<HTMLElement>(
          '.taxonomy-drag-item',
        )
        if (dragItem) event.dataTransfer.setDragImage(dragItem, 20, 20)
        onDragStart(event)
      }}
      onDragEnd={onDragEnd}
    >
      <Icon name="drag" />
    </button>
  )
}

export function ColorSwatchInput({
  value,
  label,
  onChange,
}: {
  value: string | undefined
  label: string
  onChange: (value: string) => void
}) {
  const dialogId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const hexInputRef = useRef<HTMLInputElement>(null)
  const valid = normalizeHexColor(value)
  const [open, setOpen] = useState(false)
  const [draftHex, setDraftHex] = useState(valid ?? '#4F8CFF')
  const draftHsv = hexToHsv(draftHex) ?? {
    hue: 216,
    saturation: 69,
    value: 100,
  }
  const style: CSSProperties | undefined = valid
    ? { backgroundColor: valid }
    : undefined

  const openPicker = () => {
    setDraftHex(valid ?? '#4F8CFF')
    setOpen(true)
  }

  const closePicker = () => {
    setOpen(false)
  }

  const updateColor = (color: HsvColor) => {
    setDraftHex(hsvToHex(color))
  }

  const updateFromSurface = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const saturation = Math.round(
      Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1) *
        100,
    )
    const brightness = Math.round(
      (1 -
        Math.min(
          Math.max((event.clientY - bounds.top) / bounds.height, 0),
          1,
        )) *
        100,
    )
    updateColor({
      ...draftHsv,
      saturation,
      value: brightness,
    })
  }

  const handleSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = { ...draftHsv }
    if (event.key === 'ArrowLeft') next.saturation -= 1
    else if (event.key === 'ArrowRight') next.saturation += 1
    else if (event.key === 'ArrowDown') next.value -= 1
    else if (event.key === 'ArrowUp') next.value += 1
    else return
    event.preventDefault()
    updateColor(next)
  }

  const normalizedDraft = normalizeHexColor(draftHex)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`interactive-color-swatch${valid ? '' : ' is-empty'}`}
        style={style}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        title={label}
        onClick={openPicker}
      />
      <Modal
        open={open}
        className="color-picker-dialog"
        titleId={`${dialogId}-title`}
        descriptionId={`${dialogId}-description`}
        initialFocusRef={hexInputRef}
        returnFocusRef={triggerRef}
        onClose={closePicker}
      >
        <header className="color-picker-dialog__header">
          <div>
            <h2 id={`${dialogId}-title`}>Choose color</h2>
            <p id={`${dialogId}-description`}>{label}</p>
          </div>
          <IconButton
            label="Close color picker"
            icon="add"
            onClick={closePicker}
          />
        </header>

        <div
          className="color-picker-surface"
          role="slider"
          tabIndex={0}
          aria-label="Saturation and brightness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(draftHsv.saturation)}
          aria-valuetext={`${Math.round(draftHsv.saturation)}% saturation, ${Math.round(draftHsv.value)}% brightness`}
          style={
            {
              '--color-picker-hue': `${draftHsv.hue}`,
            } as CSSProperties
          }
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            updateFromSurface(event)
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateFromSurface(event)
            }
          }}
          onKeyDown={handleSurfaceKeyDown}
        >
          <span
            className="color-picker-surface__marker"
            style={{
              left: `${draftHsv.saturation}%`,
              top: `${100 - draftHsv.value}%`,
            }}
          />
        </div>

        <label className="color-picker-slider-field">
          <span>Hue</span>
          <input
            type="range"
            min="0"
            max="359"
            value={draftHsv.hue}
            aria-label="Hue"
            onChange={(event) =>
              updateColor({
                ...draftHsv,
                hue: Number(event.target.value),
              })
            }
          />
        </label>

        <div className="color-picker-value-row">
          <span
            className="color-picker-preview"
            style={{
              backgroundColor: normalizedDraft ?? 'transparent',
            }}
            aria-hidden="true"
          />
          <label>
            <span>Hex</span>
            <input
              ref={hexInputRef}
              value={draftHex}
              maxLength={7}
              spellCheck={false}
              aria-label="Hex color"
              aria-invalid={!normalizedDraft}
              onChange={(event) => setDraftHex(event.target.value)}
            />
          </label>
        </div>

        <div className="color-picker-actions">
          <button type="button" onClick={closePicker}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!normalizedDraft}
            onClick={() => {
              if (!normalizedDraft) return
              onChange(normalizedDraft)
              closePicker()
            }}
          >
            Apply color
          </button>
        </div>
      </Modal>
    </>
  )
}

export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button className="button-with-icon" type="button" onClick={onClick}>
      <Icon name="add" />
      {children}
    </button>
  )
}

export function MoveButtons({
  identity,
  kind,
  index,
  count,
  onMove,
}: {
  identity: string
  kind: 'label' | 'option'
  index: number
  count: number
  onMove: (direction: -1 | 1) => void
}) {
  return (
    <>
      <IconButton
        label={`Move ${identity} up`}
        title={`Move ${kind} up`}
        icon="move-up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
      />
      <IconButton
        label={`Move ${identity} down`}
        title={`Move ${kind} down`}
        icon="move-down"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      />
    </>
  )
}
