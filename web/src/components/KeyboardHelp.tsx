import { useEffect, useId, useState } from 'react'
import { isDialogTarget, isEditableTarget } from '../domain/keyboard'
import { Icon } from './Icon'
import { Modal, ModalTitle } from './Modal'
import { ShortcutPanel, type ShortcutPanelProps } from './ShortcutPanel'
import styles from './KeyboardHelp.module.css'

export function KeyboardHelp({ labels, groups }: ShortcutPanelProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const hReserved =
    labels?.some((label) => label.shortcut?.toLowerCase() === 'h') ?? false
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableTarget(event.target) ||
        isDialogTarget(event.target)
      )
        return
      if (
        event.key === '?' ||
        (!hReserved && event.key.toLowerCase() === 'h')
      ) {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [hReserved])
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
        onClick={() => setOpen(true)}
      >
        <Icon name="keyboard" size={18} />
      </button>
      <Modal
        open={open}
        titleId={titleId}
        onClose={() => setOpen(false)}
        className={styles.dialog}
      >
        <div className={styles.heading}>
          <ModalTitle id={titleId}>Keyboard and pointer controls</ModalTitle>
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <ShortcutPanel
          {...(labels ? { labels } : {})}
          {...(groups ? { groups } : {})}
        />
      </Modal>
    </>
  )
}
