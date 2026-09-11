import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TransportBar } from './TransportBar'

const noop = () => undefined

function render(markerEditingEnabled: boolean) {
  return renderToStaticMarkup(
    <TransportBar
      isLoaded
      isPlaying={false}
      loopEnabled={false}
      spectrogramEnabled={false}
      spectrumEnabled={false}
      meterEnabled={false}
      hasSelection={false}
      markerEditingEnabled={markerEditingEnabled}
      canCreateMarker={markerEditingEnabled}
      canPreviousMarker
      canNextMarker
      canDeleteMarker={markerEditingEnabled}
      verticalScale={1}
      onPlayPause={noop}
      onFit={noop}
      onZoomIn={noop}
      onZoomOut={noop}
      onResetVerticalScale={noop}
      onToggleLoop={noop}
      onDelete={noop}
      onCreateMarker={noop}
      onPreviousMarker={noop}
      onNextMarker={noop}
      onDeleteMarker={noop}
      onToggleSpectrogram={noop}
      onToggleSpectrum={noop}
      onToggleMeter={noop}
    />,
  )
}

describe('TransportBar marker controls', () => {
  it('exposes accessible navigation, creation, and deletion controls', () => {
    const html = render(true)
    expect(html).toContain('aria-label="Previous marker"')
    expect(html).toContain('aria-label="Next marker"')
    expect(html).toContain('aria-label="Create marker at playhead"')
    expect(html).toContain('aria-label="Delete selected marker"')
    expect(html).not.toContain('Marker 3 of 8')
  })

  it('keeps marker navigation and removes edit controls in read-only mode', () => {
    const html = render(false)
    expect(html).toContain('aria-label="Previous marker"')
    expect(html).toContain('aria-label="Next marker"')
    expect(html).not.toContain('aria-label="Create marker at playhead"')
    expect(html).not.toContain('aria-label="Delete selected marker"')
  })
})
