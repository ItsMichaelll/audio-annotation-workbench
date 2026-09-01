import type {
  MediaPermissionState,
  MediaSourceReference,
  TaskRecord,
} from './models'
import { assertRelinkSelectionMatchesTask } from './relink'

export interface MediaSourceCapabilities {
  fileSystemAccess: boolean
  directorySelection: boolean
  persistentHandles: boolean
}

export interface ResolvedMediaSource {
  file: File
  permission: MediaPermissionState
}

export interface MediaSourceAdapter {
  readonly kind: MediaSourceReference['kind']
  capabilities(): MediaSourceCapabilities
  queryPermission(
    reference: MediaSourceReference,
  ): Promise<MediaPermissionState>
  requestPermission(
    reference: MediaSourceReference,
  ): Promise<MediaPermissionState>
  resolve(reference: MediaSourceReference): Promise<ResolvedMediaSource>
}

export interface MediaSourceRegistry {
  register(adapter: MediaSourceAdapter): void
  adapterFor(reference: MediaSourceReference): MediaSourceAdapter | null
}

const currentSessionFiles = new Map<string, File>()

export function registerCurrentSessionFile(locator: string, file: File): void {
  currentSessionFiles.set(locator, file)
}

export function registerRelinkSessionFile(
  task: TaskRecord,
  locator: string,
  file: File,
): void {
  assertRelinkSelectionMatchesTask(task, {
    name: file.name,
    size: file.size,
    ...(file.webkitRelativePath
      ? { relativePath: file.webkitRelativePath }
      : {}),
  })
  registerCurrentSessionFile(locator, file)
}

type PermissionCapableHandle = FileSystemFileHandle & {
  queryPermission(options?: { mode: 'read' }): Promise<PermissionState>
  requestPermission(options?: { mode: 'read' }): Promise<PermissionState>
}

function permissionState(value: PermissionState): MediaPermissionState {
  return value === 'granted' || value === 'prompt' || value === 'denied'
    ? value
    : 'unknown'
}

class FileHandleAdapter implements MediaSourceAdapter {
  readonly kind = 'file-handle' as const
  capabilities = detectMediaSourceCapabilities

  async queryPermission(reference: MediaSourceReference) {
    if (reference.kind !== 'file-handle' || !reference.handle) return 'unknown'
    const handle = reference.handle as PermissionCapableHandle
    if (typeof handle.queryPermission !== 'function') return 'unknown'
    return permissionState(await handle.queryPermission({ mode: 'read' }))
  }

  async requestPermission(reference: MediaSourceReference) {
    if (reference.kind !== 'file-handle' || !reference.handle) return 'denied'
    const handle = reference.handle as PermissionCapableHandle
    if (typeof handle.requestPermission !== 'function') return 'denied'
    return permissionState(await handle.requestPermission({ mode: 'read' }))
  }

  async resolve(reference: MediaSourceReference): Promise<ResolvedMediaSource> {
    if (reference.kind !== 'file-handle' || !reference.handle) {
      throw new Error(
        'The saved file handle is missing. Relink the audio file.',
      )
    }
    const permission = await this.queryPermission(reference)
    if (permission !== 'granted') {
      throw new Error(
        permission === 'prompt'
          ? 'Permission is required to read this audio file.'
          : 'Permission to read this audio file was denied.',
      )
    }
    return { file: await reference.handle.getFile(), permission }
  }
}

class CurrentSessionAdapter implements MediaSourceAdapter {
  readonly kind = 'external-reference' as const
  capabilities = detectMediaSourceCapabilities
  async queryPermission(reference: MediaSourceReference) {
    return reference.kind === 'external-reference' &&
      currentSessionFiles.has(reference.locator)
      ? ('granted' as const)
      : ('unknown' as const)
  }
  async requestPermission(reference: MediaSourceReference) {
    return this.queryPermission(reference)
  }
  async resolve(reference: MediaSourceReference): Promise<ResolvedMediaSource> {
    if (reference.kind !== 'external-reference') {
      throw new Error('Unsupported media source.')
    }
    const file = currentSessionFiles.get(reference.locator)
    if (!file) {
      throw new Error('The session-only audio file is no longer available.')
    }
    return { file, permission: 'granted' }
  }
}

class DefaultMediaSourceRegistry implements MediaSourceRegistry {
  private readonly adapters = new Map<
    MediaSourceReference['kind'],
    MediaSourceAdapter
  >()
  register(adapter: MediaSourceAdapter) {
    this.adapters.set(adapter.kind, adapter)
  }
  adapterFor(reference: MediaSourceReference) {
    return this.adapters.get(reference.kind) ?? null
  }
}

const defaultRegistry = new DefaultMediaSourceRegistry()
defaultRegistry.register(new FileHandleAdapter())
defaultRegistry.register(new CurrentSessionAdapter())

export function getMediaSourceRegistry(): MediaSourceRegistry {
  return defaultRegistry
}

export function detectMediaSourceCapabilities(): MediaSourceCapabilities {
  const pickerWindow = window as Window & {
    showOpenFilePicker?: unknown
    showDirectoryPicker?: unknown
  }

  return {
    fileSystemAccess: typeof pickerWindow.showOpenFilePicker === 'function',
    directorySelection: typeof pickerWindow.showDirectoryPicker === 'function',
    persistentHandles:
      typeof pickerWindow.showOpenFilePicker === 'function' &&
      typeof indexedDB !== 'undefined',
  }
}
