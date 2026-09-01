export const PROJECT_SCHEMA_VERSION = 1 as const
export const TAXONOMY_RECORD_SCHEMA_VERSION = 1 as const
export const INSTRUCTIONS_SCHEMA_VERSION = 1 as const
export const TASK_SCHEMA_VERSION = 1 as const
export const ANNOTATION_SCHEMA_VERSION = 1 as const

export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: string
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  name: string
  description?: string
  status: ProjectStatus
  activeTaxonomyVersionId: string
  instructionsId?: string
  createdAt: string
  updatedAt: string
}

export type TaxonomySourceFormat = 'json' | 'yaml'

export interface TaxonomyMetadata {
  name?: string
  schemaVersion?: string
}

export interface TaxonomyVersion {
  id: string
  schemaVersion: typeof TAXONOMY_RECORD_SCHEMA_VERSION
  projectId: string
  taxonomySchemaVersion?: string
  version: number
  sourceFilename: string
  sourceFormat: TaxonomySourceFormat
  rawSource: string
  document: Record<string, unknown>
  metadata: TaxonomyMetadata
  contentHash: string
  createdAt: string
}

export interface ProjectInstructions {
  id: string
  schemaVersion: typeof INSTRUCTIONS_SCHEMA_VERSION
  projectId: string
  sourceFilename: string
  rawMarkdown: string
  createdAt: string
  updatedAt: string
}

export const TASK_STATUSES = [
  'unstarted',
  'draft',
  'submitted',
  'skipped',
  'blocked',
  'reopened',
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export type MediaPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown'

export type TaskSourceIdentity =
  | { kind: 'direct-file'; filename: string; size: number }
  | { kind: 'manifest'; relativePath: string }

export type MediaSourceReference =
  | {
      kind: 'file-handle'
      handleId: string
      displayName: string
      relativePath?: string
      permission: MediaPermissionState
      handle?: FileSystemFileHandle
    }
  | {
      kind: 'external-reference'
      locator: string
      displayName: string
      permission: MediaPermissionState
    }
  | {
      kind: 'unresolved'
      displayName: string
      reason: 'missing' | 'moved' | 'permission-denied' | 'not-yet-linked'
    }

export interface TaskRecord {
  id: string
  schemaVersion: typeof TASK_SCHEMA_VERSION
  projectId: string
  status: TaskStatus
  externalId?: string
  displayName?: string
  relativePath?: string
  primaryMedia: MediaSourceReference
  /** Persisted identity used to verify user-selected relinking files. */
  sourceIdentity?: TaskSourceIdentity
  metadata: Record<string, unknown>
  /** Stable persisted import position. Older records use a deterministic fallback. */
  importOrder?: number
  createdAt: string
  updatedAt: string
}

export interface LabelAssignment {
  labelId: string
  severity?: string
  confidence?: string
}

export interface RegionAnnotation {
  id: string
  start: number
  end: number
  assignments: LabelAssignment[]
  notes?: string
}

export interface AnnotationDocument {
  id: string
  schemaVersion: typeof ANNOTATION_SCHEMA_VERSION
  projectId: string
  taskId: string
  taxonomyVersionId: string
  revision: number
  regions: RegionAnnotation[]
  clipAssignments: LabelAssignment[]
  taskNotes?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
}

export interface TaskProgress {
  total: number
  unstarted: number
  inProgress: number
  submitted: number
  skipped: number
  blocked: number
  reopened: number
  completed: number
}

export interface ProjectSummary {
  project: Project
  activeTaxonomyVersion: TaxonomyVersion
  progress: TaskProgress
}

export interface ProjectAggregate extends ProjectSummary {
  taxonomyVersions: TaxonomyVersion[]
  instructions: ProjectInstructions | null
  tasks: TaskRecord[]
}
