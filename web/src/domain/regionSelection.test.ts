import { describe, expect, it, vi } from 'vitest'
import { createAnnotationDocument } from './annotations'
import type { AnnotationDocument } from './models'
import {
  assignSelectedRegionLabel,
  commonSelectedRegionAssignment,
  deleteSelectedRegions,
  retainRegionSelection,
  selectRegionIds,
  updateSelectedRegionAssignment,
} from './regionSelection'
import { keyboardCommand, isEditableElement } from './keyboard'

function document(): AnnotationDocument {
  return {
    ...createAnnotationDocument({
      id: 'doc',
      projectId: 'project',
      taskId: 'task',
      taxonomyVersionId: 'taxonomy',
      now: '2026-01-01T00:00:00Z',
    }),
    regions: [
      {
        id: 'a',
        start: 0,
        end: 1,
        assignments: [{ labelId: 'old', severity: 'minor' }],
      },
      { id: 'b', start: 1, end: 2, assignments: [] },
      { id: 'c', start: 2, end: 3, assignments: [{ labelId: 'keep' }] },
    ],
  }
}

describe('region selection and bulk actions', () => {
  it('replaces single selection and toggles individual members without duplicates', () => {
    expect(selectRegionIds(['a', 'b'], 'c')).toEqual(['c'])
    expect(selectRegionIds(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(selectRegionIds(['a', 'b'], 'a', true)).toEqual(['b'])
    expect(selectRegionIds(['a'], 'a', true)).toEqual([])
  })
  it('drops deleted regions and selection from another task', () => {
    expect(retainRegionSelection(['a', 'b'], [{ id: 'b' }])).toEqual(['b'])
    expect(
      retainRegionSelection(['a', 'b'], [{ id: 'new-task-region' }]),
    ).toEqual([])
  })
  it('deletes only selected regions without mutating the source', () => {
    const source = document()
    expect(
      deleteSelectedRegions(source.regions, ['a', 'c']).map((r) => r.id),
    ).toEqual(['b'])
    expect(source.regions).toHaveLength(3)
  })
  it('projects a common bulk assignment for checked labels and shared scales', () => {
    const source = document()
    source.regions[1]!.assignments = [
      { labelId: 'old', severity: 'minor', confidence: 'high' },
    ]
    expect(commonSelectedRegionAssignment(source, ['a', 'b'])).toEqual({
      labelId: 'old',
      severity: 'minor',
    })
    source.regions[1]!.assignments = [{ labelId: 'different' }]
    expect(commonSelectedRegionAssignment(source, ['a', 'b'])).toBeNull()
  })
  it('bulk-applies assignment scales only to selected regions', () => {
    const source = document()
    source.regions[1]!.assignments = [{ labelId: 'old' }]
    const next = updateSelectedRegionAssignment(source, ['a', 'b'], 'old', {
      severity: 'major',
      confidence: 'high',
    })
    expect(
      next.regions.slice(0, 2).map((region) => region.assignments),
    ).toEqual([
      [{ labelId: 'old', severity: 'major', confidence: 'high' }],
      [{ labelId: 'old', severity: 'major', confidence: 'high' }],
    ])
    expect(next.regions[2]).toBe(source.regions[2])
  })
  it('warns with the labeled count and cancellation changes nothing', async () => {
    const source = document()
    const confirm = vi.fn().mockResolvedValue(false)
    expect(
      await assignSelectedRegionLabel(source, ['a', 'b', 'c'], 'new', confirm),
    ).toBeNull()
    expect(confirm.mock.calls[0]![0].message).toContain(
      '2 selected regions already have labels',
    )
    expect(source.regions[0]!.assignments[0]!.labelId).toBe('old')
  })
  it('assigns all selected regions after confirmation and preserves other regions', async () => {
    const source = document()
    const confirm = vi.fn().mockResolvedValue(true)
    const next = await assignSelectedRegionLabel(
      source,
      ['a', 'b'],
      'new',
      confirm,
    )
    expect(next!.regions.slice(0, 2).map((r) => r.assignments)).toEqual([
      [{ labelId: 'new' }],
      [{ labelId: 'new' }],
    ])
    expect(next!.regions[2]).toBe(source.regions[2])
    expect(confirm).toHaveBeenCalledOnce()
  })
  it('preserves single editing and avoids warnings when no label is replaced', async () => {
    const confirm = vi.fn().mockResolvedValue(true)
    await assignSelectedRegionLabel(document(), ['a'], 'new', confirm)
    const next = await assignSelectedRegionLabel(
      document(),
      ['a', 'b'],
      'old',
      confirm,
    )
    expect(next!.regions[0]!.assignments).toEqual([
      { labelId: 'old', severity: 'minor' },
    ])
    expect(confirm).not.toHaveBeenCalled()
  })
  it('maps both Select All modifiers while leaving editable fields protected', () => {
    expect(keyboardCommand({ key: 'a', ctrlKey: true })).toEqual({
      type: 'select-all-regions',
    })
    expect(keyboardCommand({ key: 'a', metaKey: true })).toEqual({
      type: 'select-all-regions',
    })
    expect(
      keyboardCommand({ key: 'a', ctrlKey: true, altKey: true }),
    ).toBeNull()
    expect(isEditableElement('input')).toBe(true)
    expect(isEditableElement('textarea')).toBe(true)
    expect(isEditableElement('div', true)).toBe(true)
  })
})
