import type { RegionMetadata } from '../domain/region'
import { formatTime } from '../domain/transport'
import styles from './StatusReadout.module.css'

interface StatusReadoutProps {
  fileName: string | null
  duration: number
  currentTime: number
  zoom: number
  verticalScale: number
  isPlaying: boolean
  selectedRegion: RegionMetadata | null
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.readout}>
      <span className={styles.label}>{label}</span>
      <output className={styles.value}>{value}</output>
    </div>
  )
}

export function StatusReadout({
  fileName,
  duration,
  currentTime,
  zoom,
  verticalScale,
  isPlaying,
  selectedRegion,
}: StatusReadoutProps) {
  return (
    <section className={styles.root} aria-label="Audio and selection status">
      <div className={styles.file} title={fileName ?? 'No audio loaded'}>
        <span className={styles.label}>File</span>
        <strong className={styles.value}>
          {fileName ?? 'No audio loaded'}
        </strong>
      </div>
      <Readout label="Position" value={formatTime(currentTime)} />
      <Readout label="Duration" value={formatTime(duration)} />
      <Readout
        label="Zoom"
        value={zoom > 0 ? `${zoom.toFixed(1)} px/s` : '—'}
      />
      <Readout label="V-Scale" value={`${verticalScale.toFixed(2)}×`} />
      <Readout label="Transport" value={isPlaying ? 'PLAYING' : 'STOPPED'} />
      <Readout
        label="Region start"
        value={selectedRegion ? formatTime(selectedRegion.start) : '—'}
      />
      <Readout
        label="Region end"
        value={selectedRegion ? formatTime(selectedRegion.end) : '—'}
      />
      <Readout
        label="Region length"
        value={
          selectedRegion
            ? formatTime(selectedRegion.end - selectedRegion.start)
            : '—'
        }
      />
    </section>
  )
}
