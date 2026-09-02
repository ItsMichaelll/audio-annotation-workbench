import { parseAnnotationTaxonomy } from './annotationTaxonomy'
import {
  ANNOTATION_SCHEMA_VERSION,
  INSTRUCTIONS_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  TASK_STATUSES,
  TAXONOMY_RECORD_SCHEMA_VERSION,
  type AnnotationDocument,
  type Project,
  type ProjectInstructions,
  type TaskRecord,
  type TaxonomyVersion,
} from './models'
import { orderedTasks } from './taskQueue'
import { normalizeRelativePath } from './taskIngestion'

export const PROJECT_BACKUP_FORMAT =
  'audio-annotation-workbench-project' as const
export const PROJECT_BACKUP_FORMAT_VERSION = 1 as const
export const PROJECT_BACKUP_MAX_BYTES = 10 * 1024 * 1024

export interface ProjectBackup {
  format: typeof PROJECT_BACKUP_FORMAT
  formatVersion: typeof PROJECT_BACKUP_FORMAT_VERSION
  exportedAt: string
  project: Project
  taxonomyVersions: TaxonomyVersion[]
  instructions: ProjectInstructions | null
  tasks: TaskRecord[]
  annotations: AnnotationDocument[]
}

export interface ProjectBackupRecords {
  project: Project
  taxonomyVersions: TaxonomyVersion[]
  instructions: ProjectInstructions | null
  tasks: TaskRecord[]
  annotations: AnnotationDocument[]
}

type JsonRecord = Record<string, unknown>

function fail(message: string): never {
  throw new Error(`Invalid project backup: ${message}`)
}

function object(value: unknown, name: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${name} must be an object.`)
  }
  return value as JsonRecord
}

function exactKeys(
  value: JsonRecord,
  name: string,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional])
  for (const key of required) {
    if (!(key in value)) fail(`${name}.${key} is required.`)
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${name}.${key} is not supported.`)
  }
}

function string(value: unknown, name: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    fail(`${name} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`)
  }
  return value
}

function finiteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${name} must be a finite number.`)
  }
  return value
}

function nonNegativeInteger(value: unknown, name: string): number {
  const number = finiteNumber(value, name)
  if (!Number.isInteger(number) || number < 0) {
    fail(`${name} must be a non-negative integer.`)
  }
  return number
}

function isoDate(value: unknown, name: string): string {
  const date = string(value, name)
  if (!Number.isFinite(Date.parse(date))) fail(`${name} must be an ISO date.`)
  return date
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) fail(`${name} must be an array.`)
  return value
}

function jsonValue(value: unknown, name: string): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${name} contains a non-finite number.`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => jsonValue(entry, `${name}[${index}]`))
    return
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as JsonRecord)) {
      jsonValue(entry, `${name}.${key}`)
    }
    return
  }
  fail(`${name} contains non-JSON data.`)
}

function schemaVersion(value: unknown, expected: number, name: string): void {
  if (value !== expected) {
    fail(`${name} schema version ${String(value)} is unsupported.`)
  }
}

function validateProject(value: unknown): Project {
  const item = object(value, 'project')
  exactKeys(
    item,
    'project',
    [
      'id',
      'schemaVersion',
      'name',
      'status',
      'activeTaxonomyVersionId',
      'createdAt',
      'updatedAt',
    ],
    ['description', 'instructionsId'],
  )
  schemaVersion(item.schemaVersion, PROJECT_SCHEMA_VERSION, 'Project')
  string(item.id, 'project.id')
  string(item.name, 'project.name')
  if (item.status !== 'active' && item.status !== 'archived') {
    fail('project.status is unsupported.')
  }
  string(item.activeTaxonomyVersionId, 'project.activeTaxonomyVersionId')
  if (item.description !== undefined)
    string(item.description, 'project.description', true)
  if (item.instructionsId !== undefined)
    string(item.instructionsId, 'project.instructionsId')
  isoDate(item.createdAt, 'project.createdAt')
  isoDate(item.updatedAt, 'project.updatedAt')
  return item as unknown as Project
}

