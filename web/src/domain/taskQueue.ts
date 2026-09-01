import type { TaskRecord } from './models'

export const ACTIONABLE_STATUSES = ['unstarted', 'draft', 'reopened'] as const

export function isActionableTask(task: TaskRecord): boolean {
  return ACTIONABLE_STATUSES.includes(
    task.status as (typeof ACTIONABLE_STATUSES)[number],
  )
}

export function orderedTasks(tasks: readonly TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((left, right) => {
    if (left.importOrder !== undefined && right.importOrder !== undefined) {
      const order = left.importOrder - right.importOrder
      if (order) return order
    }
    return (
      left.createdAt.localeCompare(right.createdAt) ||
      (left.relativePath ?? left.displayName ?? left.id).localeCompare(
        right.relativePath ?? right.displayName ?? right.id,
      ) ||
      left.id.localeCompare(right.id)
    )
  })
}

export function nextActionableTask(
  tasks: readonly TaskRecord[],
  afterTaskId?: string,
): TaskRecord | null {
  const ordered = orderedTasks(tasks)
  if (!afterTaskId) return ordered.find(isActionableTask) ?? null
  const index = ordered.findIndex((task) => task.id === afterTaskId)
  if (index < 0) return ordered.find(isActionableTask) ?? null
  return (
    ordered.slice(index + 1).find(isActionableTask) ??
    ordered.slice(0, index).find(isActionableTask) ??
    null
  )
}

export function nextActionableTaskAfterTransition(
  tasks: readonly TaskRecord[],
  taskId: string,
  status: TaskRecord['status'],
): TaskRecord | null {
  return nextActionableTask(
    tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    taskId,
  )
}
