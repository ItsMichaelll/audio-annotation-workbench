import type { MediaSourceAdapter } from './mediaSources'
import { detectMediaSourceCapabilities } from './mediaSources'
import type { MediaSourceReference } from './models'
import { normalizeRelativePath, type ImportCandidate } from './taskIngestion'

export const AUDIO_FILE =
  /\.(wav|wave|mp3|flac|ogg|oga|opus|webm|m4a|aac|aiff?)$/i
export type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: 'read' }): Promise<PermissionState>
  requestPermission(options: { mode: 'read' }): Promise<PermissionState>
  values(): AsyncIterableIterator<
    FileSystemDirectoryHandle | FileSystemFileHandle
  >
}
export type FolderReference = Extract<MediaSourceReference, { kind: 'folder' }>

export function pickSourceFolder(): Promise<DirectoryHandle> {
  const picker = (
    window as Window & {
      showDirectoryPicker?(options: { mode: 'read' }): Promise<DirectoryHandle>
    }
  ).showDirectoryPicker
  if (!picker)
    throw new Error(
      'Persistent folders are unavailable. Use Select directory or Select audio files.',
    )
  return picker.call(window, { mode: 'read' })
}

export function folderReference(
  projectId: string,
  sourceId: string,
  path: string,
): FolderReference {
  const relativePath = normalizeRelativePath(path)
  if (!relativePath) throw new Error('An audio file path is required.')
  return {
    kind: 'folder',
    projectId,
    sourceId,
    relativePath,
    displayName: relativePath.split('/').at(-1)!,
    permission: 'unknown',
  }
}

export class FolderSourceAdapter implements MediaSourceAdapter {
  readonly kind = 'folder' as const
  capabilities = detectMediaSourceCapabilities
  constructor(
    private readonly load: (
      projectId: string,
      sourceId: string,
    ) => Promise<DirectoryHandle | undefined>,
  ) {}
  private handle(reference: MediaSourceReference) {
    if (reference.kind !== 'folder')
      throw new Error('Unsupported folder source.')
    return this.load(reference.projectId, reference.sourceId)
  }
  async queryPermission(reference: MediaSourceReference) {
    const handle = await this.handle(reference)
    return handle?.queryPermission
      ? handle.queryPermission({ mode: 'read' })
      : ('unknown' as const)
  }
  async requestPermission(reference: MediaSourceReference) {
    const handle = await this.handle(reference)
    return handle?.requestPermission
      ? handle.requestPermission({ mode: 'read' })
      : ('denied' as const)
  }
  async resolve(reference: MediaSourceReference) {
    if (reference.kind !== 'folder')
      throw new Error('Unsupported folder source.')
    const handle = await this.handle(reference)
    if (!handle)
      throw new Error(
        'Folder is disconnected. Reconnect folder in the project to restore all matching tasks.',
      )
    const permission = await handle.queryPermission({ mode: 'read' })
    if (permission !== 'granted')
      throw new Error(
        `Folder permission is ${permission}. Reconnect folder to restore access.`,
      )
    const path = normalizeRelativePath(reference.relativePath)
    if (!path || !AUDIO_FILE.test(path))
      throw new Error(`Unsupported audio file: ${path}`)
    try {
      const parts = path.split('/')
      let directory: FileSystemDirectoryHandle = handle
      for (const part of parts.slice(0, -1))
        directory = await directory.getDirectoryHandle(part)
      const fileHandle = await directory.getFileHandle(parts.at(-1)!)
      return { file: await fileHandle.getFile(), permission }
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        throw new Error('Folder permission was revoked. Reconnect folder.', {
          cause: error,
        })
      }
      throw new Error(
        `Audio missing, renamed, moved, or unavailable: ${path}. Restore its original relative path or replace the connected root folder.`,
        { cause: error },
      )
    }
  }
}

export async function scanSourceFolder(
  handle: DirectoryHandle,
  projectId: string,
  sourceId: string,
) {
  const candidates: ImportCandidate[] = []
  const unsupported: string[] = []
  async function visit(directory: DirectoryHandle, prefix: string) {
    for await (const entry of directory.values()) {
      const path = prefix + entry.name
      if (entry.kind === 'directory')
        await visit(entry as DirectoryHandle, path + '/')
      else if (AUDIO_FILE.test(path))
        candidates.push({
          audio: path,
          source: folderReference(projectId, sourceId, path),
        })
      else unsupported.push(path)
    }
  }
  await visit(handle, '')
  candidates.sort((a, b) => a.audio.localeCompare(b.audio))
  return { candidates, unsupported: unsupported.sort() }
}