function validateTaxonomy(value: unknown, index: number): TaxonomyVersion {
  const name = `taxonomyVersions[${index}]`
  const item = object(value, name)
  exactKeys(
    item,
    name,
    [
      'id',
      'schemaVersion',
      'projectId',
      'version',
      'sourceFilename',
      'sourceFormat',
      'rawSource',
      'document',
      'metadata',
      'contentHash',
      'createdAt',
    ],
    ['taxonomySchemaVersion'],
  )
  schemaVersion(
    item.schemaVersion,
    TAXONOMY_RECORD_SCHEMA_VERSION,
    'Taxonomy record',
  )
  string(item.id, `${name}.id`)
  string(item.projectId, `${name}.projectId`)
  const version = nonNegativeInteger(item.version, `${name}.version`)
  if (version < 1) fail(`${name}.version must be at least 1.`)
  string(item.sourceFilename, `${name}.sourceFilename`)
  if (item.sourceFormat !== 'json' && item.sourceFormat !== 'yaml') {
    fail(`${name}.sourceFormat is unsupported.`)
  }
  string(item.rawSource, `${name}.rawSource`, true)
  const document = object(item.document, `${name}.document`)
  jsonValue(document, `${name}.document`)
  const metadata = object(item.metadata, `${name}.metadata`)
  exactKeys(metadata, `${name}.metadata`, [], ['name', 'schemaVersion'])
  if (metadata.name !== undefined)
    string(metadata.name, `${name}.metadata.name`)
  if (metadata.schemaVersion !== undefined)
    string(metadata.schemaVersion, `${name}.metadata.schemaVersion`)
  if (item.taxonomySchemaVersion !== undefined)
    string(item.taxonomySchemaVersion, `${name}.taxonomySchemaVersion`)
  string(item.contentHash, `${name}.contentHash`)
  isoDate(item.createdAt, `${name}.createdAt`)
  return item as unknown as TaxonomyVersion
}

function validateInstructions(value: unknown): ProjectInstructions | null {
  if (value === null) return null
  const item = object(value, 'instructions')
  exactKeys(item, 'instructions', [
    'id',
    'schemaVersion',
    'projectId',
    'sourceFilename',
    'rawMarkdown',
    'createdAt',
    'updatedAt',
  ])
  schemaVersion(item.schemaVersion, INSTRUCTIONS_SCHEMA_VERSION, 'Instructions')
  string(item.id, 'instructions.id')
  string(item.projectId, 'instructions.projectId')
  string(item.sourceFilename, 'instructions.sourceFilename')
  string(item.rawMarkdown, 'instructions.rawMarkdown', true)
  isoDate(item.createdAt, 'instructions.createdAt')
  isoDate(item.updatedAt, 'instructions.updatedAt')
  return item as unknown as ProjectInstructions
}

function validateSourceIdentity(value: unknown, name: string): void {
  const identity = object(value, name)
  if (identity.kind === 'direct-file') {
    exactKeys(identity, name, ['kind', 'filename', 'size'])
    const filename = string(identity.filename, `${name}.filename`)
    if (filename.includes('/') || filename.includes('\\')) {
      fail(`${name}.filename must not contain a filesystem path.`)
    }
    nonNegativeInteger(identity.size, `${name}.size`)
    return
  }
  if (identity.kind === 'manifest') {
    exactKeys(identity, name, ['kind', 'relativePath'])
    const relativePath = string(identity.relativePath, `${name}.relativePath`)
    try {
      if (normalizeRelativePath(relativePath) !== relativePath)
        throw new Error()
    } catch {
      fail(`${name}.relativePath must be a normalized safe relative path.`)
    }
    return
  }
  fail(`${name}.kind is unsupported.`)
}

