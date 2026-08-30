export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function truncateDescription(description: string, length = 150): string {
  return description.length > length
    ? `${description.slice(0, length - 1).trimEnd()}…`
    : description
}
