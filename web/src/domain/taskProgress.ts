import type { TaskProgress, TaskRecord } from './models'

export function deriveTaskProgress(tasks: readonly TaskRecord[]): TaskProgress {
  const progress: TaskProgress = {
    total: tasks.length,
    unstarted: 0,
    inProgress: 0,
    submitted: 0,
    skipped: 0,
    blocked: 0,
    reopened: 0,
    completed: 0,
  }

  for (const task of tasks) {
    switch (task.status) {
      case 'unstarted':
        progress.unstarted += 1
        break
      case 'in-progress':
        progress.inProgress += 1
        break
      case 'submitted':
        progress.submitted += 1
        progress.completed += 1
        break
      case 'skipped':
        progress.skipped += 1
        progress.completed += 1
        break
      case 'blocked':
        progress.blocked += 1
        break
      case 'reopened':
        progress.reopened += 1
        break
    }
  }

  return progress
}
