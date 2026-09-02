import { describe, expect, it } from 'vitest'
import {
  applyStructuredTaxonomy,
  moveEntry,
  nextAvailableIdentifier,
  parseTaxonomyEditorSource,
  reorderEntry,
  removeEntry,
  replaceEntry,
  serializeStructuredTaxonomy,
  STRUCTURED_CANONICALIZATION_WARNING,
} from './taxonomyEditing'
import type { AnnotationTaxonomy } from './annotationTaxonomy'

const source = `# retained until structured editing
schemaVersion: 1
labels:
  - id: noise
    name: Noise
    description: Background sound
    scopes: [region, clip]
    color: "#4f8cff"
    shortcut: "1"
scales:
  severity:
    required: true
    options:
      - value: minor
        label: Minor
`

describe('taxonomy editing', () => {
  it('parses raw YAML and reports syntax and schema field feedback', () => {
    expect(parseTaxonomyEditorSource(source).taxonomy.labels[0]).toMatchObject({
      id: 'noise',
      scopes: ['region', 'clip'],
    })
    expect(() => parseTaxonomyEditorSource('labels: [')).toThrow(
      'Invalid taxonomy YAML',
    )
    expect(() =>
      parseTaxonomyEditorSource('schemaVersion: 1\nlabels: []\n'),
    ).toThrow('labels must be a non-empty array')
  })

  it('synchronizes valid YAML into structured data without rewriting source', () => {
    const snapshot = parseTaxonomyEditorSource(source)
    expect(snapshot.rawSource).toBe(source)
    expect(snapshot.taxonomy.scales.severity?.required).toBe(true)
  })

  it('serializes every structured field into valid canonical YAML', () => {
    const snapshot = parseTaxonomyEditorSource(source)
    const edited: AnnotationTaxonomy = {
      ...snapshot.taxonomy,
      labels: [
        ...snapshot.taxonomy.labels,
        {
          id: 'click',
          name: 'Click',
          description: 'Transient defect',
          scopes: ['region'],
          color: '#ff4455',
          shortcut: '2',
        },
      ],
      scales: {
        ...snapshot.taxonomy.scales,
        confidence: {
          required: false,
          options: [{ value: 'high', label: 'High' }],
        },
      },
    }
    const serialized = serializeStructuredTaxonomy(edited)
    const reparsed = applyStructuredTaxonomy(edited)

    expect(serialized).toContain('description: Transient defect')
    expect(reparsed.taxonomy.labels[1]).toMatchObject({
      id: 'click',
      color: '#ff4455',
      shortcut: '2',
    })
    expect(reparsed.taxonomy.scales.confidence?.options[0]?.value).toBe('high')
  })

  it('preserves every parser-supported field through semantic YAML and structured round trips', () => {
    const parsed = parseTaxonomyEditorSource(`schemaVersion: 1
labels:
  - id: breath
    name: Audible breath
    description: Breath between phrases
    scopes: [clip, region]
    color: "#12aBcD"
    shortcut: "7"
scales:
  severity:
    required: true
    options:
      - value: low
        label: Low
      - value: high
        label: High
  confidence:
    required: false
    options:
      - value: certain
        label: Certain
`)

    expect(applyStructuredTaxonomy(parsed.taxonomy).taxonomy).toEqual(
      parsed.taxonomy,
    )
  })

  it('keeps optional label fields and omitted scales semantically stable', () => {
    const parsed = parseTaxonomyEditorSource(`schemaVersion: 1
labels:
  - id: click
    name: Click
`)
    const reparsed = applyStructuredTaxonomy(parsed.taxonomy)

    expect(reparsed.taxonomy).toEqual({
      schemaVersion: 1,
      labels: [{ id: 'click', name: 'Click', scopes: ['region'] }],
      scales: {},
    })
    expect(reparsed.rawSource).toContain('scales: {}')
  })

  it('retains invalid structured source while returning actionable parser feedback', () => {
    const invalid: AnnotationTaxonomy = {
      schemaVersion: 1,
      labels: [
        {
          id: 'noise',
          name: 'Noise',
          scopes: [],
          color: 'blue',
          shortcut: 'ff',
        },
      ],
      scales: {
        severity: { required: true, options: [] },
      },
    }
    const invalidSource = serializeStructuredTaxonomy(invalid)

    expect(invalidSource).toContain('color: blue')
    expect(invalidSource).toContain('shortcut: ff')
    expect(invalidSource).toContain('options: []')
    expect(() => parseTaxonomyEditorSource(invalidSource)).toThrow(
      'scopes must contain region, clip, or both',
    )
  })

  it('supports label and option add, edit, remove, and reorder operations without mutation', () => {
    const labels = [
      { id: 'label', name: 'First', scopes: ['region'] as const },
      { id: 'label-2', name: 'Second', scopes: ['clip'] as const },
    ]
    const addedId = nextAvailableIdentifier(
      'label',
      labels.map((label) => label.id),
    )
    const added = [
      ...labels,
      { id: addedId, name: 'Third', scopes: ['region'] as const },
    ]
    const edited = replaceEntry(added, 2, (label) => ({
      ...label,
      name: 'Edited third',
    }))
    const reordered = moveEntry(edited, 2, -1)
    const removed = removeEntry(reordered, 0)

    expect(addedId).toBe('label-3')
    expect(edited[2]?.name).toBe('Edited third')
    expect(reordered.map((label) => label.id)).toEqual([
      'label',
      'label-3',
      'label-2',
    ])
    expect(removed.map((label) => label.id)).toEqual(['label-3', 'label-2'])
    expect(labels.map((label) => label.name)).toEqual(['First', 'Second'])

    const options = [
      { value: 'option', label: 'First' },
      { value: 'option-2', label: 'Second' },
    ]
    const optionValue = nextAvailableIdentifier(
      'option',
      options.map((option) => option.value),
    )
    const editedOptions = replaceEntry(
      [...options, { value: optionValue, label: 'Third' }],
      2,
      (option) => ({ ...option, label: 'Edited third' }),
    )

    expect(optionValue).toBe('option-3')
    expect(removeEntry(moveEntry(editedOptions, 2, -1), 0)).toEqual([
      { value: 'option-3', label: 'Edited third' },
      { value: 'option-2', label: 'Second' },
    ])
  })

  it('retains the structured canonicalization warning', () => {
    expect(STRUCTURED_CANONICALIZATION_WARNING).toContain(
      'removes comments, formatting',
    )
  })

  it('reorders entries without mutating the source array', () => {
    const entries = ['first', 'second', 'third']
    expect(moveEntry(entries, 1, -1)).toEqual(['second', 'first', 'third'])
    expect(reorderEntry(entries, 0, 2)).toEqual(['second', 'third', 'first'])
    expect(entries).toEqual(['first', 'second', 'third'])
    expect(moveEntry(entries, 0, -1)).toEqual(entries)
    expect(reorderEntry(entries, -1, 2)).toEqual(entries)
  })
})
