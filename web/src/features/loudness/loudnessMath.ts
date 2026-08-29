export const ABSOLUTE_GATE_LUFS = -70
export const RELATIVE_INTEGRATED_GATE_LU = -10
export const RELATIVE_LRA_GATE_LU = -20
export const LUFS_OFFSET = -0.691

export interface TargetRange {
  enabled: boolean
  target: number
  tolerance: number
}

export interface ScopeBounds {
  startFrame: number
  endFrame: number
}

export function energyToLufs(meanSquareEnergy: number): number {
  return meanSquareEnergy > 0
    ? LUFS_OFFSET + 10 * Math.log10(meanSquareEnergy)
    : Number.NEGATIVE_INFINITY
}

export function lufsToEnergy(loudness: number): number {
  return Number.isFinite(loudness) ? 10 ** ((loudness - LUFS_OFFSET) / 10) : 0
}

export function combineChannelEnergy(
  channelMeanSquares: readonly number[],
): number {
  return channelMeanSquares.reduce(
    (total, energy) => total + Math.max(0, energy),
    0,
  )
}

export function gatedIntegratedLoudness(
  blockEnergies: readonly number[],
): number {
  const absolute = blockEnergies.filter(
    (energy) => energyToLufs(energy) >= ABSOLUTE_GATE_LUFS,
  )
  if (absolute.length === 0) return Number.NEGATIVE_INFINITY
  const absoluteMean = average(absolute)
  const relativeGate = energyToLufs(absoluteMean) + RELATIVE_INTEGRATED_GATE_LU
  const relative = absolute.filter(
    (energy) => energyToLufs(energy) >= relativeGate,
  )
  return relative.length
    ? energyToLufs(average(relative))
    : Number.NEGATIVE_INFINITY
}

export function loudnessRange(shortTermLoudness: readonly number[]): number {
  const absolute = shortTermLoudness.filter(
    (value) => Number.isFinite(value) && value >= ABSOLUTE_GATE_LUFS,
  )
  if (absolute.length === 0) return Number.NaN
  const averageEnergy = average(absolute.map(lufsToEnergy))
  const relativeGate = energyToLufs(averageEnergy) + RELATIVE_LRA_GATE_LU
  const gated = absolute
    .filter((value) => value >= relativeGate)
    .sort((a, b) => a - b)
  if (gated.length < 2) return Number.NaN
  return percentile(gated, 95) - percentile(gated, 10)
}

export function peakToShortTermRatio(
  truePeakDbtp: number,
  shortTermLufs: number,
): number {
  return Number.isFinite(truePeakDbtp) && Number.isFinite(shortTermLufs)
    ? truePeakDbtp - shortTermLufs
    : Number.NaN
}

export function peakToLoudnessRatio(
  truePeakDbtp: number,
  integratedLufs: number,
): number {
  return Number.isFinite(truePeakDbtp) && Number.isFinite(integratedLufs)
    ? truePeakDbtp - integratedLufs
    : Number.NaN
}

export function resolveScopeBounds(
  sampleRate: number,
  frameCount: number,
  selection?: { start: number; end: number } | null,
): ScopeBounds | null {
  if (!(sampleRate > 0) || frameCount <= 0) return null
  if (!selection) return { startFrame: 0, endFrame: frameCount }
  const startFrame = Math.max(
    0,
    Math.min(frameCount, Math.floor(selection.start * sampleRate)),
  )
  const endFrame = Math.max(
    startFrame,
    Math.min(frameCount, Math.ceil(selection.end * sampleRate)),
  )
  return endFrame > startFrame ? { startFrame, endFrame } : null
}

export function validateTargetRange(target: TargetRange): string | null {
  if (
    !Number.isFinite(target.target) ||
    target.target > 0 ||
    target.target < -70
  )
    return 'Target must be between -70 and 0 LUFS.'
  if (
    !Number.isFinite(target.tolerance) ||
    target.tolerance <= 0 ||
    target.tolerance > 30
  )
    return 'Tolerance must be greater than 0 and at most 30 LU.'
  return null
}

export function maximumFinite(values: readonly number[]): number {
  let maximum = Number.NEGATIVE_INFINITY
  for (const value of values)
    if (Number.isFinite(value)) maximum = Math.max(maximum, value)
  return maximum
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(sorted: readonly number[], percentage: number): number {
  const index = Math.round(((sorted.length - 1) * percentage) / 100)
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? Number.NaN
}
