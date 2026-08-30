# ADR 0004: Browser project persistence and URL routing

- Status: Accepted
- Date: 2026-08-30

## Context

The workbench is becoming a local-first data-labeling application. Projects need
stable identities, versioned taxonomies, durable instructions, task foundations,
and direct URLs without coupling this domain state to the existing waveform
editor. Audio collections can be hundreds of gigabytes and must remain in their
original locations.

## Decision

Use React Router in declarative library mode for dashboard, creation, detail,
editing, and transitional standalone-editor routes. The URL owns navigation
state, so direct navigation and browser history use normal web semantics.

Use IndexedDB as the structured project database. Database
`audio-annotation-workbench`, schema version 1, owns four object stores:

- `projects`, indexed by status and update time
- `taxonomyVersions`, indexed by project and project-local version
- `instructions`, uniquely indexed by project
- `tasks`, indexed by project, project/status, and project/update time

The typed repository owns all database access. Multi-record integrity changes
use explicit transactions: project creation writes its initial taxonomy and
optional instructions atomically; taxonomy replacement writes a new immutable
version and updates the active reference atomically; instruction changes update
the project reference atomically; deletion removes every associated record in
one transaction.

Schema versions for persisted records are centralized in domain models. Database
upgrades are ordered by the previous database version in the `upgrade` callback.
Future schema changes must preserve old records through an additive or explicitly
transforming migration before the database version is increased.

Store only structured project data. Do not store audio in IndexedDB or OPFS. A
media-source adapter boundary represents file handles, permissions, missing or
moved files, external references, and future desktop or companion-service
adapters without changing project or task logic.

Render Markdown instructions as React elements with raw HTML disabled. Restrict
the element set, omit images, allow only HTTP, HTTPS, mail, and fragment link
targets, and protect links opened in a new tab.

## Consequences

- Projects survive refreshes without a backend, but remain browser-profile data.
- Storage can still be evicted unless the browser grants durable storage.
- Browser persistence is not a backup. Export and restoration remain a later
  milestone.
- File System Access API support and handle permission behavior vary by browser.
- Static production hosting must return `index.html` for application routes.
- The standalone editor remains at `/editor` until project tasks are connected
  to the annotation workspace.
