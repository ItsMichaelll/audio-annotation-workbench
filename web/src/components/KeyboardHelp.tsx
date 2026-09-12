import { useId, useState } from 'react'
import { Icon } from './Icon'
import { Modal, ModalTitle } from './Modal'
import { ShortcutPanel, type ShortcutPanelProps } from './ShortcutPanel'
import styles from './KeyboardHelp.module.css'

export function KeyboardHelp({ labels }: ShortcutPanelProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
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
          <ModalTitle id={titleId}>Work at your own speed.</ModalTitle>
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <p className={styles.description}>
          Keyboard and pointer controls. Shortcuts pause while a form control
          has focus.
        </p>
        <ShortcutPanel {...(labels ? { labels } : {})} />
      </Modal>
    </>
  )
}
