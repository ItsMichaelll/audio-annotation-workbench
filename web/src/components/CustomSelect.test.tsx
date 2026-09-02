import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CustomSelect, CustomSelectField } from './CustomSelect'

describe('CustomSelect', () => {
  it('renders an accessible combobox with the selected label', () => {
    const html = renderToStaticMarkup(
      <CustomSelect
        ariaLabel="Severity"
        value="moderate"
        options={[
          { value: 'minor', label: 'Minor' },
          { value: 'moderate', label: 'Moderate' },
        ]}
        onChange={vi.fn()}
      />,
    )

    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Severity"')
    expect(html).toContain('Moderate')
    expect(html).not.toContain('<li')
  })

  it('uses the placeholder and disables the trigger when requested', () => {
    const html = renderToStaticMarkup(
      <CustomSelect
        ariaLabel="Confidence"
        value=""
        options={[]}
        placeholder="Choose confidence"
        disabled
        onChange={vi.fn()}
      />,
    )

    expect(html).toContain('Choose confidence')
    expect(html).toContain('disabled=""')
  })

  it('avoids label activation that reopened after mouse selection', () => {
    const html = renderToStaticMarkup(
      <CustomSelectField
        label="Severity"
        value="minor"
        options={[{ value: 'minor', label: 'Minor' }]}
        onChange={vi.fn()}
      />,
    )
    const labelId = /<span[^>]* id="([^"]+)">Severity<\/span>/.exec(html)?.[1]

    expect(labelId).toBeTruthy()
    expect(html).toContain(`aria-labelledby="${labelId}"`)
    expect(html).not.toContain('<label')
  })
})
