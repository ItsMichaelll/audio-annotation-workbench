import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ConfirmationContext,
  type ConfirmationOptions,
} from './confirmationContext'
import { Button } from './Button'
import styles from './ConfirmationDialog.module.css'
import { Modal, ModalActions, ModalDescription, ModalTitle } from './Modal'

interface ConfirmationRequest {
  options: ConfirmationOptions
  resolve: (accepted: boolean) => void
}

export function ConfirmationDialog({
  request,
  onResult,
}: {
  request: ConfirmationOptions | null
  onResult: (accepted: boolean) => void
}) {
  const id = useId()
  if (!request) return null
  return (
    <Modal
      open
      className={request.tone === 'danger' ? styles.danger : undefined}
      titleId={`${id}-title`}
      descriptionId={`${id}-message`}
      onClose={() => onResult(false)}
    >
      <ModalTitle id={`${id}-title`}>{request.title}</ModalTitle>
      <ModalDescription id={`${id}-message`}>
        {request.message}
      </ModalDescription>
      <ModalActions>
        <Button type="button" onClick={() => onResult(false)}>
          {request.cancelLabel ?? 'Cancel'}
        </Button>
        <Button
          variant={request.tone === 'danger' ? 'danger' : 'primary'}
          type="button"
          onClick={() => onResult(true)}
        >
          {request.confirmLabel ?? 'Continue'}
        </Button>
      </ModalActions>
    </Modal>
  )
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<ConfirmationRequest[]>([])
  const activeRef = useRef<ConfirmationRequest | null>(null)
  const mountedRef = useRef(true)
  const [active, setActive] = useState<ConfirmationRequest | null>(null)

  const activateNext = useCallback(() => {
    if (!mountedRef.current || activeRef.current) return
    const next = queueRef.current.shift() ?? null
    activeRef.current = next
    setActive(next)
  }, [])

  const confirm = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => {
        queueRef.current.push({ options, resolve })
        activateNext()
      }),
    [activateNext],
  )

  const settle = useCallback(
    (accepted: boolean) => {
      const request = activeRef.current
      if (!request) return
      activeRef.current = null
      setActive(null)
      request.resolve(accepted)
      queueMicrotask(activateNext)
    },
    [activateNext],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      activeRef.current?.resolve(false)
      queueRef.current.forEach((request) => request.resolve(false))
      activeRef.current = null
      queueRef.current = []
    }
  }, [])

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      <ConfirmationDialog request={active?.options ?? null} onResult={settle} />
    </ConfirmationContext.Provider>
  )
}
