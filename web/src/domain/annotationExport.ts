import { parseAnnotationTaxonomy } from './annotationTaxonomy'
import type {
  AnnotationDocument,
  LabelAssignment,
  TaskRecord,
  TaxonomyVersion,
} from './models'
import { orderedTasks } from './taskQueue'

export const ANNOTATION_EXPORT_SCHEMA_VERSION = 1 as const
export type AnnotationExportMode = 'submitted' | 'all'
export type AnnotationExportFormat = 'jsonl' | 'csv'

export interface AnnotationExportSource {
  project: { id: string; name: string }
  taxonomyVersions: TaxonomyVersion[]
  tasks: TaskRecord[]
  annotations: AnnotationDocument[]
}

export interface AnnotationJsonlRecord {
  schemaVersion: typeof ANNOTATION_EXPORT_SCHEMA_VERSION
  project: { id: string; name: string }
  task: {
    id: string
    externalId: string | null
    displayName: string | null
    relativePath: string | null
    status: TaskRecord['status']
    metadata: Record<string, unknown>
  }
  annotation: AnnotationDocument | null
  pinnedTaxonomy: {
    id: string
    version: number
    taxonomySchemaVersion: string | null
    labels: Array<{ id: string; name: string; scopes: string[] }>
    scales: ReturnType<typeof parseAnnotationTaxonomy>['scales']
  } | null
}

export const ANNOTATION_CSV_COLUMNS = [
  'export_schema_version',
  'project_id',
  'project_name',
  'task_id',
  'task_external_id',
  'task_display_name',
  'task_relative_path',
  'task_status',
  'task_metadata_json',
  'annotation_id',
  'annotation_revision',
  'annotation_submitted_at',
  'taxonomy_version_id',
  'taxonomy_version',
  'scope',
  'region_id',
  'region_start',
  'region_end',
  'region_duration',
  'label_id',
  'label_name',
  'severity',
  'confidence',
  'region_notes',
  'task_notes',
] as const

type CsvColumn = (typeof ANNOTATION_CSV_COLUMNS)[number]
type CsvRow = Record<CsvColumn, string>

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function includedTasks(
  source: AnnotationExportSource,
  mode: AnnotationExportMode,
): TaskRecord[] {
  return orderedTasks(source.tasks).filter(
    (task) => mode === 'all' || task.status === 'submitted',
  )
}

function annotationByTask(source: AnnotationExportSource) {
  return new Map(
    source.annotations.map((annotation) => [annotation.taskId, annotation]),
  )
}

function taxonomyById(source: AnnotationExportSource) {
  return new Map(
    source.taxonomyVersions.map((taxonomy) => [taxonomy.id, taxonomy]),
  )
}

export function buildAnnotationJsonlRecords(
  source: AnnotationExportSource,
  mode: AnnotationExportMode,
): AnnotationJsonlRecord[] {
  const annotations = annotationByTask(source)
  const taxonomies = taxonomyById(source)
  return includedTasks(source, mode).flatMap((task) => {
    const annotation = annotations.get(task.id) ?? null
    if (mode === 'submitted' && !annotation?.submittedAt) return []
    const taxonomy = annotation
      ? taxonomies.get(annotation.taxonomyVersionId)
      : undefined
    if (annotation && !taxonomy) {
      throw new Error(
        `Annotation ${annotation.id} references a missing taxonomy version.`,
      )
    }
    const parsed = taxonomy
      ? parseAnnotationTaxonomy(taxonomy.document)
      : undefined
    return [
      {
        schemaVersion: ANNOTATION_EXPORT_SCHEMA_VERSION,
        project: {
          id: source.project.id,
          name: source.project.name,
        },
        task: {
          id: task.id,
          externalId: task.externalId ?? null,
          displayName: task.displayName ?? null,
          relativePath: task.relativePath ?? null,
          status: task.status,
          metadata: canonicalize(task.metadata) as Record<string, unknown>,
        },
        annotation,
        pinnedTaxonomy:
          taxonomy && parsed
            ? {
                id: taxonomy.id,
                version: taxonomy.version,
                taxonomySchemaVersion: taxonomy.taxonomySchemaVersion ?? null,
                labels: parsed.labels
                  .map(({ id, name, scopes }) => ({ id, name, scopes }))
                  .sort((left, right) => left.id.localeCompare(right.id)),
                scales: parsed.scales,
              }
            : null,
      },
    ]
  })
}

