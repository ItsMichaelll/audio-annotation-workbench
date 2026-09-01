import { describe, expect, it } from 'vitest'
import {
  AnnotationTaxonomyError,
  parseAnnotationTaxonomy,
} from './annotationTaxonomy'

const valid = {
  schemaVersion: 1,
  labels: [
    {
      id: 'noise',
      name: 'Noise',
      scopes: ['region', 'clip'],
      color: '#4f8cff',
      shortcut: '1',
    },
    { id: 'click', name: 'Click' },
  ],
  scales: {
    severity: { required: true, options: [{ value: 'minor', label: 'Minor' }] },
    confidence: {
      required: false,
      options: [{ value: 'high', label: 'High' }],
    },
  },
}

describe('annotation taxonomy', () => {
  it('normalizes version-one labels, default scopes, and scales', () => {
    const taxonomy = parseAnnotationTaxonomy(valid)
    expect(taxonomy.labels[1]?.scopes).toEqual(['region'])
    expect(taxonomy.scales.severity).toMatchObject({ required: true })
  })

  it('reports duplicate IDs, invalid scopes, colors, shortcuts, and malformed scales', () => {
    expect(() =>
      parseAnnotationTaxonomy({
        schemaVersion: 1,
        labels: [
          {
            id: 'same',
            name: 'One',
            scopes: ['other'],
            color: 'blue',
            shortcut: 'f',
          },
          { id: 'same', name: 'Two', shortcut: 'f' },
        ],
        scales: {
          severity: {
            required: 'yes',
            options: [
              { value: 'x', label: 'X' },
              { value: 'x', label: 'Again' },
            ],
          },
        },
      }),
    ).toThrow(AnnotationTaxonomyError)
    try {
      parseAnnotationTaxonomy({ schemaVersion: 2, labels: [] })
    } catch (error) {
      expect((error as AnnotationTaxonomyError).issues).toEqual(
        expect.arrayContaining([
          'schemaVersion must be 1.',
          'labels must be a non-empty array.',
        ]),
      )
    }
  })
})
