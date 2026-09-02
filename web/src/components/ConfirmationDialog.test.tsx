import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConfirmationDialog } from './ConfirmationDialog'

describe('shared confirmation dialog', () => {
  it('renders modal semantics and destructive action copy', () => {
    const html = renderToStaticMarkup(
      <ConfirmationDialog
        request={{
          title: 'Delete selected tasks?',
          message: 'This cannot be undone.',
          confirmLabel: 'Delete tasks',
          tone: 'danger',
        }}
        onResult={() => undefined}
      />,
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby=')
    expect(html).toContain('aria-describedby=')
    expect(html).toContain('Delete selected tasks?')
    expect(html).toContain('This cannot be undone.')
    expect(html).toContain('class="danger-button"')
    expect(html).toContain('>Cancel<')
    expect(html).toContain('>Delete tasks<')
  })

  it('renders nothing without a pending request', () => {
    expect(
      renderToStaticMarkup(
        <ConfirmationDialog request={null} onResult={() => undefined} />,
      ),
    ).toBe('')
  })
})