function validateTask(value: unknown, index: number): TaskRecord {
  const name = `tasks[${index}]`
  const item = object(value, name)
  exactKeys(
    item,
    name,
    [
      'id',
      'schemaVersion',
      'projectId',
      'status',
      'primaryMedia',
      'metadata',
      'createdAt',
      'updatedAt',
    ],
    [
      'externalId',
      'displayName',
      'relativePath',
      'sourceIdentity',
      'importOrder',
    ],
  )
  schemaVersion(item.schemaVersion, TASK_SCHEMA_VERSION, 'Task')
  string(item.id, `${name}.id`)
  string(item.projectId, `${name}.projectId`)
  if (!TASK_STATUSES.includes(item.status as TaskRecord['status'])) {
    fail(`${name}.status is unsupported.`)
  }
  for (const key of ['externalId', 'displayName', 'relativePath'] as const) {
    if (item[key] !== undefined) string(item[key], `${name}.${key}`)
  }
  if (typeof item.relativePath === 'string') {
    try {
      if (normalizeRelativePath(item.relativePath) !== item.relativePath) {
        throw new Error()
      }
    } catch {
      fail(`${name}.relativePath must be a normalized safe relative path.`)
    }
  }
  const media = object(item.primaryMedia, `${name}.primaryMedia`)
  exactKeys(media, `${name}.primaryMedia`, ['kind', 'displayName', 'reason'])
  if (media.kind !== 'unresolved' || media.reason !== 'not-yet-linked') {
    fail(`${name}.primaryMedia must be a portable unresolved source.`)
  }
  string(media.displayName, `${name}.primaryMedia.displayName`)
  if (item.sourceIdentity !== undefined)
    validateSourceIdentity(item.sourceIdentity, `${name}.sourceIdentity`)
  const metadata = object(item.metadata, `${name}.metadata`)
  jsonValue(metadata, `${name}.metadata`)
  if (item.importOrder !== undefined)
    nonNegativeInteger(item.importOrder, `${name}.importOrder`)
  isoDate(item.createdAt, `${name}.createdAt`)
  isoDate(item.updatedAt, `${name}.updatedAt`)
  return item as unknown as TaskRecord
}

function validateAssignment(value: unknown, name: string): void {
  const item = object(value, name)
  exactKeys(item, name, ['labelId'], ['severity', 'confidence'])
  string(item.labelId, `${name}.labelId`)
  if (item.severity !== undefined) string(item.severity, `${name}.severity`)
  if (item.confidence !== undefined)
    string(item.confidence, `${name}.confidence`)
}

function validateAnnotation(value: unknown, index: number): AnnotationDocument {
  const name = `annotations[${index}]`
  const item = object(value, name)
  exactKeys(
    item,
    name,
    [
      'id',
      'schemaVersion',
      'projectId',
      'taskId',
      'taxonomyVersionId',
      'revision',
      'regions',
      'clipAssignments',
      'createdAt',
      'updatedAt',
    ],
    ['taskNotes', 'submittedAt'],
  )
  schemaVersion(item.schemaVersion, ANNOTATION_SCHEMA_VERSION, 'Annotation')
  string(item.id, `${name}.id`)
  string(item.projectId, `${name}.projectId`)
  string(item.taskId, `${name}.taskId`)
  string(item.taxonomyVersionId, `${name}.taxonomyVersionId`)
  nonNegativeInteger(item.revision, `${name}.revision`)
  const regions = array(item.regions, `${name}.regions`)
  const regionIds = new Set<string>()
  regions.forEach((value, regionIndex) => {
    const regionName = `${name}.regions[${regionIndex}]`
    const region = object(value, regionName)
    exactKeys(
      region,
      regionName,
      ['id', 'start', 'end', 'assignments'],
      ['notes'],
    )
    const id = string(region.id, `${regionName}.id`)
    if (regionIds.has(id)) fail(`${name} contains duplicate region id "${id}".`)
    regionIds.add(id)
    const start = finiteNumber(region.start, `${regionName}.start`)
    const end = finiteNumber(region.end, `${regionName}.end`)
    if (start < 0 || end <= start) fail(`${regionName} has invalid timing.`)
    const assignments = array(region.assignments, `${regionName}.assignments`)
    assignments.forEach((assignment, assignmentIndex) =>
      validateAssignment(
        assignment,
        `${regionName}.assignments[${assignmentIndex}]`,
      ),
    )
    if (region.notes !== undefined)
      string(region.notes, `${regionName}.notes`, true)
  })
  array(item.clipAssignments, `${name}.clipAssignments`).forEach(
    (assignment, assignmentIndex) =>
      validateAssignment(
        assignment,
        `${name}.clipAssignments[${assignmentIndex}]`,
      ),
  )
  if (item.taskNotes !== undefined)
    string(item.taskNotes, `${name}.taskNotes`, true)
  isoDate(item.createdAt, `${name}.createdAt`)
  isoDate(item.updatedAt, `${name}.updatedAt`)
  if (item.submittedAt !== undefined)
    isoDate(item.submittedAt, `${name}.submittedAt`)
  return item as unknown as AnnotationDocument
}

