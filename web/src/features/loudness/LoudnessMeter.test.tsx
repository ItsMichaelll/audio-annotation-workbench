import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LoudnessMeter } from './LoudnessMeter'

vi.mock('./useOfflineLoudness', () => ({
  useOfflineLoudness: () => ({ status: 'idle' }),
}))

describe('LoudnessMeter', () => {
  it('renders idle, error, scope, and disclosure states accessibly', () => {
    const html = renderToStaticMarkup(
      <LoudnessMeter
        audioBuffer={null}
        live={null}
        selectedRegion={null}
        error="Live analysis unavailable."
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('Play audio to begin live measurement.')
    expect(html).toContain('Live analysis unavailable.')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-label="Hide loudness meter"')
    expect(html).not.toContain('loudness-meter__')
    expect(html).not.toContain('is-error')
  })
})
