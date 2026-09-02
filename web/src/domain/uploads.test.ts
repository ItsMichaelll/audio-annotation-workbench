import { describe, expect, it } from 'vitest'
import {
  hashText,
  prepareInstructionsSource,
  prepareTaxonomySource,
  parseTaxonomySource,
  prepareTaxonomyFile,
  UploadValidationError,
} from './uploads'

describe('taxonomy uploads', () => {
  it('parses JSON and extracts optional metadata', () => {
    const taxonomy = parseTaxonomySource(
      '{"name":"Quality labels","schema_version":2,"labels":[]}',
      'taxonomy.json',
    )

    expect(taxonomy.sourceFormat).toBe('json')
    expect(taxonomy.metadata).toEqual({
      name: 'Quality labels',
      schemaVersion: '2',
    })
    expect(taxonomy.document.labels).toEqual([])
  })

  it('parses YAML using the core schema', () => {
    const taxonomy = parseTaxonomySource(
      'name: Review labels\nschema_version: "1.2"\nlabels:\n  - clear\n',
      'taxonomy.yml',
    )

    expect(taxonomy.sourceFormat).toBe('yaml')
    expect(taxonomy.metadata.name).toBe('Review labels')
    expect(taxonomy.document.labels).toEqual(['clear'])
  })

  it('rejects syntax errors, arrays, duplicate keys, and extensions', () => {
    expect(() => parseTaxonomySource('{broken', 'taxonomy.json')).toThrow(
      UploadValidationError,
    )
    expect(() => parseTaxonomySource('- one\n- two', 'taxonomy.yaml')).toThrow(
      'root must be an object',
    )
    expect(() =>
      parseTaxonomySource('name: one\nname: two', 'taxonomy.yaml'),
    ).toThrow(UploadValidationError)
    expect(() => parseTaxonomySource('{}', 'taxonomy.txt')).toThrow(
      'must use the .json, .yaml, or .yml extension',
    )
  })

  it('calculates deterministic SHA-256 hashes', async () => {
    const first = await hashText('generic taxonomy')
    const second = await hashText('generic taxonomy')
    const changed = await hashText('changed taxonomy')

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(changed).not.toBe(first)
  })

  it('gives annotation-schema feedback for newly uploaded taxonomies', async () => {
    const file = new File(['schemaVersion: 1\nlabels: []\n'], 'taxonomy.yaml', {
      type: 'text/yaml',
    })
    await expect(prepareTaxonomyFile(file)).rejects.toThrow(
      'labels must be a non-empty array',
    )
  })

  it('hashes validated taxonomy content independently of YAML formatting', async () => {
    const compact = await prepareTaxonomySource(
      'schemaVersion: 1\nlabels: [{id: noise, name: Noise}]\n',
    )
    const expanded = await prepareTaxonomySource(
      'schemaVersion: 1\nlabels:\n  - id: noise\n    name: Noise\n',
    )
    expect(compact.contentHash).toBe(expanded.contentHash)
  })

  it('validates editor-authored instructions with upload size rules', () => {
    expect(prepareInstructionsSource('# Guide')).toEqual({
      sourceFilename: 'instructions.md',
      rawMarkdown: '# Guide',
    })
    expect(() => prepareInstructionsSource('x'.repeat(512 * 1024 + 1))).toThrow(
      '512 KB or smaller',
    )
  })
})
