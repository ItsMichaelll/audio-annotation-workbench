import { describe, expect, it } from 'vitest'
import {
  createAnnotationDocument,
  normalizeAnnotation,
  normalizeAnnotationCardinality,
  setLabelAssignment,
  setRegionLabelAssignment,
  validateSubmission,
} from './annotations'
import { parseAnnotationTaxonomy } from './annotationTaxonomy'

const taxonomy = parseAnnotationTaxonomy({
  schemaVersion: 1,
  labels: [
    { id: 'region-label', name: 'Region', scopes: ['region'] },
    { id: 'clip-label', name: 'Clip', scopes: ['clip'] },
  ],
  scales: {
    severity: { required: true, options: [{ value: 'minor', label: 'Minor' }] },
  },
})

function document() {
  return createAnnotationDocument({
    id: 'annotation',
    projectId: 'project',
    taskId: 'task',
    taxonomyVersionId: 'taxonomy-v1',
    now: '2026-01-01T00:00:00.000Z',
  })
}

describe('annotation domain', () => {
  it('pins the taxonomy version and normalizes/clamps regions', () => {
    const source = {
      ...document(),
      regions: [{ id: 'region', start: 12, end: -2, assignments: [] }],
    }
    const normalized = normalizeAnnotation(source, 10)
    expect(normalized.taxonomyVersionId).toBe('taxonomy-v1')
    expect(normalized.regions[0]).toMatchObject({ start: 0, end: 10 })
  })

  it('prevents duplicate target assignments and deletes assignments with their region', () => {
    const once = setLabelAssignment([], 'region-label', true)
    expect(setLabelAssignment(once, 'region-label', true)).toEqual(once)
    const withRegion = {
      ...document(),
      regions: [{ id: 'r', start: 0, end: 1, assignments: once }],
    }
    expect(
      {
        ...withRegion,
        regions: withRegion.regions.filter((region) => region.id !== 'r'),
      }.regions,
    ).toEqual([])
  })

  it('replaces a region label while retaining clip multi-select behavior', () => {
    expect(
      setRegionLabelAssignment(
        [{ labelId: 'first', severity: 'minor' }],
        'second',
      ),
    ).toEqual([{ labelId: 'second' }])
    expect(setLabelAssignment([{ labelId: 'first' }], 'second', true)).toEqual([
      { labelId: 'first' },
      { labelId: 'second' },
    ])
  })

  it('deterministically retains the first existing region label', () => {
    const normalized = normalizeAnnotationCardinality({
      ...document(),
      regions: [
        {
          id: 'r',
          start: 0,
          end: 1,
          assignments: [
            { labelId: 'first', severity: 'minor' },
            { labelId: 'second' },
          ],
        },
      ],
      clipAssignments: [{ labelId: 'first' }, { labelId: 'second' }],
    })
    expect(normalized.regions[0]?.assignments).toEqual([
      { labelId: 'first', severity: 'minor' },
    ])
    expect(normalized.clipAssignments).toHaveLength(2)
  })

  it('validates scope, required scales, duplicates, timing, and empty confirmation state', () => {
    expect(validateSubmission(document(), taxonomy, 2)).toMatchObject({
      valid: true,
      empty: true,
    })
    const invalid = {
      ...document(),
      regions: [
        {
          id: 'r',
          start: 0,
          end: 3,
          assignments: [{ labelId: 'clip-label' }, { labelId: 'clip-label' }],
        },
      ],
    }
    const result = validateSubmission(invalid, taxonomy, 2)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Region r must have exactly one label.')
    expect(result.errors.join(' ')).toMatch(
      /invalid timing|cannot be assigned|repeats label/,
    )
    const missingRequired = {
      ...document(),
      regions: [
        {
          id: 'r',
          start: 0,
          end: 1,
          assignments: [{ labelId: 'region-label' }],
        },
      ],
    }
    expect(
      validateSubmission(missingRequired, taxonomy, 2).errors.join(' '),
    ).toContain('requires severity')
  })
})
