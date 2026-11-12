export type AmplitudeScale = 'linear' | 'logarithmic'
export type FollowMode = 'off' | 'page' | 'center'
export type NavigationPreset = 'aaw' | 'trackpad'

export function plainWheelPans(
  preset: NavigationPreset,
  commandModifier: boolean,
): boolean {
  return preset === 'trackpad' && !commandModifier
}

export function displayAmplitude(
  sample: number,
  scale: AmplitudeScale,
): number {
  if (!Number.isFinite(sample)) return 0
  const magnitude = Math.min(1, Math.abs(sample))
  return (
    Math.sign(sample) *
    (scale === 'linear' ? magnitude : Math.log1p(9 * magnitude) / Math.log(10))
  )
}

export function renderDisplayWaveform(
  peaks: Array<Float32Array | number[]>,
  context: CanvasRenderingContext2D,
  scale: AmplitudeScale,
  heightScale: number,
): void {
  const { width, height } = context.canvas
  const center = height / 2
  const count = Math.max(...peaks.map((channel) => channel.length), 0)
  if (!count) return
  for (let x = 0; x < width; x++) {
    const start = Math.floor((x * count) / width)
    const end = Math.max(start + 1, Math.floor(((x + 1) * count) / width))
    let positive = 0
    let negative = 0
    for (const channel of peaks) {
      for (let index = start; index < end; index++) {
        const value = displayAmplitude(channel[index] ?? 0, scale) * heightScale
        positive = Math.max(positive, value)
        negative = Math.min(negative, value)
      }
    }
    context.fillRect(
      x,
      center - positive * center,
      1,
      Math.max(1, (positive - negative) * center),
    )
  }
}
