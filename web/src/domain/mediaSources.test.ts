import { describe, expect, it, vi } from 'vitest'
import {
  getMediaSourceRegistry,
  registerCurrentSessionFile,
  registerRelinkSessionFile,
} from './mediaSources'
import {
  TASK_SCHEMA_VERSION,
  type MediaSourceReference,
  type TaskRecord,
} from './models'

describe('media source recovery', () => {
  it('resolves a registered current-session file and reports a missing session source', async () => {
    const file = { name: 'clip.wav' } as File
    registerCurrentSessionFile('session:clip', file)
    const available: MediaSourceReference = {
      kind: 'external-reference',
      locator: 'session:clip',
      displayName: 'clip.wav',
      permission: 'prompt',
    }
    const missing: MediaSourceReference = {
      ...available,
      locator: 'session:missing',
    }
    const adapter = getMediaSourceRegistry().adapterFor(available)
    await expect(adapter?.resolve(available)).resolves.toEqual({
      file,
      permission: 'granted',
    })
    await expect(adapter?.resolve(missing)).rejects.toThrow(
      'The session-only audio file is no longer available.',
    )
  })

  it('does not request file-handle permission while querying or resolving', async () => {
    const queryPermission = vi.fn(async () => 'prompt' as PermissionState)
    const requestPermission = vi.fn(async () => 'granted' as PermissionState)
    const handle = {
      queryPermission,
      requestPermission,
      getFile: vi.fn(),
    } as unknown as FileSystemFileHandle
    const reference: MediaSourceReference = {
      kind: 'file-handle',
      handleId: 'handle',
      displayName: 'clip.wav',
      permission: 'prompt',
      handle,
    }
    const adapter = getMediaSourceRegistry().adapterFor(reference)
    await expect(adapter?.queryPermission(reference)).resolves.toBe('prompt')
    await expect(adapter?.resolve(reference)).rejects.toThrow(
      'Permission is required',
    )
    expect(requestPermission).not.toHaveBeenCalled()
    await adapter?.requestPermission(reference)
    expect(requestPermission).toHaveBeenCalledOnce()
  })

  it('does not register an incorrectly selected relinking file', async () => {
    const task: TaskRecord = {
      id: 'relink-task',
      schemaVersion: TASK_SCHEMA_VERSION,
      projectId: 'project',
      status: 'draft',
      primaryMedia: {
        kind: 'unresolved',
        displayName: 'clip.wav',
        reason: 'missing',
      },
      sourceIdentity: {
        kind: 'direct-file',
        filename: 'clip.wav',
        size: 100,
      },
      metadata: {},
      createdAt: 'now',
      updatedAt: 'now',
    }
    const file = new File(['wrong'], 'wrong.wav')
    const reference: MediaSourceReference = {
      kind: 'external-reference',
      locator: 'invalid-relink-selection',
      displayName: file.name,
      permission: 'granted',
    }

    expect(() =>
      registerRelinkSessionFile(task, reference.locator, file),
    ).toThrow('Expected: "clip.wav" (100 bytes)')
    await expect(
      getMediaSourceRegistry().adapterFor(reference)?.resolve(reference),
    ).rejects.toThrow('no longer available')
  })
})
