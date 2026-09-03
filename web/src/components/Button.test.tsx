import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Button, ButtonLink } from './Button'

describe('Button', () => {
  it('composes default button and link classes without invalid tokens', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Button className="consumer-class">Button</Button>
        <ButtonLink to="/projects">Link</ButtonLink>
      </MemoryRouter>,
    )

    expect(html).toContain('consumer-class')
    expect(html).not.toMatch(/\b(?:undefined|false)\b/)
  })

  it('preserves semantic elements across variants and sizes', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Button variant="danger" size="compact" disabled>
          Delete
        </Button>
        <ButtonLink variant="primary" size="compact" to="/projects">
          View
        </ButtonLink>
      </MemoryRouter>,
    )

    expect(html).toContain('<button')
    expect(html).toContain('disabled=""')
    expect(html).toContain('data-button-variant="danger"')
    expect(html).toContain('<a')
    expect(html).toContain('data-button-variant="primary"')
    expect(html).not.toMatch(/\b(?:undefined|false)\b/)
  })
})
