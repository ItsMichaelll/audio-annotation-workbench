import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SpectrumAnalyzer } from './SpectrumAnalyzer'

describe('SpectrumAnalyzer', () => {
  it('renders locally styled controls with semantic pressed states', () => {
    const html = renderToStaticMarkup(
      <SpectrumAnalyzer
        analyserNode={null}
        analyzerError={null}
        fftSize={2048}
        isPlaying={false}
        sampleRate={48_000}
        onResponseChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('>Freeze<')
    expect(html).toContain('>Peak Hold<')
    expect(html).toContain('>Reset<')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-label="Hide spectrum analyzer"')
    expect(html).not.toContain('spectrum-analyzer__')
    expect(html).not.toContain('is-active')
  })
})
