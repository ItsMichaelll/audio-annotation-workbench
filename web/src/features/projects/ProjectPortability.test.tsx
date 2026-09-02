import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  PROJECT_BACKUP_FORMAT,
  PROJECT_BACKUP_FORMAT_VERSION,
  type ProjectBackup,
} from '../../domain/projectBackup'
import { PROJECT_SCHEMA_VERSION } from '../../domain/models'
import { ProjectDataPortability } from './ProjectDataPortability'
import { ProjectRestorePreview } from './ProjectRestore'

const backup: ProjectBackup = {
  format: PROJECT_BACKUP_FORMAT,
  formatVersion: PROJECT_BACKUP_FORMAT_VERSION,
  exportedAt: '2026-09-01T00:00:00.000Z',
  project: {
    id: 'project-1',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name: 'Preview project',
    status: 'active',
    activeTaxonomyVersionId: 'taxonomy-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  taxonomyVersions: [],
  instructions: null,
  tasks: [],
  annotations: [],
}

describe('project portability UI', () => {
  it('explains backup exclusions and exposes both download actions', () => {
    const html = renderToStaticMarkup(
      <ProjectDataPortability
        projectId="project-1"
        projectName="Preview project"
      />,
    )
    expect(html).toContain('Download backup')
    expect(html).toContain('Export annotations')
    expect(html).toContain('Source audio is never included')
  })

  it('renders a validated restore preview with counts and action', () => {
    const html = renderToStaticMarkup(
      <ProjectRestorePreview
        backup={backup}
        busy={false}
        onRestore={() => undefined}
      />,
    )
    expect(html).toContain('Validated preview')
    expect(html).toContain('Preview project')
    expect(html).toContain('Media to relink')
    expect(html).toContain('Restore backup')
  })
})
