import { setRegionLabelAssignment, updateAssignment } from './annotations'
import type { AnnotationDocument, LabelAssignment } from './models'

export function selectRegionIds(
  current: readonly string[],
  id: string,
  toggle = false,
): string[] {
  if (!toggle) return [id]
  return current.includes(id)
    ? current.filter((selected) => selected !== id)
    : [...current, id]
}

export function retainRegionSelection(
  selected: readonly string[],
  regions: readonly { id: string }[],
): string[] {
  const available = new Set(regions.map((region) => region.id))
  return selected.filter((id) => available.has(id))
}

export function deleteSelectedRegions<T extends { id: string }>(
  regions: readonly T[],
  selected: readonly string[],
): T[] {
  const ids = new Set(selected)
  return regions.filter((region) => !ids.has(region.id))
}

export function commonSelectedRegionAssignment(
  document: AnnotationDocument,
  selected: readonly string[],
): LabelAssignment | null {
  const ids = new Set(selected)
  const targets = document.regions.filter((region) => ids.has(region.id))
  if (targets.length === 0 || targets.length !== ids.size) return null
  const assignments = targets.map((region) => region.assignments[0])
  const first = assignments[0]
  if (
    !first ||
    assignments.some((assignment) => assignment?.labelId !== first.labelId)
  )
    return null
  const severity = assignments.every(
    (assignment) => assignment?.severity === first.severity,
  )
    ? first.severity
    : undefined
  const confidence = assignments.every(
    (assignment) => assignment?.confidence === first.confidence,
  )
    ? first.confidence
    : undefined
  return {
    labelId: first.labelId,
    ...(severity ? { severity } : {}),
    ...(confidence ? { confidence } : {}),
  }
}

export function updateSelectedRegionAssignment(
  document: AnnotationDocument,
  selected: readonly string[],
  labelId: string,
  values: Pick<LabelAssignment, 'severity' | 'confidence'>,
): AnnotationDocument {
  const ids = new Set(selected)
  return {
    ...document,
    regions: document.regions.map((region) =>
      ids.has(region.id)
        ? {
            ...region,
            assignments: updateAssignment(region.assignments, labelId, values),
          }
        : region,
    ),
  }
}

export async function assignSelectedRegionLabel(
  document: AnnotationDocument,
  selected: readonly string[],
  labelId: string,
  confirm: (options: {
    title: string
    message: string
    confirmLabel: string
  }) => Promise<boolean>,
): Promise<AnnotationDocument | null> {
  const ids = new Set(selected)
  const targets = document.regions.filter((region) => ids.has(region.id))
  const labeled = targets.filter(
    (region) => region.assignments.length > 0,
  ).length
  const replaces = targets.some((region) =>
    region.assignments.some((assignment) => assignment.labelId !== labelId),
  )
  if (
    targets.length > 1 &&
    replaces &&
    !(await confirm({
      title: 'Replace region labels?',
      message: `${labeled} selected regions already have labels. Assigning this label to all ${targets.length} selected regions will replace their existing labels.`,
      confirmLabel: 'Assign label to all',
    }))
  )
    return null
  return {
    ...document,
    regions: document.regions.map((region) =>
      ids.has(region.id)
        ? {
            ...region,
            assignments: setRegionLabelAssignment(region.assignments, labelId),
          }
        : region,
    ),
  }
}
