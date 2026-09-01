import { useCallback, useEffect, useRef, useState } from 'react'
import { CustomSelectField } from '../../components/CustomSelect'
import {
  DECIBEL_GRID,
  DEFAULT_SPECTRUM_RESPONSE,
  FREQUENCY_GRID_HZ,
  SPECTRUM_MIN_DB,
  SPECTRUM_MIN_FREQUENCY,
  SPECTRUM_RESPONSES,
  isSpectrumResponse,
  type SpectrumResponse,
} from './spectrumConfig'
import {
  aggregateLogFrequencyBins,
  dbToY,
  displayMaxFrequency,
  frequencyToX,
  resetPeakHold,
  updatePeakHold,
  xToFrequency,
  yToDb,
} from './spectrumMath'

interface SpectrumAnalyzerProps {
  analyserNode: AnalyserNode | null
  analyzerError: string | null
  fftSize: number
  isPlaying: boolean
  sampleRate: number
  onResponseChange(response: SpectrumResponse): void
  onClose(): void
}

interface HoverPosition {
  x: number
  y: number
}

interface SpectrumFrame {
  canvasWidth: number
  canvasHeight: number
  plotLeft: number
  plotTop: number
  plotWidth: number
  plotHeight: number
  frequencyData: Float32Array<ArrayBuffer>
  liveValues: Float32Array
  peakValues: Float32Array
  peakHoldUntil: Float64Array
  lastFrameTime: number
  hasFrame: boolean
  accentColor: string
  peakColor: string
  textColor: string
  mutedColor: string
  gridColor: string
}

const EMPTY_FRAME: SpectrumFrame = {
  canvasWidth: 0,
  canvasHeight: 0,
  plotLeft: 48,
  plotTop: 12,
  plotWidth: 0,
  plotHeight: 0,
  frequencyData: new Float32Array(),
  liveValues: new Float32Array(),
  peakValues: new Float32Array(),
  peakHoldUntil: new Float64Array(),
  lastFrameTime: 0,
  hasFrame: false,
  accentColor: '#4690ff',
  peakColor: '#18f76e',
  textColor: '#edf1f2',
  mutedColor: '#8d979e',
  gridColor: 'rgba(141, 151, 158, 0.16)',
}

function formatFrequency(frequency: number): string {
  if (frequency >= 1_000) {
    const kilohertz = frequency / 1_000
    return `${kilohertz >= 10 ? kilohertz.toFixed(0) : kilohertz.toFixed(1)} kHz`
  }
  return `${Math.round(frequency)} Hz`
}

function drawGrid(
  context: CanvasRenderingContext2D,
  frame: SpectrumFrame,
  maxFrequency: number,
): void {
  const { plotLeft, plotTop, plotWidth, plotHeight } = frame
  context.lineWidth = 1
  context.strokeStyle = frame.gridColor
  context.fillStyle = frame.mutedColor
  context.font = '10px Consolas, "SFMono-Regular", monospace'

  for (const decibels of DECIBEL_GRID) {
    const y = plotTop + dbToY(decibels, plotHeight)
    context.beginPath()
    context.moveTo(plotLeft, Math.round(y) + 0.5)
    context.lineTo(plotLeft + plotWidth, Math.round(y) + 0.5)
    context.stroke()
    context.textAlign = 'right'
    context.textBaseline = 'middle'
    context.fillText(`${decibels}`, plotLeft - 7, y)
  }

  for (const frequency of FREQUENCY_GRID_HZ) {
    if (frequency > maxFrequency) continue
    const x =
      plotLeft +
      frequencyToX(frequency, plotWidth, SPECTRUM_MIN_FREQUENCY, maxFrequency)
    context.beginPath()
    context.moveTo(Math.round(x) + 0.5, plotTop)
    context.lineTo(Math.round(x) + 0.5, plotTop + plotHeight)
    context.stroke()
    context.textAlign =
      frequency === SPECTRUM_MIN_FREQUENCY
        ? 'left'
        : frequency === maxFrequency
          ? 'right'
          : 'center'
    context.textBaseline = 'top'
    context.fillText(formatFrequency(frequency), x, plotTop + plotHeight + 7)
  }

  context.strokeStyle = 'rgba(141, 151, 158, 0.32)'
  context.strokeRect(
    Math.round(plotLeft) + 0.5,
    Math.round(plotTop) + 0.5,
    Math.round(plotWidth),
    Math.round(plotHeight),
  )
}

