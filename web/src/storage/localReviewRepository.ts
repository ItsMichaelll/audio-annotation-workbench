import { openDB, type DBSchema } from 'idb'
import {
  emptyLocalReview,
  parseLocalProposals,
  type LocalReviewSession,
} from '../domain/localReview'

interface ReviewDatabase extends DBSchema {
  sessions: { key: string; value: LocalReviewSession }
}

const NAME = 'audio-annotation-workbench-review'

async function database(name: string) {
  return openDB<ReviewDatabase>(name, 1, {
    upgrade(db) {
      db.createObjectStore('sessions', { keyPath: 'sourceIdentity' })
    },
  })
}

export async function loadLocalReview(
  sourceIdentity: string,
  duration: number,
  name = NAME,
): Promise<LocalReviewSession> {
  const db = await database(name)
  try {
    const stored = await db.get('sessions', sourceIdentity)
    if (!stored || stored.schemaVersion !== 1 || stored.duration !== duration)
      return emptyLocalReview(sourceIdentity, duration)
    parseLocalProposals(JSON.stringify(stored), sourceIdentity, duration)
    return stored
  } finally {
    db.close()
  }
}

export async function saveLocalReview(
  session: LocalReviewSession,
  name = NAME,
): Promise<void> {
  const db = await database(name)
  try {
    await db.put('sessions', session)
  } finally {
    db.close()
  }
}