export function serializeAnnotationJsonl(
  source: AnnotationExportSource,
  mode: AnnotationExportMode,
): string {
  const records = buildAnnotationJsonlRecords(source, mode)
  return records.length
    ? `${records.map((record) => canonicalJson(record)).join('\n')}\n`
    : ''
}

function blankRow(): CsvRow {
  return Object.fromEntries(
    ANNOTATION_CSV_COLUMNS.map((column) => [column, '']),
  ) as CsvRow
}

function commonRow(
  source: AnnotationExportSource,
  task: TaskRecord,
  annotation: AnnotationDocument | null,
  taxonomy: TaxonomyVersion | null,
): CsvRow {
  return {
    ...blankRow(),
    export_schema_version: String(ANNOTATION_EXPORT_SCHEMA_VERSION),
    project_id: source.project.id,
    project_name: source.project.name,
    task_id: task.id,
    task_external_id: task.externalId ?? '',
    task_display_name: task.displayName ?? '',
    task_relative_path: task.relativePath ?? '',
    task_status: task.status,
    task_metadata_json: canonicalJson(task.metadata),
    annotation_id: annotation?.id ?? '',
    annotation_revision: annotation === null ? '' : String(annotation.revision),
    annotation_submitted_at: annotation?.submittedAt ?? '',
    taxonomy_version_id: taxonomy?.id ?? '',
    taxonomy_version: taxonomy ? String(taxonomy.version) : '',
    task_notes: annotation?.taskNotes ?? '',
  }
}

function assignmentRow(
  base: CsvRow,
  assignment: LabelAssignment,
  labelName: string,
): CsvRow {
  return {
    ...base,
    label_id: assignment.labelId,
    label_name: labelName,
    severity: assignment.severity ?? '',
    confidence: assignment.confidence ?? '',
  }
}

export function buildAnnotationCsvRows(
  source: AnnotationExportSource,
  mode: AnnotationExportMode,
): CsvRow[] {
  const annotations = annotationByTask(source)
  const taxonomies = taxonomyById(source)
  const rows: CsvRow[] = []
  for (const task of includedTasks(source, mode)) {
    const annotation = annotations.get(task.id) ?? null
    if (mode === 'submitted' && !annotation?.submittedAt) continue
    const taxonomy = annotation
      ? (taxonomies.get(annotation.taxonomyVersionId) ?? null)
      : null
    if (annotation && !taxonomy) {
      throw new Error(
        `Annotation ${annotation.id} references a missing taxonomy version.`,
      )
    }
    const labels = new Map(
      taxonomy
        ? parseAnnotationTaxonomy(taxonomy.document).labels.map((label) => [
            label.id,
            label.name,
          ])
        : [],
    )
    const base = commonRow(source, task, annotation, taxonomy)
    let assignmentCount = 0
    for (const region of [...(annotation?.regions ?? [])].sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      for (const assignment of [...region.assignments].sort((left, right) =>
        left.labelId.localeCompare(right.labelId),
      )) {
        rows.push({
          ...assignmentRow(
            base,
            assignment,
            labels.get(assignment.labelId) ?? '',
          ),
          scope: 'region',
          region_id: region.id,
          region_start: String(region.start),
          region_end: String(region.end),
          region_duration: String(region.end - region.start),
          region_notes: region.notes ?? '',
        })
        assignmentCount += 1
      }
    }
    for (const assignment of [...(annotation?.clipAssignments ?? [])].sort(
      (left, right) => left.labelId.localeCompare(right.labelId),
    )) {
      rows.push({
        ...assignmentRow(
          base,
          assignment,
          labels.get(assignment.labelId) ?? '',
        ),
        scope: 'clip',
      })
      assignmentCount += 1
    }
    if (mode === 'all' && assignmentCount === 0) {
      rows.push({ ...base, scope: 'task' })
    }
  }
  return rows
}

export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function serializeAnnotationCsv(
  source: AnnotationExportSource,
  mode: AnnotationExportMode,
): string {
  const lines = [
    ANNOTATION_CSV_COLUMNS.join(','),
    ...buildAnnotationCsvRows(source, mode).map((row) =>
      ANNOTATION_CSV_COLUMNS.map((column) => escapeCsvField(row[column])).join(
        ',',
      ),
    ),
  ]
  return `${lines.join('\r\n')}\r\n`
}
