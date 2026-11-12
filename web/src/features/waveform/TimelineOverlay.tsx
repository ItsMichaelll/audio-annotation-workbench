import { useEffect, useRef } from 'react'
import type WaveSurfer from 'wavesurfer.js'
import type { ListeningRange } from '../../domain/listeningNormalization'
import styles from './TimelineOverlay.module.css'

interface TimelineOverlayProps {
  wavesurfer: WaveSurfer | null
  selection?: { start: number; end: number } | null
  references?: readonly ListeningRange[]
  clipping?: readonly ListeningRange[]
  referenceLabel?: string
}

/** Uses the same full-content geometry as the waveform and spectrogram. */
export function TimelineOverlay({
  wavesurfer,
  selection,
  references = [],
  clipping = [],
  referenceLabel = 'Speech reference',
}: TimelineOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!wavesurfer) return
    const update = () => {
      const scroll = wavesurfer.getWrapper().parentElement
      const root = rootRef.current
      const playhead = playheadRef.current
      const duration = wavesurfer.getDuration()
      if (!root || !scroll || !(duration > 0)) return
      const pxPerSecond = scroll.scrollWidth / duration
      const left = scroll.scrollLeft
      const width = scroll.clientWidth
      if (playhead) {
        const x = wavesurfer.getCurrentTime() * pxPerSecond - left
        playhead.style.transform = `translateX(${x}px)`
        playhead.style.display = x < 0 || x > width ? 'none' : 'block'
      }
      for (const element of root.querySelectorAll<HTMLElement>(
        '[data-start]',
      )) {
        const start = Number(element.dataset.start) * pxPerSecond - left
        const end = Number(element.dataset.end) * pxPerSecond - left
        const visibleStart = Math.max(0, start)
        const visibleEnd = Math.min(width, end)
        element.style.left = `${visibleStart}px`
        element.style.width = `${Math.max(0, visibleEnd - visibleStart)}px`
        element.style.display = visibleEnd > visibleStart ? 'block' : 'none'
      }
    }
    const unsubscribers = [
      wavesurfer.on('timeupdate', update),
      wavesurfer.on('scroll', update),
      wavesurfer.on('redraw', update),
      wavesurfer.on('resize', update),
    ]
    update()
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [clipping, references, selection, wavesurfer])
  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      {selection && (
        <div
          className={styles.selection}
          data-start={selection.start}
          data-end={selection.end}
        />
      )}
      {references.map((range) => (
        <div
          key={range.id}
          className={styles.reference}
          data-start={range.start}
          data-end={range.end}
        >
          <span>{referenceLabel}</span>
        </div>
      ))}
      {clipping.map((range) => (
        <div
          key={range.id}
          className={styles.clipping}
          data-start={range.start}
          data-end={range.end}
        >
          <span>Playback clipping</span>
        </div>
      ))}
      <div ref={playheadRef} className={styles.playhead} />
    </div>
  )
}
