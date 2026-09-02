import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AnnotationTaxonomy } from '../../domain/annotationTaxonomy'
import {
  StructuredTaxonomyEditor,
  TaxonomyModeSwitch,
} from './TaxonomyStructuredEditor'
import {
  addExpandedLabel,
  removeLabelUi,
  reorderLabelUi,
  toggleExpandedLabel,
  type LabelUiState,
} from './taxonomyEditorUiState'

const completeTaxonomy: AnnotationTaxonomy = {
  schemaVersion: 1,
  labels: [
    {
      id: 'noise',
      name: 'Noise',
      description: 'Background sound',
      scopes: ['region', 'clip'],
      color: '#4f8cff',
      shortcut: '1',
    },
  ],
  scales: {
    severity: {
      required: true,
      options: [
        { value: 'minor', label: 'Minor' },
        { value: 'major', label: 'Major' },
      ],
    },
    confidence: {
      required: false,
      options: [{ value: 'high', label: 'High' }],
    },
  },
}

function renderEditor(
  taxonomy = completeTaxonomy,
  error: string | null = null,
) {
  return renderToStaticMarkup(
    <StructuredTaxonomyEditor
      taxonomy={taxonomy}
      validationError={error}
      onChange={async () => true}
    />,
  )
}

describe('taxonomy structured editor', () => {
  it('drives both visible mode states directly from aria-pressed', () => {
    const yaml = renderToStaticMarkup(
      <TaxonomyModeSwitch mode="yaml" onChange={() => undefined} />,
    )
    const structured = renderToStaticMarkup(
      <TaxonomyModeSwitch mode="structured" onChange={() => undefined} />,
    )

    expect(yaml).toMatch(/aria-pressed="true"[^>]*>YAML/)
    expect(yaml).toMatch(/aria-pressed="false"[^>]*>Structured/)
    expect(structured).toMatch(/aria-pressed="false"[^>]*>YAML/)
    expect(structured).toMatch(/aria-pressed="true"[^>]*>Structured/)
    expect(yaml).not.toContain('is-active')
    expect(structured).not.toContain('is-active')
  })

  it('renders collapsed label cards with summary metadata and one delete action', () => {
    const html = renderEditor()
    const uiId = html.match(/data-label-ui-id="([^"]+)"/)?.[1]

    expect(uiId).toBeTruthy()
    expect(uiId).not.toBe('noise')
    expect(html).toContain(`aria-controls="${uiId}-body"`)
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain(
      `id="${uiId}-body" class="taxonomy-card-body" hidden=""`,
    )
    expect(html).toContain('Drag Noise to reorder')
    expect(html).toContain('Choose header color for Noise')
    expect(html).toContain('<strong>Noise</strong>')
    expect(html).toContain('<small>noise</small>')
    expect(html).toContain('<span>Region</span>')
    expect(html).toContain('<span>Clip</span>')
    expect(html).toContain('<kbd title="Keyboard shortcut">1</kbd>')
    expect(html.match(/Delete Noise/g)).toHaveLength(1)
    expect(html).not.toContain('taxonomy-card-index')
  })

  it('renders every parser-supported field and compact structured control', () => {
    const html = renderEditor()

    expect(html).toContain('Stable ID *')
    expect(html).toContain('Name *')
    expect(html).toContain('Description')
    expect(html).toContain('Color')
    expect(html).not.toContain('type="color"')
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2)
    expect(html.match(/aria-expanded="false"/g)?.length).toBeGreaterThanOrEqual(
      3,
    )
    expect(html.match(/aria-controls=/g)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('Choose header color for Noise')
    expect(html).toContain('Choose color for Noise')
    expect(html).toContain('Color value for Noise')
    expect(html).toContain('Shortcut')
    expect(html).toContain('maxLength="1"')
    expect(html).toContain('Scopes for Noise')
    expect(html).toContain('class="taxonomy-label-identity-row"')
    expect(html).toContain('class="taxonomy-label-details-row"')
    expect(html).toContain('class="taxonomy-keyboard-reorder__controls"')
    expect(html).toContain('>Reorder<')
    expect(html).not.toContain('>Keyboard reorder<')
    expect(html.indexOf('taxonomy-field--name')).toBeLessThan(
      html.indexOf('taxonomy-field--stable-id'),
    )
    expect(html.indexOf('taxonomy-field--stable-id')).toBeLessThan(
      html.indexOf('taxonomy-field--description'),
    )
    expect(html.indexOf('taxonomy-field--description')).toBeLessThan(
      html.indexOf('taxonomy-scope-field'),
    )
    expect(html.indexOf('taxonomy-scope-field')).toBeLessThan(
      html.indexOf('taxonomy-color-field'),
    )
    expect(html.indexOf('taxonomy-color-field')).toBeLessThan(
      html.indexOf('taxonomy-field--shortcut'),
    )
    expect(html.indexOf('taxonomy-field--shortcut')).toBeLessThan(
      html.indexOf('taxonomy-keyboard-reorder'),
    )
    expect(html).toMatch(/aria-pressed="true"[^>]*>Region/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Clip/)
    expect(html).not.toContain('type="checkbox"')
    expect(html).toContain('<h3>Severity</h3>')
    expect(html).toContain('<h3>Confidence</h3>')
    expect(html).toContain('role="switch" aria-checked="true"')
    expect(html).toContain('role="switch" aria-checked="false"')
    expect(html).toContain('Delete scale')
    expect(html).toContain('Stored value *')
    expect(html).toContain('Display label *')
    expect(html).toContain('value="minor"')
    expect(html).toContain('value="Major"')
    expect(html).not.toContain('>Order<')
    expect(html).not.toContain('taxonomy-option-index')
  })

  it('provides native drag handles and accessible reorder fallbacks', () => {
    const html = renderEditor()

    expect(html.match(/draggable="true"/g)?.length).toBeGreaterThanOrEqual(4)
    expect(html.match(/taxonomy-drag-item/g)?.length).toBeGreaterThanOrEqual(4)
    expect(html).toContain('aria-label="Move Noise up"')
    expect(html).toContain('title="Move label down"')
    expect(html).toContain('aria-label="Severity option 1 value"')
    expect(html).toContain('Move Severity option Minor down')
    expect(html).toContain('Delete Severity option Minor')
    expect(html).toContain('<svg')
    expect(html).not.toContain('↑')
    expect(html).not.toContain('↓')
    expect(html).not.toContain('×')
  })

  it('renders actionable invalid and omitted-value feedback without dropping drafts', () => {
    const html = renderEditor(
      {
        schemaVersion: 1,
        labels: [
          {
            id: '',
            name: '',
            scopes: [],
            color: 'blue',
            shortcut: '',
          },
        ],
        scales: {
          severity: {
            required: false,
            options: [{ value: '', label: '' }],
          },
        },
      },
      'The current structured draft is invalid.',
    )

    expect(html).toContain('value="blue"')
    expect(html).toContain('Stable ID required')
    expect(html).toContain('Select Region, Clip, or both.')
    expect(html).toContain('Use a six-digit hex color')
    expect(html).toContain('Enter a stored value.')
    expect(html).toContain('Enter a display label.')
    expect(html).toContain('Fix the structured values before saving')
    expect(html).toContain('Add confidence scale')
  })

  it('keeps UI-only label identities stable across expansion and reorder', () => {
    const initial: LabelUiState = {
      ids: ['ui-noise', 'ui-click'],
      expanded: new Set(['ui-noise']),
    }
    const multipleOpen = toggleExpandedLabel(initial, 'ui-click')
    const reordered = reorderLabelUi(multipleOpen, 1, 0)
    const withNewLabel = addExpandedLabel(reordered, 'ui-new')
    const removed = removeLabelUi(withNewLabel, 1)

    expect([...multipleOpen.expanded]).toEqual(['ui-noise', 'ui-click'])
    expect(reordered.ids).toEqual(['ui-click', 'ui-noise'])
    expect([...reordered.expanded]).toEqual(['ui-noise', 'ui-click'])
    expect(withNewLabel.expanded.has('ui-new')).toBe(true)
    expect(removed.ids).toEqual(['ui-click', 'ui-new'])
    expect(removed.expanded.has('ui-noise')).toBe(false)
    expect(initial).toEqual({
      ids: ['ui-noise', 'ui-click'],
      expanded: new Set(['ui-noise']),
    })
  })
})
