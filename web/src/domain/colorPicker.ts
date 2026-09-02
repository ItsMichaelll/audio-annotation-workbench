export interface HsvColor {
  hue: number
  saturation: number
  value: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function normalizeHexColor(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && /^#[0-9a-f]{6}$/i.test(trimmed)
    ? trimmed.toUpperCase()
    : null
}

export function hexToHsv(value: string): HsvColor | null {
  const normalized = normalizeHexColor(value)
  if (!normalized) return null

  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum

  let hue = 0
  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: maximum === 0 ? 0 : (delta / maximum) * 100,
    value: maximum * 100,
  }
}

export function hsvToHex(color: HsvColor): string {
  const hue = ((color.hue % 360) + 360) % 360
  const saturation = clamp(color.saturation, 0, 100) / 100
  const value = clamp(color.value, 0, 100) / 100
  const chroma = value * saturation
  const section = hue / 60
  const secondary = chroma * (1 - Math.abs((section % 2) - 1))
  const offset = value - chroma

  let red = 0
  let green = 0
  let blue = 0
  if (section < 1) [red, green] = [chroma, secondary]
  else if (section < 2) [red, green] = [secondary, chroma]
  else if (section < 3) [green, blue] = [chroma, secondary]
  else if (section < 4) [green, blue] = [secondary, chroma]
  else if (section < 5) [red, blue] = [secondary, chroma]
  else [red, blue] = [chroma, secondary]

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`
}
