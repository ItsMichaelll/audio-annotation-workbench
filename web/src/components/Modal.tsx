import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './Modal.module.css'

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  className = '',
  titleId,
  descriptionId,
  initialFocusRef,
  returnFocusRef,
  closeOnEscape = true,
  closeOnBackdrop = true,
  onClose,
  children,
}: {
  open: boolean
  className?: string | undefined
  titleId: string
  descriptionId?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const returnFocus = returnFocusRef?.current ?? previousFocusRef.current
    const background = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element !== backdropRef.current &&
        !element.contains(backdropRef.current),
    )
    const previousOverflow = document.body.style.overflow
    const previousInert = background.map((element) => element.inert)
    document.body.style.overflow = 'hidden'
    background.forEach((element) => {
      element.inert = true
    })

    const frame = requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        dialogRef.current
      target?.focus()
    })

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      background.forEach((element, index) => {
        element.inert = previousInert[index] ?? false
      })
      requestAnimationFrame(() => {
        returnFocus?.focus()
      })
    }
  }, [initialFocusRef, open, returnFocusRef])

  if (!open) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
        [],
    )
    const first = controls[0]
    const last = controls.at(-1)
    if (!first || !last) {
      event.preventDefault()
      dialogRef.current?.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const content = (
    <div
      ref={backdropRef}
      className={styles.backdrop}
      role="presentation"
      onPointerDown={(event) => {
        event.stopPropagation()
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose()
        }
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        ref={dialogRef}
        className={`${styles.dialog}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  )

  return typeof document === 'undefined'
    ? content
    : createPortal(content, document.body)
}

export function ModalTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<'h2'>) {
  return (
    <h2
      {...props}
      className={`${styles.title}${className ? ` ${className}` : ''}`}
    />
  )
}

export function ModalDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<'p'>) {
  return (
    <p
      {...props}
      className={`${styles.description}${className ? ` ${className}` : ''}`}
    />
  )
}

export function ModalActions({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={`${styles.actions}${className ? ` ${className}` : ''}`}
    />
  )
}
