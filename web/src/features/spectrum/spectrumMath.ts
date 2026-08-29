import {
  PEAK_DECAY_DB_PER_SECOND,
  PEAK_HOLD_DURATION_MS,
  SPECTRUM_MAX_DB,
  SPECTRUM_MAX_FREQUENCY,
  SPECTRUM_MIN_DB,
} from './spectrumConfig'

function validLogRange(minFrequency: number, maxFrequency: number): boolean {
  return (
    Number.isFinite(minFrequency) &&
    Number.isFinite(maxFrequency) &&
    minFrequency > 0 &&
    maxFrequency > minFrequency
  )
}

export function displayMaxFrequency(sampleRate: number): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return 0
  return Math.min(SPECTRUM_MAX_FREQUENCY, sampleRate / 2)
}

export function frequencyToX(
  frequency: number,
  width: number,
  minFrequency: number,
  maxFrequency: number,
): number {
  if (
    !Number.isFinite(frequency) ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !validLogRange(minFrequency, maxFrequency)
  ) {
    return Number.NaN
  }

  const clampedFrequency = Math.min(
    Math.max(frequency, minFrequency),
    maxFrequency,
  )
  return (
    (Math.log(clampedFrequency / minFrequency) /
      Math.log(maxFrequency / minFrequency)) *
    width
  )
}

export function xToFrequency(
  x: number,
  width: number,
  minFrequency: number,
  maxFrequency: number,
): number {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !validLogRange(minFrequency, maxFrequency)
  ) {
    return Number.NaN
  }

  const normalizedX = Math.min(Math.max(x / width, 0), 1)
  return minFrequency * (maxFrequency / minFrequency) ** normalizedX
}

export function dbToY(
  decibels: number,
  height: number,
  minDecibels = SPECTRUM_MIN_DB,
  maxDecibels = SPECTRUM_MAX_DB,
): number {
  if (
    !Number.isFinite(decibels) ||
    !Number.isFinite(height) ||
    !Number.isFinite(minDecibels) ||
    !Number.isFinite(maxDecibels) ||
    height <= 0 ||
    maxDecibels <= minDecibels
  ) {
    return Number.NaN
  }

  const clamped = Math.min(Math.max(decibels, minDecibels), maxDecibels)
  return ((maxDecibels - clamped) / (maxDecibels - minDecibels)) * height
}

export function yToDb(
  y: number,
  height: number,
  minDecibels = SPECTRUM_MIN_DB,
  maxDecibels = SPECTRUM_MAX_DB,
): number {
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(height) ||
    height <= 0 ||
    maxDecibels <= minDecibels
  ) {
    return Number.NaN
  }

  const normalizedY = Math.min(Math.max(y / height, 0), 1)
  return maxDecibels - normalizedY * (maxDecibels - minDecibels)
}

export function fftBinFrequency(
  binIndex: number,
  sampleRate: number,
  fftSize: number,
): number {
  if (
    !Number.isFinite(binIndex) ||
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(fftSize) ||
    binIndex < 0 ||
    sampleRate <= 0 ||
    fftSize <= 0
  ) {
    return Number.NaN
  }

  return (binIndex * sampleRate) / fftSize
}

function clampDecibels(value: number, minDecibels: number): number {
  if (!Number.isFinite(value)) return minDecibels
  return Math.min(Math.max(value, minDecibels), SPECTRUM_MAX_DB)
}

/**
 * Maps linear FFT bins into logarithmic pixel columns. Each column uses the
 * maximum complete bin in its frequency interval so narrow peaks stay visible.
 * Intervals narrower than one FFT bin sample the nearest bins at their
 * geometric-center frequency.
 */
export function aggregateLogFrequencyBins(
  frequencyData: Float32Array,
  output: Float32Array,
  sampleRate: number,
  fftSize: number,
  minFrequency: number,
  maxFrequency: number,
  minDecibels = SPECTRUM_MIN_DB,
): boolean {
  output.fill(minDecibels)
  if (
    frequencyData.length === 0 ||
    output.length === 0 ||
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(fftSize) ||
    sampleRate <= 0 ||
    fftSize <= 0 ||
    !validLogRange(minFrequency, maxFrequency) ||
    maxFrequency > sampleRate / 2
  ) {
    return false
  }

  const binWidth = sampleRate / fftSize
  const columnCount = output.length

  for (let column = 0; column < columnCount; column += 1) {
    const lowerFrequency = xToFrequency(
      column,
      columnCount,
      minFrequency,
      maxFrequency,
    )
    const upperFrequency = xToFrequency(
      column + 1,
      columnCount,
      minFrequency,
      maxFrequency,
    )
    const firstCompleteBin = Math.max(1, Math.ceil(lowerFrequency / binWidth))
    const lastCompleteBin = Math.min(
      frequencyData.length - 1,
      Math.floor(upperFrequency / binWidth),
    )

    if (firstCompleteBin <= lastCompleteBin) {
      let maximum = minDecibels
      for (let bin = firstCompleteBin; bin <= lastCompleteBin; bin += 1) {
        maximum = Math.max(
          maximum,
          clampDecibels(frequencyData[bin] ?? minDecibels, minDecibels),
        )
      }
      output[column] = maximum
      continue
    }

    const centerFrequency = Math.sqrt(lowerFrequency * upperFrequency)
    const fractionalBin = centerFrequency / binWidth
    const lowerBin = Math.min(
      Math.max(Math.floor(fractionalBin), 0),
      frequencyData.length - 1,
    )
    const upperBin = Math.min(lowerBin + 1, frequencyData.length - 1)
    const mix = fractionalBin - Math.floor(fractionalBin)
    const lowerValue = clampDecibels(
      frequencyData[lowerBin] ?? minDecibels,
      minDecibels,
    )
    const upperValue = clampDecibels(
      frequencyData[upperBin] ?? minDecibels,
      minDecibels,
    )
    output[column] = lowerValue + (upperValue - lowerValue) * mix
  }

  return true
}

export function resetPeakHold(
  peaks: Float32Array,
  holdUntil: Float64Array,
  minDecibels = SPECTRUM_MIN_DB,
): void {
  peaks.fill(minDecibels)
  holdUntil.fill(0)
}

export function updatePeakHold(
  liveValues: Float32Array,
  peaks: Float32Array,
  holdUntil: Float64Array,
  nowMs: number,
  elapsedMs: number,
  holdDurationMs = PEAK_HOLD_DURATION_MS,
  decayDbPerSecond = PEAK_DECAY_DB_PER_SECOND,
): boolean {
  if (
    liveValues.length === 0 ||
    liveValues.length !== peaks.length ||
    peaks.length !== holdUntil.length ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0 ||
    holdDurationMs < 0 ||
    decayDbPerSecond < 0
  ) {
    return false
  }

  const decay = (elapsedMs / 1000) * decayDbPerSecond
  for (let index = 0; index < liveValues.length; index += 1) {
    const liveValue = clampDecibels(
      liveValues[index] ?? SPECTRUM_MIN_DB,
      SPECTRUM_MIN_DB,
    )
    const currentPeak = peaks[index] ?? SPECTRUM_MIN_DB

    if (liveValue >= currentPeak) {
      peaks[index] = liveValue
      holdUntil[index] = nowMs + holdDurationMs
    } else if (nowMs > (holdUntil[index] ?? 0)) {
      peaks[index] = Math.max(liveValue, currentPeak - decay)
    }
  }

  return true
}
