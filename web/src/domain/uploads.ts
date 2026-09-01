import { parseDocument } from 'yaml'
import type { TaxonomyMetadata, TaxonomySourceFormat } from './models'
import { parseAnnotationTaxonomy } from './annotationTaxonomy'

export const TAXONOMY_FILE_SIZE_LIMIT = 1024 * 1024
export const INSTRUCTIONS_FILE_SIZE_LIMIT = 512 * 1024

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadValidationError'
  }
}

export interface PreparedTaxonomy {
  sourceFilename: string
  sourceFormat: TaxonomySourceFormat
  rawSource: string
  document: Record<string, unknown>
  metadata: TaxonomyMetadata
  contentHash: string
}

export interface PreparedInstructions {
  sourceFilename: string
  rawMarkdown: string
}

function extensionOf(filename: string): string {
  const period = filename.lastIndexOf('.')
  return period >= 0 ? filename.slice(period).toLowerCase() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function taxonomyFormat(filename: string): TaxonomySourceFormat {
  const extension = extensionOf(filename)
  if (extension === '.json') return 'json'
  if (extension === '.yaml' || extension === '.yml') return 'yaml'
  throw new UploadValidationError(
    'Taxonomy files must use the .json, .yaml, or .yml extension.',
  )
}

function stringMetadataValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

export function parseTaxonomySource(
  rawSource: string,
  filename: string,
): Omit<PreparedTaxonomy, 'contentHash'> {
  const sourceFormat = taxonomyFormat(filename)
  let parsed: unknown

  if (sourceFormat === 'json') {
    try {
      parsed = JSON.parse(rawSource) as unknown
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Invalid JSON.'
      throw new UploadValidationError(`Invalid taxonomy JSON: ${detail}`)
    }
  } else {
    const document = parseDocument(rawSource, {
      merge: false,
      schema: 'core',
      uniqueKeys: true,
    })
    if (document.errors.length > 0) {
      throw new UploadValidationError(
        `Invalid taxonomy YAML: ${document.errors[0]?.message ?? 'Syntax error.'}`,
      )
    }
    try {
      parsed = document.toJS({ maxAliasCount: 0 }) as unknown
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Invalid YAML.'
      throw new UploadValidationError(`Invalid taxonomy YAML: ${detail}`)
    }
  }

  if (!isRecord(parsed)) {
    throw new UploadValidationError('The taxonomy root must be an object.')
  }

  const name = stringMetadataValue(parsed.name)
  const schemaVersion = stringMetadataValue(
    parsed.schema_version ?? parsed.schemaVersion,
  )
  const metadata: TaxonomyMetadata = {}
  if (name) metadata.name = name
  if (schemaVersion) metadata.schemaVersion = schemaVersion

  return {
    sourceFilename: filename,
    sourceFormat,
    rawSource,
    document: parsed,
    metadata,
  }
}

export async function hashText(source: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new UploadValidationError(
      'This browser cannot calculate the required taxonomy content hash.',
    )
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function prepareTaxonomyFile(
  file: File,
): Promise<PreparedTaxonomy> {
  taxonomyFormat(file.name)
  if (file.size > TAXONOMY_FILE_SIZE_LIMIT) {
    throw new UploadValidationError(
      `Taxonomy files must be ${TAXONOMY_FILE_SIZE_LIMIT / 1024} KB or smaller.`,
    )
  }
  const rawSource = await file.text()
  const parsed = parseTaxonomySource(rawSource, file.name)
  try {
    parseAnnotationTaxonomy(parsed.document)
  } catch (error) {
    throw new UploadValidationError(
      error instanceof Error ? error.message : 'Invalid annotation taxonomy.',
    )
  }
  return { ...parsed, contentHash: await hashText(rawSource) }
}

export async function prepareInstructionsFile(
  file: File,
): Promise<PreparedInstructions> {
  if (extensionOf(file.name) !== '.md') {
    throw new UploadValidationError(
      'Instruction files must use the .md extension.',
    )
  }
  if (file.size > INSTRUCTIONS_FILE_SIZE_LIMIT) {
    throw new UploadValidationError(
      `Instruction files must be ${INSTRUCTIONS_FILE_SIZE_LIMIT / 1024} KB or smaller.`,
    )
  }
  return { sourceFilename: file.name, rawMarkdown: await file.text() }
}
