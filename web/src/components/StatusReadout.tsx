import type { RegionMetadata } from '../domain/region'
import { formatTime } from '../domain/transport'

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
    <div className="readout">
      <span>{label}</span>
      <output>{value}</output>
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
    <section className="status-strip" aria-label="Audio and selection status">
      <div className="file-readout" title={fileName ?? 'No audio loaded'}>
        <span>File</span>
        <strong>{fileName ?? 'No audio loaded'}</strong>
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
