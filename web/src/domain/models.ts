export const PROJECT_SCHEMA_VERSION = 1 as const
export const TAXONOMY_RECORD_SCHEMA_VERSION = 1 as const
export const INSTRUCTIONS_SCHEMA_VERSION = 1 as const
export const TASK_SCHEMA_VERSION = 1 as const

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
  'in-progress',
  'submitted',
  'skipped',
  'blocked',
  'reopened',
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export type MediaPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown'

export type MediaSourceReference =
  | {
      kind: 'file-handle'
      handleId: string
      displayName: string
      relativePath?: string
      permission: MediaPermissionState
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
  primaryMedia: MediaSourceReference
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
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
}
