import type { CSSProperties } from 'react'

const paths = {
  waveform: 'M3 10v4m4-8v12m5-15v18m5-15v12m4-8v4',
  folder: 'M3 7V5h6l2 2h10v13H3V7Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5m5-5-5 5 5 5',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  play: 'm8 5 11 7-11 7V5Z',
  pause: 'M8 5v14M16 5v14',
  previous: 'M5 5v14m13-14L8 12l10 7V5Z',
  next: 'M19 5v14M6 5l10 7-10 7V5Z',
  loop: 'm17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  fit: 'M8 4H4v16h4M16 4h4v16h-4M8 12h8',
  undo: 'm8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14',
  redo: 'm16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14',
  spectrum: 'm3 18 4-5 3 2 4-10 3 7 4-3M3 21h18',
  spectrogram: 'M4 5v14M8 8v11M12 3v18M16 6v13M20 9v8',
  meter: 'M5 14v6h3v-6H5Zm6-6v12h3V8h-3Zm6-5v17h3V3h-3Z',
  keyboard: 'M3 5h18v14H3V5Zm3 4h1m4 0h1m4 0h1M6 12h1m4 0h1m4 0h1m-9 4h8',
  panel: 'M3 4h18v16H3V4Zm12 0v16',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  info: 'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 4v3',
} as const

export function Icon({
  name,
  size = 16,
  style,
}: {
  name: keyof typeof paths
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
    >
      <path d={paths[name]} />
    </svg>
  )
}
