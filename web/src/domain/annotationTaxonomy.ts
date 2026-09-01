export type AnnotationScope = 'region' | 'clip'

export interface AnnotationLabel {
  id: string
  name: string
  description?: string
  scopes: AnnotationScope[]
  color?: string
  shortcut?: string
}

export interface AnnotationScaleOption {
  value: string
  label: string
}

export interface AnnotationScale {
  required: boolean
  options: AnnotationScaleOption[]
}

export interface AnnotationTaxonomy {
  schemaVersion: 1
  labels: AnnotationLabel[]
  scales: {
    severity?: AnnotationScale
    confidence?: AnnotationScale
  }
}

export class AnnotationTaxonomyError extends Error {
  constructor(readonly issues: string[]) {
    super(`Taxonomy is not annotation-capable: ${issues.join(' ')}`)
    this.name = 'AnnotationTaxonomyError'
  }
}

const RESERVED_SHORTCUTS = new Set([
  ' ',
  'arrowleft',
  'arrowright',
  'a',
  'd',
  'home',
  'end',
  'f',
  '+',
  '=',
  '-',
  '_',
  'l',
  'delete',
  'backspace',
  'escape',
])

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseScale(
  value: unknown,
  name: 'severity' | 'confidence',
  issues: string[],
): AnnotationScale | undefined {
  if (value === undefined) return undefined
  const source = record(value)
  if (!source) {
    issues.push(`The ${name} scale must be an object.`)
    return undefined
  }
  if (source.required !== undefined && typeof source.required !== 'boolean') {
    issues.push(`${name}.required must be true or false.`)
  }
  if (!Array.isArray(source.options) || source.options.length === 0) {
    issues.push(`${name}.options must be a non-empty array.`)
    return undefined
  }
  const seen = new Set<string>()
  const options: AnnotationScaleOption[] = []
  source.options.forEach((rawOption, index) => {
    const option = record(rawOption)
    const stableValue = nonEmptyString(option?.value)
    const label = nonEmptyString(option?.label)
    if (!stableValue || !label) {
      issues.push(
        `${name}.options[${index}] requires non-empty value and label.`,
      )
      return
    }
    if (seen.has(stableValue)) {
      issues.push(`${name} contains duplicate option value "${stableValue}".`)
      return
    }
    seen.add(stableValue)
    options.push({ value: stableValue, label })
  })
  return { required: source.required === true, options }
}

export function parseAnnotationTaxonomy(
  document: Record<string, unknown>,
): AnnotationTaxonomy {
  const issues: string[] = []
  if (document.schemaVersion !== 1) {
    issues.push('schemaVersion must be 1.')
  }
  if (!Array.isArray(document.labels) || document.labels.length === 0) {
    issues.push('labels must be a non-empty array.')
  }
  const labels: AnnotationLabel[] = []
  const ids = new Set<string>()
  const shortcuts = new Map<string, string>()
  if (Array.isArray(document.labels)) {
    document.labels.forEach((rawLabel, index) => {
      const source = record(rawLabel)
      const id = nonEmptyString(source?.id)
      const name = nonEmptyString(source?.name)
      if (!source || !id || !name) {
        issues.push(`labels[${index}] requires a stable id and non-empty name.`)
        return
      }
      if (ids.has(id)) issues.push(`Duplicate label id "${id}".`)
      ids.add(id)
      let scopes: AnnotationScope[] = ['region']
      if (source.scopes !== undefined) {
        if (
          !Array.isArray(source.scopes) ||
          source.scopes.length === 0 ||
          source.scopes.some((scope) => scope !== 'region' && scope !== 'clip')
        ) {
          issues.push(
            `Label "${id}" scopes must contain region, clip, or both.`,
          )
          scopes = []
        } else {
          scopes = [...new Set(source.scopes)] as AnnotationScope[]
        }
      }
      const color = nonEmptyString(source.color)
      if (
        source.color !== undefined &&
        (!color || !/^#[0-9a-f]{6}$/i.test(color))
      ) {
        issues.push(`Label "${id}" color must be a six-digit hex color.`)
      }
      const shortcut = nonEmptyString(source.shortcut)
      if (
        source.shortcut !== undefined &&
        (!shortcut || shortcut.length !== 1)
      ) {
        issues.push(`Label "${id}" shortcut must be one character.`)
      } else if (shortcut) {
        const normalized = shortcut.toLowerCase()
        if (RESERVED_SHORTCUTS.has(normalized)) {
          issues.push(
            `Label "${id}" shortcut "${shortcut}" conflicts with an editor command.`,
          )
        } else if (shortcuts.has(normalized)) {
          issues.push(
            `Labels "${shortcuts.get(normalized)}" and "${id}" share shortcut "${shortcut}".`,
          )
        } else shortcuts.set(normalized, id)
      }
      labels.push({
        id,
        name,
        scopes,
        ...(nonEmptyString(source.description)
          ? { description: nonEmptyString(source.description)! }
          : {}),
        ...(color && /^#[0-9a-f]{6}$/i.test(color) ? { color } : {}),
        ...(shortcut && shortcut.length === 1 ? { shortcut } : {}),
      })
    })
  }
  const scalesSource =
    document.scales === undefined ? null : record(document.scales)
  if (document.scales !== undefined && !scalesSource) {
    issues.push('scales must be an object when supplied.')
  }
  for (const scaleName of Object.keys(scalesSource ?? {})) {
    if (scaleName !== 'severity' && scaleName !== 'confidence') {
      issues.push(
        `Unsupported scale "${scaleName}". Use severity or confidence.`,
      )
    }
  }
  const severity = parseScale(scalesSource?.severity, 'severity', issues)
  const confidence = parseScale(scalesSource?.confidence, 'confidence', issues)
  if (issues.length) throw new AnnotationTaxonomyError(issues)
  return {
    schemaVersion: 1,
    labels,
    scales: {
      ...(severity ? { severity } : {}),
      ...(confidence ? { confidence } : {}),
    },
  }
}
