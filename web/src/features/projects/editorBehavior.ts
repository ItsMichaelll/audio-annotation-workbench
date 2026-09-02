import { useEffect, useRef } from 'react'
import { useConfirmation } from '../../components/confirmationContext'

export function isSaveShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    event.key.toLowerCase() === 's'
  )
}

export function useEditorProtection(dirty: boolean, save: () => void): void {
  const saveRef = useRef(save)

  useEffect(() => {
    saveRef.current = save
  }, [save])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    const keyDown = (event: KeyboardEvent) => {
      if (!isSaveShortcut(event)) return
      event.preventDefault()
      saveRef.current()
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('keydown', keyDown)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('keydown', keyDown)
    }
  }, [dirty])
}

export function shouldProtectLinkNavigation({
  button,
  ctrlKey,
  metaKey,
  shiftKey,
  altKey,
  download,
  target,
  linkOrigin,
  pageOrigin,
}: {
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  download: boolean
  target: string
  linkOrigin: string
  pageOrigin: string
}): boolean {
  return (
    button === 0 &&
    !ctrlKey &&
    !metaKey &&
    !shiftKey &&
    !altKey &&
    !download &&
    (!target || target === '_self') &&
    linkOrigin === pageOrigin
  )
}

export function useUnsavedRouteProtection(dirty: boolean): void {
  const confirm = useConfirmation()
  const bypassRef = useRef<HTMLAnchorElement | null>(null)
  const pendingRef = useRef(false)

  useEffect(() => {
    if (!dirty) return
    const protectLinkNavigation = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest<HTMLAnchorElement>('a[href]')
      if (!link) return
      if (bypassRef.current === link) {
        bypassRef.current = null
        return
      }
      if (
        !shouldProtectLinkNavigation({
          button: event.button,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          download: Boolean(link.download),
          target: link.target,
          linkOrigin: link.origin,
          pageOrigin: window.location.origin,
        })
      )
        return
      event.preventDefault()
      event.stopPropagation()
      if (pendingRef.current) return
      pendingRef.current = true
      void confirm({
        title: 'Discard unsaved changes?',
        message: 'Your unsaved edits will be lost if you leave this page.',
        confirmLabel: 'Discard and leave',
        tone: 'danger',
      }).then((accepted) => {
        pendingRef.current = false
        if (!accepted || !link.isConnected) return
        bypassRef.current = link
        link.click()
      })
    }
    document.addEventListener('click', protectLinkNavigation, true)
    return () =>
      document.removeEventListener('click', protectLinkNavigation, true)
  }, [confirm, dirty])
}

export function downloadText(
  source: string,
  filename: string,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([source], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