function uniqueIds<T extends { id: string }>(items: T[], name: string): void {
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.id)) fail(`${name} contains duplicate id "${item.id}".`)
    ids.add(item.id)
  }
}

function validateRelationships(records: ProjectBackupRecords): void {
  const { project, taxonomyVersions, instructions, tasks, annotations } =
    records
  uniqueIds(taxonomyVersions, 'taxonomyVersions')
  uniqueIds(tasks, 'tasks')
  uniqueIds(annotations, 'annotations')
  const allIds = [
    project.id,
    ...taxonomyVersions.map(({ id }) => id),
    ...(instructions ? [instructions.id] : []),
    ...tasks.map(({ id }) => id),
    ...annotations.map(({ id }) => id),
  ]
  if (new Set(allIds).size !== allIds.length) {
    fail('entity IDs must be unique across the backup.')
  }
  const taxonomyIds = new Set(taxonomyVersions.map(({ id }) => id))
  if (!taxonomyIds.has(project.activeTaxonomyVersionId)) {
    fail('the active taxonomy version is missing.')
  }
  const taxonomyNumbers = new Set<number>()
  const parsedTaxonomies = new Map<
    string,
    ReturnType<typeof parseAnnotationTaxonomy>
  >()
  for (const taxonomy of taxonomyVersions) {
    if (taxonomy.projectId !== project.id)
      fail(`taxonomy "${taxonomy.id}" references another project.`)
    if (taxonomyNumbers.has(taxonomy.version))
      fail(`taxonomy version number ${taxonomy.version} is duplicated.`)
    taxonomyNumbers.add(taxonomy.version)
    try {
      parsedTaxonomies.set(
        taxonomy.id,
        parseAnnotationTaxonomy(taxonomy.document),
      )
    } catch {
      fail(`taxonomy "${taxonomy.id}" is not annotation-capable.`)
    }
  }
  if (Boolean(project.instructionsId) !== Boolean(instructions)) {
    fail('the project instructions reference does not match the backup.')
  }
  if (
    instructions &&
    (instructions.projectId !== project.id ||
      instructions.id !== project.instructionsId)
  ) {
    fail('instructions reference another project or ID.')
  }
  const taskIds = new Set<string>()
  for (const task of tasks) {
    if (task.projectId !== project.id)
      fail(`task "${task.id}" references another project.`)
    taskIds.add(task.id)
  }
  const annotationTasks = new Set<string>()
  for (const annotation of annotations) {
    if (annotation.projectId !== project.id)
      fail(`annotation "${annotation.id}" references another project.`)
    if (!taskIds.has(annotation.taskId))
      fail(`annotation "${annotation.id}" references a missing task.`)
    if (annotationTasks.has(annotation.taskId))
      fail(`multiple annotations reference task "${annotation.taskId}".`)
    annotationTasks.add(annotation.taskId)
    const taxonomy = parsedTaxonomies.get(annotation.taxonomyVersionId)
    if (!taxonomy)
      fail(`annotation "${annotation.id}" references a missing taxonomy.`)
    const labels = new Map(taxonomy.labels.map((label) => [label.id, label]))
    for (const region of annotation.regions) {
      for (const assignment of region.assignments) {
        const label = labels.get(assignment.labelId)
        if (!label || !label.scopes.includes('region')) {
          fail(
            `annotation "${annotation.id}" has an invalid region label reference.`,
          )
        }
      }
    }
    for (const assignment of annotation.clipAssignments) {
      const label = labels.get(assignment.labelId)
      if (!label || !label.scopes.includes('clip')) {
        fail(
          `annotation "${annotation.id}" has an invalid clip label reference.`,
        )
      }
    }
  }
}

