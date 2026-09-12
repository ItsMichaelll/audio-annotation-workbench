import { describe, expect, it, vi } from 'vitest'
import {
  FolderSourceAdapter,
  folderReference,
  scanSourceFolder,
  type DirectoryHandle,
} from './folderSources'
import { buildImportPlan, taskFromCandidate } from './taskIngestion'
import {
  detectMediaSourceCapabilities,
  getMediaSourceRegistry,
  registerCurrentSessionFile,
  releaseCurrentSessionFile,
} from './mediaSources'

function directory(
  name: string,
  entries: Record<string, File | DirectoryHandle>,
  permission: PermissionState = 'granted',
): DirectoryHandle {
  return {
    kind: 'directory',
    name,
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => {
      permission = 'granted'
      return permission
    }),
    getDirectoryHandle: vi.fn(async (path: string) => {
      const entry = entries[path]
      if (!entry || entry instanceof File)
        throw new DOMException('Missing', 'NotFoundError')
      return entry
    }),
    getFileHandle: vi.fn(async (path: string) => {
      const file = entries[path]
      if (!(file instanceof File))
        throw new DOMException('Missing', 'NotFoundError')
      return { kind: 'file', name: file.name, getFile: async () => file }
    }),
    async *values() {
      for (const entry of Object.values(entries)) {
        yield entry instanceof File
          ? ({
              kind: 'file' as const,
              name: entry.name,
              getFile: async () => entry,
            } as FileSystemFileHandle)
          : entry
      }
    },
  } as unknown as DirectoryHandle
}

const ref = folderReference('project', 'source', 'left/clip.wav')
describe('persistent folder resolution', () => {
  it('resolves nested duplicate basenames by full path without prompting or creating files', async () => {
    const left = new File(['left'], 'clip.wav')
    const right = new File(['right'], 'clip.wav')
    const sub = directory('left', { 'clip.wav': left })
    const root = directory('audio', {
      left: sub,
      right: directory('right', { 'clip.wav': right }),
    })
    const adapter = new FolderSourceAdapter(async () => root)
    expect((await adapter.resolve(ref)).file).toBe(left)
    expect(
      (await adapter.resolve({ ...ref, relativePath: 'right/clip.wav' })).file,
    ).toBe(right)
    expect(root.requestPermission).not.toHaveBeenCalled()
    expect(root.getDirectoryHandle).toHaveBeenCalledWith('left')
    expect(sub.getFileHandle).toHaveBeenCalledWith('clip.wav')
  })
  it.each(['prompt', 'denied'] as const)(
    'preserves %s state without requesting permission on read',
    async (permission) => {
      const root = directory('audio', {}, permission)
      const adapter = new FolderSourceAdapter(async () => root)
      expect(await adapter.queryPermission(ref)).toBe(permission)
      await expect(adapter.resolve(ref)).rejects.toThrow(
        `permission is ${permission}`,
      )
      expect(root.requestPermission).not.toHaveBeenCalled()
      expect(root.getDirectoryHandle).not.toHaveBeenCalled()
      await adapter.requestPermission(ref)
      expect(root.requestPermission).toHaveBeenCalledWith({ mode: 'read' })
    },
  )
  it('one reconnect restores every matching task', async () => {
    const root = directory(
      'audio',
      {
        a: directory('a', { 'clip.wav': new File(['a'], 'clip.wav') }),
        b: directory('b', { 'clip.wav': new File(['b'], 'clip.wav') }),
      },
      'prompt',
    )
    const adapter = new FolderSourceAdapter(async () => root)
    await adapter.requestPermission(ref)
    for (const path of ['a/clip.wav', 'b/clip.wav'])
      expect(
        (await adapter.resolve({ ...ref, relativePath: path })).permission,
      ).toBe('granted')
    expect(root.requestPermission).toHaveBeenCalledOnce()
  })
  it('reports disconnected, missing and unsupported sources', async () => {
    const adapter = new FolderSourceAdapter(async () => undefined)
    expect(await adapter.queryPermission(ref)).toBe('unknown')
    await expect(adapter.resolve(ref)).rejects.toThrow('disconnected')
    const connected = new FolderSourceAdapter(async () =>
      directory('audio', {}),
    )
    await expect(connected.resolve(ref)).rejects.toThrow(
      'missing, renamed, moved, or unavailable: left/clip.wav',
    )
    await expect(
      connected.resolve({ ...ref, relativePath: 'file.txt' }),
    ).rejects.toThrow('Unsupported audio')
    await expect(
      connected.resolve({ ...ref, relativePath: '../clip.wav' }),
    ).rejects.toThrow('parent traversal')
  })
  it('scans deterministically and distinguishes identical paths in separate roots', async () => {
    const root = directory('audio', {
      'clip.wav': new File(['a'], 'clip.wav'),
      'readme.txt': new File(['text'], 'readme.txt'),
      nested: directory('nested', { 'clip.wav': new File(['b'], 'clip.wav') }),
    })
    const scan = await scanSourceFolder(root, 'project', 'source')
    expect(scan.candidates.map((item) => item.audio)).toEqual([
      'clip.wav',
      'nested/clip.wav',
    ])
    expect(scan.unsupported).toEqual(['readme.txt'])
    const existing = scan.candidates.map((item, index) =>
      taskFromCandidate('project', item, String(index), 'now'),
    )
    expect(buildImportPlan(scan.candidates, existing).duplicates).toHaveLength(
      2,
    )
    const other = await scanSourceFolder(root, 'project', 'other')
    expect(buildImportPlan(other.candidates, existing).valid).toHaveLength(2)
  })
  it('detects unsupported browsers and keeps temporary file fallback usable and releasable', async () => {
    expect(detectMediaSourceCapabilities().persistentHandles).toBe(false)
    const file = new File(['a'], 'clip.wav')
    const reference = {
      kind: 'external-reference' as const,
      locator: 'fallback',
      permission: 'unknown' as const,
      displayName: file.name,
    }
    registerCurrentSessionFile(reference.locator, file)
    const adapter = getMediaSourceRegistry().adapterFor(reference)!
    expect((await adapter.resolve(reference)).file).toBe(file)
    releaseCurrentSessionFile(reference.locator)
    await expect(adapter.resolve(reference)).rejects.toThrow(
      'no longer available',
    )
  })
})
