import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkerControls } from './MarkerControls'

const noop = () => undefined

function render(markerEditingEnabled: boolean) {
  return renderToStaticMarkup(
    <MarkerControls
      isLoaded
      markerEditingEnabled={markerEditingEnabled}
      canCreateMarker={markerEditingEnabled}
      canPreviousMarker
      canNextMarker
      canDeleteMarker={markerEditingEnabled}
      onCreateMarker={noop}
      onPreviousMarker={noop}
      onNextMarker={noop}
      onDeleteMarker={noop}
    />,
  )
}

describe('MarkerControls', () => {
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
