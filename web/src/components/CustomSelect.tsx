import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  listboxKeyAction,
  nextListboxIndex,
  selectListboxOption,
} from '../domain/listbox'
import styles from './CustomSelect.module.css'

export interface CustomSelectOption {
  value: string
  label: string
}

interface CustomSelectBaseProps {
  value: string
  options: readonly CustomSelectOption[]
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  className?: string
  variant?: 'default' | 'inspector' | 'spectrum' | 'taskFilter'
  onChange(value: string): void
}

type CustomSelectProps = CustomSelectBaseProps &
  (
    | { ariaLabel: string; ariaLabelledBy?: never }
    | { ariaLabel?: never; ariaLabelledBy: string }
  )

export function CustomSelect({
  value,
  options,
  ariaLabel,
  ariaLabelledBy,
  disabled = false,
  invalid = false,
  placeholder = 'Select…',
  className,
  variant = 'default',
  onChange,
}: CustomSelectProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  const openListbox = (preferredIndex = selectedIndex) => {
    if (disabled) return
    setActiveIndex(preferredIndex < 0 ? 0 : preferredIndex)
    setOpen(true)
  }
  const closeListbox = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus())
  }
  const choose = (index: number) => {
    const selection = selectListboxOption(options, index)
    if (!selection) return
    setOpen(selection.open)
    queueMicrotask(() => triggerRef.current?.focus())
    onChange(selection.option.value)
  }

  useEffect(() => {
    if (!open) return
    listboxRef.current?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined
  return (
    <div
      ref={rootRef}
      className={`${styles.root}${variant === 'default' ? '' : ` ${styles[variant]}`}${
        invalid ? ` ${styles.inspectorInvalid}` : ''
      }${disabled ? ` ${styles.disabled}` : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        onClick={() => (open ? closeListbox() : openListbox())}
        onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            return
          }
          event.preventDefault()
          openListbox(
            nextListboxIndex(selectedIndex, options.length, event.key),
          )
        }}
      >
        <span>{selected?.label ?? placeholder}</span>
        <i className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={listboxRef}
          id={`${id}-listbox`}
          className={styles.listbox}
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-activedescendant={
            activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          tabIndex={-1}
          onKeyDown={(event) => {
            const action = listboxKeyAction(
              event.key,
              activeIndex,
              options.length,
            )
            if (action.type === 'move') {
              event.preventDefault()
              setActiveIndex(action.index)
            } else if (action.type === 'choose') {
              event.preventDefault()
              choose(activeIndex)
            } else if (action.type === 'close') {
              if (action.restoreFocus) event.preventDefault()
              closeListbox(action.restoreFocus)
            }
          }}
        >
          {options.map((option, index) => (
            <div
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`${styles.option}${
                index === activeIndex ? ` ${styles.optionActive}` : ''
              }`}
              key={option.value}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function CustomSelectField({
  label,
  variant = 'default',
  ...props
}: CustomSelectBaseProps & { label: ReactNode }) {
  const labelId = useId()
  return (
    <div
      className={`${styles.field} ${
        variant === 'spectrum'
          ? styles.fieldSpectrum
          : variant === 'inspector'
            ? styles.fieldInspector
            : ''
      }`}
    >
      <span className={styles.fieldLabel} id={labelId}>
        {label}
      </span>
      <CustomSelect {...props} ariaLabelledBy={labelId} variant={variant} />
    </div>
  )
}
