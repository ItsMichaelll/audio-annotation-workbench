import { openDB, type DBSchema } from 'idb'
import type { ListeningRange } from '../domain/listeningNormalization'

export interface ListeningPreference {
  sourceIdentity: string
  sampleRate: number
  frames: number
  channels: number
  ranges: ListeningRange[]
  measuredLufs: number
  targetLufs: number
}

interface ListeningDatabase extends DBSchema {
  references: { key: string; value: ListeningPreference }
}

const DATABASE_NAME = 'audio-annotation-workbench-listening'

async function openListeningDatabase(name: string) {
  return openDB<ListeningDatabase>(name, 1, {
    upgrade(database) {
      database.createObjectStore('references', { keyPath: 'sourceIdentity' })
    },
  })
}

/** Playback preferences are separate from annotation/export records and contain no media bytes. */
export async function loadListeningPreference(
  sourceIdentity: string,
  audio: { sampleRate: number; length: number; numberOfChannels: number },
  databaseName = DATABASE_NAME,
): Promise<ListeningPreference | null> {
  const database = await openListeningDatabase(databaseName)
  try {
    const record = await database.get('references', sourceIdentity)
    if (
      !record ||
      record.sampleRate !== audio.sampleRate ||
      record.frames !== audio.length ||
      record.channels !== audio.numberOfChannels
    )
      return null
    return record
  } finally {
    database.close()
  }
}

export async function saveListeningPreference(
  record: ListeningPreference,
  databaseName = DATABASE_NAME,
): Promise<void> {
  if (
    !record.sourceIdentity ||
    !Number.isFinite(record.measuredLufs) ||
    !Number.isFinite(record.targetLufs)
  )
    throw new Error('Invalid listening reference.')
  const database = await openListeningDatabase(databaseName)
  try {
    await database.put('references', record)
  } finally {
    database.close()
  }
}
