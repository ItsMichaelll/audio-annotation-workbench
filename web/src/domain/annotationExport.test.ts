import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  TAXONOMY_RECORD_SCHEMA_VERSION,
  type AnnotationDocument,
  type TaskRecord,
  type TaxonomyVersion,
} from './models'
import {
  buildAnnotationCsvRows,
  buildAnnotationJsonlRecords,
  escapeCsvField,
  serializeAnnotationCsv,
  serializeAnnotationJsonl,
  type AnnotationExportSource,
} from './annotationExport'

const NOW = '2026-09-01T00:00:00.000Z'
const taxonomy: TaxonomyVersion = {
  id: 'tax-1',
  schemaVersion: TAXONOMY_RECORD_SCHEMA_VERSION,
  projectId: 'project-1',
  version: 2,
  sourceFilename: 'taxonomy.json',
  sourceFormat: 'json',
  rawSource: '{}',
  document: {
    schemaVersion: 1,
    labels: [
      { id: 'noise', name: 'Noise', scopes: ['region'] },
      { id: 'quality', name: 'Quality', scopes: ['clip'] },
    ],
  },
  metadata: { schemaVersion: '1' },
  contentHash: 'a'.repeat(64),
  createdAt: NOW,
}

function task(id: string, status: TaskRecord['status'], order: number) {
  return {
    id,
    schemaVersion: TASK_SCHEMA_VERSION,
    projectId: 'project-1',
    status,
    displayName: `${id}, "voice".wav`,
    relativePath: `audio/${id}.wav`,
    primaryMedia: {
      kind: 'unresolved' as const,
      displayName: `${id}.wav`,
      reason: 'not-yet-linked' as const,
    },
    metadata: { z: 1, a: 'line\nbreak' },
    importOrder: order,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

const submitted: AnnotationDocument = {
  id: 'annotation-1',
  schemaVersion: ANNOTATION_SCHEMA_VERSION,
  projectId: 'project-1',
  taskId: 'submitted',
  taxonomyVersionId: taxonomy.id,
  revision: 4,
  regions: [
    {
      id: 'region-1',
      start: 1.25,
      end: 2.5,
      assignments: [
        { labelId: 'noise', severity: 'high', confidence: 'certain' },
      ],
      notes: 'comma, quote " and\nnewline',
    },
  ],
  clipAssignments: [{ labelId: 'quality' }],
  taskNotes: 'task notes',
  createdAt: NOW,
  updatedAt: NOW,
  submittedAt: NOW,
}

const source: AnnotationExportSource = {
  project: { id: 'project-1', name: 'Voice Review' },
  taxonomyVersions: [taxonomy],
  tasks: [task('empty', 'unstarted', 2), task('submitted', 'submitted', 1)],
  annotations: [submitted],
}

describe('annotation export', () => {
  it('filters submitted mode and includes null annotations in all-task JSONL', () => {
    expect(buildAnnotationJsonlRecords(source, 'submitted')).toHaveLength(1)
    const all = buildAnnotationJsonlRecords(source, 'all')
    expect(all.map(({ task }) => task.id)).toEqual(['submitted', 'empty'])
    expect(all.at(1)?.annotation).toBeNull()
    expect(all.at(0)?.pinnedTaxonomy?.id).toBe(taxonomy.id)
    expect(
      serializeAnnotationJsonl(source, 'all').trim().split('\n'),
    ).toHaveLength(2)
  })

  it('flattens region and clip assignments and preserves task-only rows', () => {
    const rows = buildAnnotationCsvRows(source, 'all')
    expect(rows.map(({ scope }) => scope)).toEqual(['region', 'clip', 'task'])
    expect(rows.at(0)).toMatchObject({
      region_id: 'region-1',
      region_start: '1.25',
      region_end: '2.5',
      region_duration: '1.25',
      label_id: 'noise',
      label_name: 'Noise',
    })
    expect(rows.at(1)?.region_start).toBe('')
    expect(rows.at(2)?.annotation_id).toBe('')
  })

  it('escapes CSV delimiters, quotes, carriage returns, and newlines', () => {
    expect(escapeCsvField('plain')).toBe('plain')
    expect(escapeCsvField('a,b')).toBe('"a,b"')
    expect(escapeCsvField('a"b')).toBe('"a""b"')
    expect(escapeCsvField('a\r\nb')).toBe('"a\r\nb"')
    const csv = serializeAnnotationCsv(source, 'all')
    expect(csv).toContain('"submitted, ""voice"".wav"')
    expect(csv).toContain('"comma, quote "" and\nnewline"')
  })
})
