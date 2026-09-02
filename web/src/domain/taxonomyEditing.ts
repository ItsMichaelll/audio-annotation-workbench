import { stringify } from 'yaml'
import {
  parseAnnotationTaxonomy,
  type AnnotationTaxonomy,
} from './annotationTaxonomy'
import { parseTaxonomySource } from './uploads'

export interface TaxonomyEditorSnapshot {
  rawSource: string
  document: Record<string, unknown>
  taxonomy: AnnotationTaxonomy
}

export const STRUCTURED_CANONICALIZATION_WARNING =
  'Structured editing rewrites the YAML in canonical form and removes comments, formatting, and fields the current schema does not recognize. Continue?'

export function parseTaxonomyEditorSource(
  rawSource: string,
): TaxonomyEditorSnapshot {
  const parsed = parseTaxonomySource(rawSource, 'taxonomy.yaml')
  return {
    rawSource,
    document: parsed.document,
    taxonomy: parseAnnotationTaxonomy(parsed.document),
  }
}

export function serializeStructuredTaxonomy(
  taxonomy: AnnotationTaxonomy,
): string {
  return stringify(taxonomy, { lineWidth: 0 })
}

export function applyStructuredTaxonomy(
  taxonomy: AnnotationTaxonomy,
): TaxonomyEditorSnapshot {
  return parseTaxonomyEditorSource(serializeStructuredTaxonomy(taxonomy))
}

export function nextAvailableIdentifier(
  base: string,
  existing: readonly string[],
): string {
  const used = new Set(existing)
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

export function replaceEntry<T>(
  entries: readonly T[],
  index: number,
  update: (entry: T) => T,
): T[] {
  return entries.map((entry, entryIndex) =>
    entryIndex === index ? update(entry) : entry,
  )
}

export function removeEntry<T>(entries: readonly T[], index: number): T[] {
  return entries.filter((_, entryIndex) => entryIndex !== index)
}

export function moveEntry<T>(
  entries: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  return reorderEntry(entries, index, index + direction)
}

export function reorderEntry<T>(
  entries: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= entries.length ||
    toIndex < 0 ||
    toIndex >= entries.length ||
    fromIndex === toIndex
  ) {
    return [...entries]
  }
  const reordered = [...entries]
  const [entry] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, entry!)
  return reordered
}
