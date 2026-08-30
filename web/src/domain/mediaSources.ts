import type { MediaPermissionState, MediaSourceReference } from './models'

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