function portableTask(task: TaskRecord): TaskRecord {
  const relativePath = task.relativePath
    ? normalizeRelativePath(task.relativePath)
    : undefined
  const basename = (value: string) =>
    value.replaceAll('\\', '/').split('/').at(-1) || 'Audio task'
  const displayName =
    (task.displayName ? basename(task.displayName) : undefined) ??
    relativePath?.split('/').at(-1) ??
    (task.sourceIdentity?.kind === 'direct-file'
      ? basename(task.sourceIdentity.filename)
      : basename(task.primaryMedia.displayName))
  const sourceIdentity =
    task.sourceIdentity?.kind === 'direct-file'
      ? {
          kind: 'direct-file' as const,
          filename: basename(task.sourceIdentity.filename),
          size: task.sourceIdentity.size,
        }
      : task.sourceIdentity?.kind === 'manifest'
        ? {
            kind: 'manifest' as const,
            relativePath: normalizeRelativePath(
              task.sourceIdentity.relativePath,
            ),
          }
        : undefined
  return {
    ...task,
    ...(relativePath ? { relativePath } : {}),
    displayName,
    ...(sourceIdentity ? { sourceIdentity } : {}),
    primaryMedia: {
      kind: 'unresolved',
      displayName,
      reason: 'not-yet-linked',
    },
  }
}

export function createProjectBackup(
  records: ProjectBackupRecords,
  exportedAt = new Date().toISOString(),
): ProjectBackup {
  const tasks = orderedTasks(records.tasks).map(portableTask)
  const taskOrder = new Map(tasks.map((task, index) => [task.id, index]))
  const backup: ProjectBackup = {
    format: PROJECT_BACKUP_FORMAT,
    formatVersion: PROJECT_BACKUP_FORMAT_VERSION,
    exportedAt,
    project: records.project,
    taxonomyVersions: [...records.taxonomyVersions].sort(
      (left, right) =>
        left.version - right.version || left.id.localeCompare(right.id),
    ),
    instructions: records.instructions,
    tasks,
    annotations: [...records.annotations].sort(
      (left, right) =>
        (taskOrder.get(left.taskId) ?? Number.MAX_SAFE_INTEGER) -
          (taskOrder.get(right.taskId) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    ),
  }
  validateRelationships(backup)
  return backup
}

export function serializeProjectBackup(backup: ProjectBackup): string {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as JsonRecord)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonicalize(entry)]),
      )
    }
    return value
  }
  return `${JSON.stringify(canonicalize(backup), null, 2)}\n`
}

export function parseProjectBackup(source: string): ProjectBackup {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }
  const envelope = object(value, 'backup')
  exactKeys(envelope, 'backup', [
    'format',
    'formatVersion',
    'exportedAt',
    'project',
    'taxonomyVersions',
    'instructions',
    'tasks',
    'annotations',
  ])
  if (envelope.format !== PROJECT_BACKUP_FORMAT) {
    fail('the file is not an Audio Annotation Workbench project backup.')
  }
  if (envelope.formatVersion !== PROJECT_BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Unsupported project backup version ${String(envelope.formatVersion)}.`,
    )
  }
  const backup: ProjectBackup = {
    format: PROJECT_BACKUP_FORMAT,
    formatVersion: PROJECT_BACKUP_FORMAT_VERSION,
    exportedAt: isoDate(envelope.exportedAt, 'backup.exportedAt'),
    project: validateProject(envelope.project),
    taxonomyVersions: array(
      envelope.taxonomyVersions,
      'backup.taxonomyVersions',
    ).map(validateTaxonomy),
    instructions: validateInstructions(envelope.instructions),
    tasks: array(envelope.tasks, 'backup.tasks').map(validateTask),
    annotations: array(envelope.annotations, 'backup.annotations').map(
      validateAnnotation,
    ),
  }
  validateRelationships(backup)
  return backup
}

export function safeExportFilename(
  projectName: string,
  suffix: string,
): string {
  const base =
    projectName
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .replace(/-+/g, '-')
      .slice(0, 80)
      .toLowerCase() || 'project'
  return `${base}-${suffix}`
}

export function backupRecordCounts(backup: ProjectBackup) {
  return {
    taxonomyVersions: backup.taxonomyVersions.length,
    instructions: backup.instructions ? 1 : 0,
    tasks: backup.tasks.length,
    annotations: backup.annotations.length,
  }
}

export function mediaRelinkCount(backup: ProjectBackup): number {
  return backup.tasks.length
}
