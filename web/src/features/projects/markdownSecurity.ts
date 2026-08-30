import { defaultUrlTransform } from 'react-markdown'

export function safeMarkdownUrl(url: string): string {
  const normalized = url.trim()
  if (normalized.startsWith('#')) return normalized
  try {
    const parsed = new URL(normalized)
    if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
      return defaultUrlTransform(normalized)
    }
  } catch {
    return ''
  }
  return ''
}