function drawLiveTrace(
  context: CanvasRenderingContext2D,
  frame: SpectrumFrame,
): void {
  if (!frame.hasFrame || frame.liveValues.length === 0) return
  const { plotLeft, plotTop, plotWidth, plotHeight, liveValues } = frame
  const xStep = plotWidth / Math.max(liveValues.length - 1, 1)

  context.beginPath()
  for (let index = 0; index < liveValues.length; index += 1) {
    const x = plotLeft + index * xStep
    const y = plotTop + dbToY(liveValues[index] ?? SPECTRUM_MIN_DB, plotHeight)
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.lineTo(plotLeft + plotWidth, plotTop + plotHeight)
  context.lineTo(plotLeft, plotTop + plotHeight)
  context.closePath()
  context.fillStyle = 'rgba(70, 144, 255, 0.12)'
  context.fill()

  context.beginPath()
  for (let index = 0; index < liveValues.length; index += 1) {
    const x = plotLeft + index * xStep
    const y = plotTop + dbToY(liveValues[index] ?? SPECTRUM_MIN_DB, plotHeight)
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.strokeStyle = frame.accentColor
  context.lineWidth = 1.7
  context.lineJoin = 'round'
  context.stroke()
}

function drawPeakTrace(
  context: CanvasRenderingContext2D,
  frame: SpectrumFrame,
): void {
  if (!frame.hasFrame || frame.peakValues.length === 0) return
  const { plotLeft, plotTop, plotWidth, plotHeight, peakValues } = frame
  const xStep = plotWidth / Math.max(peakValues.length - 1, 1)

  context.beginPath()
  for (let index = 0; index < peakValues.length; index += 1) {
    const x = plotLeft + index * xStep
    const y = plotTop + dbToY(peakValues[index] ?? SPECTRUM_MIN_DB, plotHeight)
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.strokeStyle = frame.peakColor
  context.lineWidth = 0.9
  context.globalAlpha = 0.88
  context.stroke()
  context.globalAlpha = 1
}

function drawHover(
  context: CanvasRenderingContext2D,
  frame: SpectrumFrame,
  hover: HoverPosition,
  maxFrequency: number,
): void {
  const { plotLeft, plotTop, plotWidth, plotHeight } = frame
  if (
    hover.x < plotLeft ||
    hover.x > plotLeft + plotWidth ||
    hover.y < plotTop ||
    hover.y > plotTop + plotHeight
  ) {
    return
  }

  context.save()
  context.strokeStyle = 'rgba(237, 241, 242, 0.58)'
  context.lineWidth = 1
  context.setLineDash([3, 3])
  context.beginPath()
  context.moveTo(hover.x + 0.5, plotTop)
  context.lineTo(hover.x + 0.5, plotTop + plotHeight)
  context.moveTo(plotLeft, hover.y + 0.5)
  context.lineTo(plotLeft + plotWidth, hover.y + 0.5)
  context.stroke()
  context.setLineDash([])

  const frequency = xToFrequency(
    hover.x - plotLeft,
    plotWidth,
    SPECTRUM_MIN_FREQUENCY,
    maxFrequency,
  )
  const decibels = yToDb(hover.y - plotTop, plotHeight)
  const label = `${formatFrequency(frequency)}  ${decibels.toFixed(1)} dB`
  context.font = '11px Consolas, "SFMono-Regular", monospace'
  const labelWidth = context.measureText(label).width + 14
  const labelHeight = 24
  const labelX = Math.min(
    Math.max(hover.x + 10, plotLeft + 4),
    plotLeft + plotWidth - labelWidth - 4,
  )
  const labelY = Math.min(
    Math.max(hover.y - labelHeight - 8, plotTop + 4),
    plotTop + plotHeight - labelHeight - 4,
  )
  context.fillStyle = 'rgba(13, 15, 16, 0.94)'
  context.fillRect(labelX, labelY, labelWidth, labelHeight)
  context.strokeStyle = 'rgba(237, 241, 242, 0.34)'
  context.strokeRect(
    labelX + 0.5,
    labelY + 0.5,
    labelWidth - 1,
    labelHeight - 1,
  )
  context.fillStyle = frame.textColor
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(label, labelX + 7, labelY + labelHeight / 2)
  context.restore()
}

export function SpectrumAnalyzer({
  analyserNode,
  analyzerError,
  fftSize,
  isPlaying,
  sampleRate,
  onResponseChange,
  onClose,
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<SpectrumFrame>({ ...EMPTY_FRAME })
  const hoverRef = useRef<HoverPosition | null>(null)
  const peakHoldEnabledRef = useRef(true)
  const [frozen, setFrozen] = useState(false)
  const [peakHoldEnabled, setPeakHoldEnabled] = useState(true)
  const [response, setResponse] = useState<SpectrumResponse>(
    DEFAULT_SPECTRUM_RESPONSE,
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    if (!canvas || frame.canvasWidth <= 0 || frame.canvasHeight <= 0) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, frame.canvasWidth, frame.canvasHeight)
    context.fillStyle = '#0b0d0e'
    context.fillRect(0, 0, frame.canvasWidth, frame.canvasHeight)
    const maxFrequency = displayMaxFrequency(sampleRate || 48_000)
    if (maxFrequency <= SPECTRUM_MIN_FREQUENCY) return

    drawGrid(context, frame, maxFrequency)
    drawLiveTrace(context, frame)
    if (peakHoldEnabledRef.current) drawPeakTrace(context, frame)
    if (hoverRef.current) {
      drawHover(context, frame, hoverRef.current, maxFrequency)
    }

    if (!frame.hasFrame || analyzerError) {
      context.fillStyle = analyzerError
        ? 'rgba(255, 133, 133, 0.88)'
        : 'rgba(141, 151, 158, 0.76)'
      context.font = '12px Inter, ui-sans-serif, system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(
        analyzerError ?? 'Play audio to begin analysis',
        frame.plotLeft + frame.plotWidth / 2,
        frame.plotTop + frame.plotHeight / 2,
        Math.max(160, frame.plotWidth - 40),
      )
    }
  }, [analyzerError, sampleRate])

  useEffect(() => {
    onResponseChange(response)
  }, [onResponseChange, response])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.floor(bounds.width))
      const cssHeight = Math.max(1, Math.floor(bounds.height))
      const deviceScale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3)
      canvas.width = Math.round(cssWidth * deviceScale)
      canvas.height = Math.round(cssHeight * deviceScale)
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0)

      const plotLeft = 48
      const plotTop = 12
      const plotWidth = Math.max(1, cssWidth - plotLeft - 14)
      const plotHeight = Math.max(1, cssHeight - plotTop - 26)
      const columns = Math.max(1, Math.floor(plotWidth))
      const styles = getComputedStyle(canvas)
      const previousFrame = frameRef.current
      frameRef.current = {
        ...previousFrame,
        canvasWidth: cssWidth,
        canvasHeight: cssHeight,
        plotLeft,
        plotTop,
        plotWidth,
        plotHeight,
        liveValues: new Float32Array(columns),
        peakValues: new Float32Array(columns),
        peakHoldUntil: new Float64Array(columns),
        accentColor: styles.getPropertyValue('--accent').trim() || '#4690ff',
        peakColor: styles.getPropertyValue('--status').trim() || '#18f76e',
        textColor: styles.getPropertyValue('--text').trim() || '#edf1f2',
        mutedColor: styles.getPropertyValue('--muted').trim() || '#8d979e',
        gridColor: 'rgba(141, 151, 158, 0.16)',
      }
      const resizedFrame = frameRef.current
      const maxFrequency = displayMaxFrequency(sampleRate || 48_000)
      const preservedFrame =
        previousFrame.hasFrame &&
        aggregateLogFrequencyBins(
          resizedFrame.frequencyData,
          resizedFrame.liveValues,
          sampleRate || 48_000,
          fftSize,
          SPECTRUM_MIN_FREQUENCY,
          maxFrequency,
        )
      resizedFrame.hasFrame = preservedFrame
      if (preservedFrame) {
        resizedFrame.peakValues.set(resizedFrame.liveValues)
        resizedFrame.peakHoldUntil.fill(performance.now())
      } else {
        resetPeakHold(resizedFrame.peakValues, resizedFrame.peakHoldUntil)
      }
      draw()
    }

    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(canvas)
    resizeCanvas()
    return () => resizeObserver.disconnect()
  }, [draw, fftSize, sampleRate])

  useEffect(() => {
    const frame = frameRef.current
    frame.frequencyData = analyserNode
      ? new Float32Array(analyserNode.frequencyBinCount)
      : new Float32Array()
    frame.hasFrame = false
    frame.lastFrameTime = 0
    resetPeakHold(frame.peakValues, frame.peakHoldUntil)
    draw()
  }, [analyserNode, draw])

  useEffect(() => {
    if (!analyserNode || !isPlaying || frozen) {
      frameRef.current.lastFrameTime = 0
      draw()
      return
    }

    let animationFrame = 0
    let cancelled = false
    const renderFrame = (now: number) => {
      if (cancelled) return
      const frame = frameRef.current
      if (frame.frequencyData.length !== analyserNode.frequencyBinCount) {
        frame.frequencyData = new Float32Array(analyserNode.frequencyBinCount)
      }

      analyserNode.getFloatFrequencyData(frame.frequencyData)
      const maxFrequency = displayMaxFrequency(sampleRate)
      const aggregated = aggregateLogFrequencyBins(
        frame.frequencyData,
        frame.liveValues,
        sampleRate,
        fftSize,
        SPECTRUM_MIN_FREQUENCY,
        maxFrequency,
      )
      if (aggregated) {
        const elapsed = frame.lastFrameTime > 0 ? now - frame.lastFrameTime : 0
        if (peakHoldEnabledRef.current) {
          updatePeakHold(
            frame.liveValues,
            frame.peakValues,
            frame.peakHoldUntil,
            now,
            elapsed,
          )
        }
        frame.lastFrameTime = now
        frame.hasFrame = true
      }
      draw()
      animationFrame = requestAnimationFrame(renderFrame)
    }

    animationFrame = requestAnimationFrame(renderFrame)
    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
    }
  }, [analyserNode, draw, fftSize, frozen, isPlaying, sampleRate])

  const resetAnalyzer = () => {
    const frame = frameRef.current
    setFrozen(false)
    setPeakHoldEnabled(true)
    peakHoldEnabledRef.current = true
    setResponse(DEFAULT_SPECTRUM_RESPONSE)
    frame.lastFrameTime = 0
    resetPeakHold(frame.peakValues, frame.peakHoldUntil)
    draw()
  }

  const togglePeakHold = () => {
    setPeakHoldEnabled((enabled) => {
      const nextEnabled = !enabled
      if (nextEnabled) {
        const frame = frameRef.current
        frame.lastFrameTime = 0
        resetPeakHold(frame.peakValues, frame.peakHoldUntil)
      }
      peakHoldEnabledRef.current = nextEnabled
      draw()
      return nextEnabled
    })
  }

  const toggleFreeze = () => {
    frameRef.current.lastFrameTime = 0
    setFrozen((value) => !value)
  }

  return (
    <section
      className="spectrum-analyzer"
      aria-label="Real-time spectrum analyzer"
    >
      <header className="spectrum-analyzer__header">
        <h2>Spectrum Analyzer</h2>
        <div className="spectrum-analyzer__controls">
          <button
            type="button"
            className={frozen ? 'is-active' : undefined}
            aria-pressed={frozen}
            onClick={toggleFreeze}
          >
            Freeze
          </button>
          <button
            type="button"
            className={peakHoldEnabled ? 'is-active' : undefined}
            aria-pressed={peakHoldEnabled}
            onClick={togglePeakHold}
          >
            Peak Hold
          </button>
          <CustomSelectField
            label="Response"
            value={response}
            options={Object.entries(SPECTRUM_RESPONSES).map(
              ([value, preset]) => ({ value, label: preset.label }),
            )}
            onChange={(value) => {
              if (isSpectrumResponse(value)) {
                setResponse(value)
              }
            }}
          />
          <output title="Fast Fourier transform size">
            FFT {fftSize.toLocaleString()}
          </output>
          <button type="button" onClick={resetAnalyzer}>
            Reset
          </button>
          <button
            type="button"
            className="spectrum-analyzer__close"
            onClick={onClose}
            aria-label="Hide spectrum analyzer"
            title="Hide spectrum analyzer"
          >
            ×
          </button>
        </div>
      </header>
      <canvas
        ref={canvasRef}
        className="spectrum-analyzer__canvas"
        role="img"
        aria-label="Logarithmic spectrum from 20 hertz to Nyquist and minus 100 to 0 decibels"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          hoverRef.current = {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          }
          draw()
        }}
        onPointerLeave={() => {
          hoverRef.current = null
          draw()
        }}
      />
    </section>
  )
}
