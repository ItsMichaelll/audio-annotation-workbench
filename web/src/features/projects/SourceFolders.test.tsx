import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../../domain/models'
import { SourceFolders } from './SourceFolders'
import { TaskImport } from './TaskImport'
import { detectMediaSourceCapabilities } from '../../domain/mediaSources'
import { pickSourceFolder } from '../../domain/folderSources'

const project: Project = {
  id: 'p',
  name: 'Test',
  schemaVersion: 1,
  status: 'active',
  activeTaxonomyVersionId: 't',
  createdAt: 'now',
  updatedAt: 'now',
  sourceFolders: [
    { id: 's', name: 'Dataset' },
    { id: 's2', name: 'Another dataset' },
  ],
}
afterEach(() => vi.unstubAllGlobals())
describe('folder controls and browser fallback', () => {
  it('exposes reconnect, replacement, and forget controls for each saved root', () => {
    const picker = vi.fn()
    vi.stubGlobal('window', { showDirectoryPicker: picker })
    vi.stubGlobal('indexedDB', {})
    const html = renderToStaticMarkup(
      <SourceFolders
        project={project}
        tasks={[]}
        onChanged={() => undefined}
      />,
    )
    expect(html).toContain('Connect folder')
    expect(html.match(/Reconnect folder/g)).toHaveLength(2)
    expect(html.match(/Replace folder/g)).toHaveLength(2)
    expect(html.match(/Forget access/g)).toHaveLength(2)
    expect(picker).not.toHaveBeenCalled()
  })
  it('preserves all temporary import actions in unsupported browsers', () => {
    vi.stubGlobal('window', {})
    const html = renderToStaticMarkup(
      <>
        <SourceFolders
          project={project}
          tasks={[]}
          onChanged={() => undefined}
        />
        <TaskImport onReady={() => undefined} />
      </>,
    )
    expect(html).toContain('Persistent folders are unavailable')
    expect(html).toContain('Select directory')
    expect(html).toContain('Select audio files')
    expect(html).toContain('Select JSON/JSONL manifest')
    expect(detectMediaSourceCapabilities().persistentHandles).toBe(false)
  })
  it('requests only read access on explicit folder selection', async () => {
    const picker = vi.fn(async () => ({ name: 'dataset' }))
    vi.stubGlobal('window', { showDirectoryPicker: picker })
    vi.stubGlobal('indexedDB', {})
    expect(detectMediaSourceCapabilities().persistentHandles).toBe(true)
    await pickSourceFolder()
    expect(picker).toHaveBeenCalledWith({ mode: 'read' })
  })
})
