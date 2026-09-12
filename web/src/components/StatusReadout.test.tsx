import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatusReadout } from './StatusReadout'

const baseProps = {
  fileName: 'sample.wav',
  loadStatus: 'ready' as const,
  duration: 10,
  currentTime: 4,
  zoom: 100,
  verticalScale: 1,
  isPlaying: false,
  selectedRegion: null,
}

describe('StatusReadout marker status', () => {
  it('announces the selected marker ordinal and timestamp', () => {
    const html = renderToStaticMarkup(
      <StatusReadout
        {...baseProps}
        selectedMarker={{ id: 'marker-3', time: 4 }}
        selectedMarkerOrdinal={3}
        markerCount={8}
      />,
    )

    expect(html).toContain('Marker 3 of 8 · 0:04.000')
    expect(html).toContain('aria-live="polite"')
  })

  it('shows the marker count when no marker is selected', () => {
    const html = renderToStaticMarkup(
      <StatusReadout
        {...baseProps}
        selectedMarker={null}
        selectedMarkerOrdinal={null}
        markerCount={2}
      />,
    )

    expect(html).toContain('>2 markers</output>')
  })
})
