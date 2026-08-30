export type StorageDurability = 'persistent' | 'best-effort' | 'unsupported'

export async function storageDurability(): Promise<StorageDurability> {
  if (!navigator.storage?.persisted) return 'unsupported'
  return (await navigator.storage.persisted()) ? 'persistent' : 'best-effort'
}

export async function requestPersistentStorage(): Promise<StorageDurability> {
  if (!navigator.storage?.persist) return 'unsupported'
  return (await navigator.storage.persist()) ? 'persistent' : 'best-effort'
}
