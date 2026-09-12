import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RegionControls } from './RegionControls'
import { TransportBar, type TransportBarProps } from './TransportBar'

describe('region and boundary controls', () => {
  it('shows the region selection count and accessible bulk deletion', () => {
    const html = renderToStaticMarkup(
      <RegionControls
        isLoaded
        editingEnabled
        canPrevious
        canNext
        canAdd
        selectedCount={3}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(html).toContain('aria-label="Region controls"')
    expect(html).toContain('3 selected')
    expect(html).toContain('aria-label="Delete selected regions"')
    expect(html).toContain('aria-label="Create region at playhead"')
  })
  it('keeps navigation but hides editing in read-only tasks', () => {
    const html = renderToStaticMarkup(
      <RegionControls
        isLoaded
        editingEnabled={false}
        canPrevious
        canNext
        canAdd={false}
        selectedCount={1}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(html).toContain('aria-label="Previous region"')
    expect(html).not.toContain('aria-label="Delete selected region"')
    expect(html).not.toContain('aria-label="Create region at playhead"')
  })
  it('labels boundary controls and enables them solely on audio availability', () => {
    const noop = vi.fn()
    const props: TransportBarProps = {
      isLoaded: false,
      isPlaying: false,
      loopEnabled: false,
      spectrogramEnabled: false,
      spectrumEnabled: false,
      meterEnabled: false,
      hasSelection: false,
      verticalScale: 1,
      currentTime: 0,
      duration: 10,
      onPlayPause: noop,
      onFit: noop,
      onZoomIn: noop,
      onZoomOut: noop,
      onResetVerticalScale: noop,
      onToggleLoop: noop,
      onJumpToStart: noop,
      onJumpToEnd: noop,
      onToggleSpectrogram: noop,
      onToggleSpectrum: noop,
      onToggleMeter: noop,
    }
    for (const label of ['Jump to start', 'Jump to end']) {
      const disabled = renderToStaticMarkup(<TransportBar {...props} />)
      const enabled = renderToStaticMarkup(<TransportBar {...props} isLoaded />)
      expect(disabled).toMatch(
        new RegExp(
          `<button[^>]*disabled=""[^>]*aria-label="${label}"[^>]*title="${label} of audio"`,
        ),
      )
      expect(enabled).toMatch(
        new RegExp(
          `<button[^>]*aria-label="${label}"[^>]*title="${label} of audio"`,
        ),
      )
      expect(enabled).not.toMatch(
        new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${label}"`),
      )
      expect(enabled).not.toContain('aria-label="Previous region"')
    }
  })
})
