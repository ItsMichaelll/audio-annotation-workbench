import type { RegionMetadata } from '../domain/region'
import { formatTime } from '../domain/transport'
import styles from './StatusReadout.module.css'

interface StatusReadoutProps {
  fileName: string | null
  loadStatus: 'idle' | 'loading' | 'ready' | 'error'
  duration: number
  currentTime: number
  zoom: number
  verticalScale: number
  isPlaying: boolean
  selectedRegion: RegionMetadata | null
}
export function StatusReadout({
  fileName,
  loadStatus,
  zoom,
  isPlaying,
  selectedRegion,
}: StatusReadoutProps) {
  return (
    <footer className={styles.root} aria-label="Audio and selection status">
      <span className={styles.state}>
        <i className={isPlaying ? styles.playing : undefined} />
        {loadStatus === 'error'
          ? 'Audio unavailable'
          : loadStatus === 'loading'
            ? 'Loading audio…'
            : isPlaying
              ? 'Playing'
              : fileName && loadStatus === 'ready'
                ? 'Ready'
                : 'No audio loaded'}
      </span>
      <span className={styles.selection}>
        {selectedRegion ? (
          <>
            Selection{' '}
            <span>
              {formatTime(selectedRegion.start)} —{' '}
              {formatTime(selectedRegion.end)}
            </span>
            <span className={styles.length}>
              {' '}
              / {formatTime(selectedRegion.end - selectedRegion.start)}
            </span>
          </>
        ) : (
          'No region selected'
        )}
      </span>
      <span className={styles.zoom}>
        {zoom > 0 ? `${zoom.toFixed(1)} px/s` : 'Fit to file'}
      </span>
      <span className={styles.precision}>1 ms precision</span>
    </footer>
  )
}
