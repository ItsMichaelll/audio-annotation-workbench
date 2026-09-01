import {
  ANNOTATION_SCHEMA_VERSION,
  type AnnotationDocument,
  type LabelAssignment,
  type RegionAnnotation,
} from './models'
import type { AnnotationScope, AnnotationTaxonomy } from './annotationTaxonomy'
import { normalizeRegion } from './region'

export interface SubmissionValidation {
  valid: boolean
  empty: boolean
  errors: string[]
}

export function createAnnotationDocument(input: {
  id: string
  projectId: string
  taskId: string
  taxonomyVersionId: string
  now: string
}): AnnotationDocument {
  return {
    id: input.id,
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
    projectId: input.projectId,
    taskId: input.taskId,
    taxonomyVersionId: input.taxonomyVersionId,
    revision: 0,
    regions: [],
    clipAssignments: [],
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export function annotationsEqual(
  left: AnnotationDocument,
  right: AnnotationDocument,
): boolean {
  const comparable = (document: AnnotationDocument) => ({
    ...document,
    revision: 0,
    updatedAt: '',
  })
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right))
}

export function normalizeAnnotation(
  document: AnnotationDocument,
  duration: number,
): AnnotationDocument {
  const regions: RegionAnnotation[] = []
  const ids = new Set<string>()
  for (const region of document.regions) {
    if (ids.has(region.id)) continue
    const bounds = normalizeRegion(region.start, region.end, duration)
    if (!bounds) continue
    ids.add(region.id)
    regions.push({
      ...region,
      ...bounds,
      assignments: normalizeRegionAssignments(region.assignments),
    })
  }
  return {
    ...document,
    regions,
    clipAssignments: uniqueAssignments(document.clipAssignments),
  }
}

export function normalizeAnnotationCardinality(
  document: AnnotationDocument,
): AnnotationDocument {
  return {
    ...document,
    regions: document.regions.map((region) => ({
      ...region,
      assignments: normalizeRegionAssignments(region.assignments),
    })),
    clipAssignments: uniqueAssignments(document.clipAssignments),
  }
}

export function uniqueAssignments(
  assignments: readonly LabelAssignment[],
): LabelAssignment[] {
  const seen = new Set<string>()
  return assignments.filter((assignment) => {
    if (seen.has(assignment.labelId)) return false
    seen.add(assignment.labelId)
    return true
  })
}

export function normalizeRegionAssignments(
  assignments: readonly LabelAssignment[],
): LabelAssignment[] {
  return uniqueAssignments(assignments).slice(0, 1)
}

export function setRegionLabelAssignment(
  assignments: readonly LabelAssignment[],
  labelId: string,
): LabelAssignment[] {
  const current = normalizeRegionAssignments(assignments)[0]
  return current?.labelId === labelId ? [current] : [{ labelId }]
}

export function setLabelAssignment(
  assignments: readonly LabelAssignment[],
  labelId: string,
  enabled: boolean,
): LabelAssignment[] {
  const normalized = uniqueAssignments(assignments)
  const exists = normalized.some((item) => item.labelId === labelId)
  if (enabled && !exists) return [...normalized, { labelId }]
  if (!enabled && exists)
    return normalized.filter((item) => item.labelId !== labelId)
  return normalized
}

export function updateAssignment(
  assignments: readonly LabelAssignment[],
  labelId: string,
  values: Pick<LabelAssignment, 'severity' | 'confidence'>,
): LabelAssignment[] {
  return uniqueAssignments(assignments).map((assignment) =>
    assignment.labelId === labelId
      ? {
          labelId,
          ...(values.severity ? { severity: values.severity } : {}),
          ...(values.confidence ? { confidence: values.confidence } : {}),
        }
      : assignment,
  )
}

function validateAssignments(
  assignments: readonly LabelAssignment[],
  scope: AnnotationScope,
  taxonomy: AnnotationTaxonomy,
  target: string,
  errors: string[],
) {
  const seen = new Set<string>()
  for (const assignment of assignments) {
    if (seen.has(assignment.labelId)) {
      errors.push(`${target} repeats label ${assignment.labelId}.`)
      continue
    }
    seen.add(assignment.labelId)
    const label = taxonomy.labels.find((item) => item.id === assignment.labelId)
    if (!label) {
      errors.push(`${target} references missing label ${assignment.labelId}.`)
      continue
    }
    if (!label.scopes.includes(scope)) {
      errors.push(`${label.name} cannot be assigned to a ${scope}.`)
    }
    for (const scaleName of ['severity', 'confidence'] as const) {
      const scale = taxonomy.scales[scaleName]
      const value = assignment[scaleName]
      if (scale?.required && !value) {
        errors.push(`${target} ${label.name} requires ${scaleName}.`)
      }
      if (value && !scale?.options.some((option) => option.value === value)) {
        errors.push(`${target} ${label.name} has an invalid ${scaleName}.`)
      }
    }
  }
}

export function validateSubmission(
  document: AnnotationDocument,
  taxonomy: AnnotationTaxonomy,
  duration: number,
  saveFailed = false,
): SubmissionValidation {
  const errors: string[] = []
  if (saveFailed)
    errors.push('Resolve the draft save failure before submitting.')
  if (
    document.regions.length > 0 &&
    (!Number.isFinite(duration) || duration <= 0)
  ) {
    errors.push('Audio duration is unavailable for region validation.')
  }
  const regionIds = new Set<string>()
  for (const region of document.regions) {
    if (regionIds.has(region.id))
      errors.push(`Region id ${region.id} is duplicated.`)
    regionIds.add(region.id)
    if (
      !Number.isFinite(region.start) ||
      !Number.isFinite(region.end) ||
      region.start < 0 ||
      region.end <= region.start ||
      region.end > duration
    ) {
      errors.push(`Region ${region.id} has invalid timing.`)
    }
    if (region.assignments.length === 0) {
      errors.push(`Region ${region.id} has no label.`)
    }
    if (region.assignments.length > 1) {
      errors.push(`Region ${region.id} must have exactly one label.`)
    }
    validateAssignments(
      region.assignments,
      'region',
      taxonomy,
      `Region ${region.id}`,
      errors,
    )
  }
  validateAssignments(
    document.clipAssignments,
    'clip',
    taxonomy,
    'Clip',
    errors,
  )
  return {
    valid: errors.length === 0,
    empty:
      document.regions.length === 0 && document.clipAssignments.length === 0,
    errors,
  }
}
