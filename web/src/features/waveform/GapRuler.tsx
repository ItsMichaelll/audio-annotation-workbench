import { useEffect, useRef, useState } from 'react'
import type WaveSurfer from 'wavesurfer.js'
import styles from './GapRuler.module.css'

export function GapRuler({ wavesurfer }: { wavesurfer: WaveSurfer | null }) {
  const [range, setRange] = useState({ start: 0, end: 0.1 })
  const [geometry, setGeometry] = useState({
    pixelsPerSecond: 1,
    scrollLeft: 0,
    width: 1,
  })
  const dragRef = useRef<{
    x: number
    start: number
    end: number
    edge: 'start' | 'end' | 'body'
  } | null>(null)
  const duration = wavesurfer?.getDuration() ?? 0
  useEffect(() => {
    if (!wavesurfer) return
    const update = () => {
      const scroll = wavesurfer.getWrapper().parentElement
      if (!scroll) return
      setGeometry({
        pixelsPerSecond:
          scroll.scrollWidth / Math.max(0.001, wavesurfer.getDuration()),
        scrollLeft: scroll.scrollLeft,
        width: scroll.clientWidth,
      })
    }
    const off = [
      wavesurfer.on('scroll', update),
      wavesurfer.on('redraw', update),
      wavesurfer.on('resize', update),
    ]
    update()
    return () => off.forEach((unsubscribe) => unsubscribe())
  }, [wavesurfer])
  const change = (start: number, end: number) => {
    const boundedStart = Math.max(0, Math.min(duration, start))
    const boundedEnd = Math.max(boundedStart, Math.min(duration, end))
    setRange({ start: boundedStart, end: boundedEnd })
  }
  const left = range.start * geometry.pixelsPerSecond - geometry.scrollLeft
  const right = range.end * geometry.pixelsPerSecond - geometry.scrollLeft
  return (
    <section className={styles.root} aria-label="Observational gap ruler">
      <div className={styles.fields}>
        <strong>Gap ruler</strong>
        <label>
          Start{' '}
          <input
            type="number"
            min="0"
            max={duration}
            step="0.001"
            value={range.start}
            onChange={(event) => {
              if (Number.isFinite(event.target.valueAsNumber))
                change(event.target.valueAsNumber, range.end)
            }}
          />
        </label>
        <label>
          End{' '}
          <input
            type="number"
            min={range.start}
            max={duration}
            step="0.001"
            value={range.end}
            onChange={(event) => {
              if (Number.isFinite(event.target.valueAsNumber))
                change(range.start, event.target.valueAsNumber)
            }}
          />
        </label>
        <output>{((range.end - range.start) * 1000).toFixed(1)} ms</output>
      </div>
      <div className={styles.track}>
        {(['start', 'body', 'end'] as const).map((edge) => {
          const position = edge === 'end' ? right : left
          const hidden =
            edge !== 'body' && (position < 0 || position > geometry.width)
          return (
            <button
              key={edge}
              type="button"
              className={edge === 'body' ? styles.interval : styles.grip}
              style={{
                left: `${Math.max(0, Math.min(geometry.width, position))}px`,
                width:
                  edge === 'body'
                    ? `${Math.max(0, Math.min(geometry.width, right) - Math.max(0, left))}px`
                    : '7px',
              }}
              hidden={hidden}
              aria-label={`Move gap ruler ${edge === 'body' ? 'interval' : edge}`}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                  return
                event.preventDefault()
                const step = event.key === 'ArrowLeft' ? -0.001 : 0.001
                if (edge === 'start') change(range.start + step, range.end)
                else if (edge === 'end') change(range.start, range.end + step)
                else {
                  const shift = Math.max(
                    -range.start,
                    Math.min(duration - range.end, step),
                  )
                  change(range.start + shift, range.end + shift)
                }
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                dragRef.current = { x: event.clientX, ...range, edge }
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current
                if (
                  !drag ||
                  !event.currentTarget.hasPointerCapture(event.pointerId)
                )
                  return
                const delta =
                  (event.clientX - drag.x) / geometry.pixelsPerSecond
                if (drag.edge === 'start')
                  change(Math.min(drag.end, drag.start + delta), drag.end)
                else if (drag.edge === 'end')
                  change(drag.start, drag.end + delta)
                else {
                  const shift = Math.max(
                    -drag.start,
                    Math.min(duration - drag.end, delta),
                  )
                  change(drag.start + shift, drag.end + shift)
                }
              }}
              onPointerUp={(event) => {
                dragRef.current = null
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onPointerCancel={() => {
                dragRef.current = null
              }}
            />
          )
        })}
      </div>
    </section>
  )
}
