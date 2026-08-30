import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownInstructions } from './MarkdownInstructions'
import { safeMarkdownUrl } from './markdownSecurity'

describe('Markdown instructions security', () => {
  it('does not render raw HTML, scripts, iframes, handlers, or images', () => {
    const html = renderToStaticMarkup(
      <MarkdownInstructions
        markdown={`# Guide

<script>alert('x')</script>
<iframe src="https://example.com"></iframe>
<img src="https://example.com/track.png" onerror="alert(1)">
`}
      />,
    )

    expect(html).not.toContain('<script')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<img')
    expect(html).not.toContain(' onerror="')
  })

  it('restricts link protocols and protects external tabs', () => {
    const html = renderToStaticMarkup(
      <MarkdownInstructions markdown="[Safe](https://example.com) [Unsafe](javascript:alert(1))" />,
    )

    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).not.toContain('javascript:')
    expect(safeMarkdownUrl('file:///private/audio.wav')).toBe('')
  })
})
