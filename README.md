# Audio Annotation Workbench

Audio Annotation Workbench is a local-first, keyboard-first application for
expert audio engineers and ML dataset reviewers. It combines project and
taxonomy management with a DAW-style waveform editor for precise temporal
review.

The application is browser-only. It has no backend, account system, telemetry,
or cloud dependency. Audio stays in its original location and is never copied
into the project database.

## Current implementation

The annotation-workspace milestone connects the project task queue to the
existing audio workbench:

- Persistent active and archived projects
- Project creation, detail, editing, restoration, and deliberate deletion
- Required JSON or YAML taxonomies with immutable local version history
- Optional Markdown instructions with safe rendering
- Task ingestion, import preview, task management, and local-source relinking
- Taxonomy-driven region and clip labels, configured scales, notes, and shortcuts
- Debounced local drafts, unified annotation undo/redo, validation, and submission
- Stable task ordering with skip, submit-next, read-only submission, and reopening
- Browser storage durability reporting
- A transitional standalone editor at `/editor`

The standalone editor retains its existing functionality:

- Local browser audio loading through object URLs
- Waveform, timeline, synchronized minimap and scrollbar, and spectrogram
- Pointer-centered zoom, horizontal navigation, and vertical waveform scaling
- Region creation, movement, resizing, looping, nudging, deletion, undo, and redo
- Keyboard transport
- Real-time spectrum analysis
- Standards-oriented loudness and true-peak metering
- File and selected-region loudness analysis through a shared Web Audio graph

The standalone `/editor` route remains available for direct local-file waveform
testing without creating a project.

## Application structure

The completed product is organized into four primary areas:

1. **Projects dashboard** — active and archived projects, progress, timestamps,
   and project navigation.
2. **Project creation and editing** — project metadata, taxonomy versions,
   Markdown instructions, archive state, and deletion.
3. **Project detail and task manager** — project status, task import and
   filtering, stable queue order, progress, and labeling entry actions.
4. **Annotation workspace** — the existing waveform and analysis tools combined
   with task navigation, taxonomy-driven labels, instructions, validation,
   autosaved drafts, and submission controls.

## Routes

| Route | Purpose |
| --- | --- |
| `/` and `/projects` | Projects dashboard |
| `/projects/new` | Project creation |
| `/projects/:projectId` | Project detail |
| `/projects/:projectId/edit` | Project editing |
| `/projects/:projectId/tasks/:taskId/annotate` | Task annotation workspace |
| `/editor` | Transitional standalone audio workbench |

Unknown routes and unknown project IDs show explicit recovery states. React
Router owns route state and browser history. Vite supplies development fallback;
production static hosting must serve `index.html` for these application paths.

## Persistence and data ownership

IndexedDB database `audio-annotation-workbench` is currently schema version 3.
It contains:

| Store | Responsibility |
| --- | --- |
| `projects` | Project identity, metadata, status, and active record references |
| `taxonomyVersions` | Immutable project-local taxonomy versions and source text |
| `instructions` | Optional raw Markdown instructions |
| `tasks` | Task source, stable import order, lifecycle status, and indexes |
| `annotations` | Versioned drafts and submissions, uniquely indexed by task |

The typed repository is independent of React and owns database initialization,
migrations, queries, and writes. Project and task deletion remove associated
annotations. Draft creation atomically moves an unstarted task to draft;
submission atomically writes the submitted annotation and task status. Errors
propagate to the UI instead of being treated as successful writes.

Persisted models use stable UUIDs and ISO 8601 timestamps. Names are presentation
values and never database keys. Project, taxonomy-record, instruction, and task
schema versions are centralized in the domain model.

Browser storage belongs to the current browser profile. A browser may evict
best-effort storage, private browsing can shorten its lifetime, and clearing site
data removes projects. The dashboard reports storage durability and can request
persistent storage, but persistence is not a replacement for project backup.
Lossless backup and restoration arrive in a later milestone.

See [frontend architecture](docs/architecture.md) and
[ADR 0004](docs/adr/0004-project-persistence-and-routing.md).

## Taxonomy versions

Project creation requires an annotation-capable `.json`, `.yaml`, or `.yml`
taxonomy no larger than 1 MB. Version one requires `schemaVersion: 1` and at
least one label with a unique stable ID and name. Omitted label scopes default
to `region`; supported scopes are `region` and `clip`.

```yaml
schemaVersion: 1
labels:
  - id: background-noise
    name: Background noise
    description: Sustained unwanted environmental sound
    scopes: [region, clip]
    color: "#4f8cff"
    shortcut: "1"
scales:
  severity:
    required: false
    options:
      - value: minor
        label: Minor
      - value: moderate
        label: Moderate
      - value: severe
        label: Severe
  confidence:
    required: false
    options:
      - value: low
        label: Low
      - value: medium
        label: Medium
      - value: high
        label: High
```

Validation rejects duplicate label IDs, invalid scopes and colors, conflicting
shortcuts, malformed scales, and duplicate scale option values. Existing
projects with an older incompatible taxonomy remain intact and direct users to
upload a replacement before starting a new annotation.

Each record preserves:

- Original filename, format, and source text
- Parsed document and extracted metadata
- Browser-native SHA-256 content hash
- Project-local version number and creation timestamp

Replacing a taxonomy creates a new immutable record and changes the project's
active reference. Identical content is detected by hash and does not create a
duplicate version. Earlier versions remain available in project history.
The first saved draft pins its annotation to the then-active taxonomy version;
later replacements do not reinterpret drafts or submissions.

Uploaded content is parsed as data. It is never executed or evaluated.

## Markdown instructions

Projects may include one `.md` instructions file no larger than 512 KB. The raw
Markdown and source filename are preserved. Editing can replace or remove the
record.

Rendering uses `react-markdown` without raw HTML support. An element allowlist
omits scripts, iframes, images, and other executable or externally loaded
content. Link URLs are restricted to HTTP, HTTPS, mail, and document fragments;
external tabs receive `noopener noreferrer`.

## Media and privacy boundaries

Audio `File` objects and object URLs remain local to the browser and are revoked
when replaced or unmounted. Audio is not written to IndexedDB or OPFS. Project
creation does not request filesystem permissions.

Task imports accept browser-selected audio files and JSON/JSONL manifests. A
manifest is either `{ "tasks": [...] }`, an array, or JSONL; each task requires
a safe relative `audio` path and may provide `id`, `name`, and simple metadata.
Absolute and parent-traversal paths are rejected. Manifest-only tasks remain
unresolved until relinked. Fallback file selections are session-only and can
require relinking after browser restart; neither audio bytes nor absolute paths
are persisted.

Task types represent a primary media reference separately from project metadata.
The media-source adapter contract covers browser capability detection, permission
query and request behavior, missing or moved files, unresolved references, and
future fallback adapters. This allows File System Access API handles, a local
companion service, or a desktop wrapper to be added later without rewriting
project and annotation domain logic.

The annotation workspace queries saved-handle permission without prompting.
Permission requests and relinking occur only after a user action. Resolved files
receive short-lived object URLs that are revoked on task changes and teardown.
Audio bytes, object URLs, waveform peaks, spectrogram data, and analysis results
are never written to IndexedDB.

## Labeling workflow and local drafts

`Start Labeling` opens the first actionable task in persisted import order.
Task-row actions open new work, continue drafts or reopened submissions, and
show submitted work read-only. `Skip & Next` and `Submit & Next` wrap through
the remaining actionable queue; completion returns to current project progress.

Meaningful annotation edits are debounced to IndexedDB. The workspace reports
Unsaved, Saving, Saved, or Save failed and flushes pending work before controlled
navigation. Failed required saves stop navigation. Revision checks prevent an
older asynchronous save from overwriting newer state. Reopening a submitted task
preserves its annotation and permits another draft/submission cycle.

Submission rejects unlabeled regions, missing or wrong-scope labels, missing
required scale values, invalid timing, duplicate assignments, and unresolved
save failures. A reviewed task with no regions or clip labels requires explicit
confirmation before submission.

## Development

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- pnpm 10
- A current desktop browser with IndexedDB and Web Audio

Install and run from the repository root:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Run the complete validation sequence:

```powershell
pnpm validate
```

The individual commands are `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test`, and `pnpm build`. Use `pnpm format` to apply
formatting. See [CONTRIBUTING.md](CONTRIBUTING.md) for engineering boundaries and
fixture rules.

## Standalone editor controls

### Keyboard

| Key | Action |
| --- | --- |
| Space | Play or pause |
| Left / Right | Move playhead 50 ms |
| Shift + Left / Right | Move playhead 250 ms |
| Ctrl + Left / Right | Select and reveal the previous / next region |
| A / D | Move backward / forward 1 second |
| Home / End | Move to file start / end |
| F | Fit the complete waveform |
| + / - | Zoom around the visible playhead or viewport center |
| L | Toggle selected-region looping |
| Delete / Backspace or Ctrl + D | Delete the selected region |
| Escape | Clear region selection |
| Ctrl + Z | Undo region edit |
| Ctrl + Y or Ctrl + Shift + Z | Redo region edit |

The project-task workspace retains these controls and adds taxonomy-configured
single-key label toggles, `Ctrl + Enter` for Submit & Next, and
`Ctrl + Shift + Enter` for Skip & Next. Labeling and workflow shortcuts are
ignored while an input, textarea, select, button, or editable element has focus.

### Pointer

| Gesture | Action |
| --- | --- |
| Click or drag empty waveform | Seek or create a region |
| Drag region body or edge | Move or resize a region |
| Double-click region | Play that region |
| Wheel over waveform or minimap | Zoom around pointer |
| Alt + wheel | Scale waveform height |
| Shift + wheel | Pan, or nudge the selected region |
| Middle drag or Alt + left drag | Pan horizontally |
| Drag minimap viewport or scrollbar | Pan synchronized views |

Spectrogram, Spectrum Analyzer, and Meter are independent transport toggles. See
[interaction model](docs/interaction-model.md) for precedence, lifecycle, and
measurement details.

## Roadmap

### 1. Project foundation — implemented

- URL routing and transitional editor route
- IndexedDB schema, migrations, and repository layer
- Dashboard, creation, detail, editing, archive/restore, and deletion
- Taxonomy upload, hashing, immutable versions, and duplicate suppression
- Optional safely rendered Markdown instructions
- Task, progress, and media-source foundations

### 2. Task ingestion and management — implemented

- Direct audio-file and dataset-directory selection
- JSON and JSONL manifest import (CSV deferred)
- Stable task IDs and metadata
- Duplicate, missing-file, and conflict detection with import preview
- Task table, filters, sorting, status counts, and navigation

### 3. Annotation-workspace integration — implemented

- Project task loading in the existing editor
- Back-to-project and task navigation
- Taxonomy-driven region and clip labels
- Severity, confidence, notes, and submission validation
- Automatic drafts, skip/flag behavior, and submit-next workflow

### 4. Export, backup, and recovery

- Canonical lossless project JSON
- JSONL annotation export and optional flattened CSV
- Submitted-only and all-task export modes
- Stable schema and entity versions
- Project backup import, validation, and restoration

### Later capabilities

Planned local authoring tools include:

- In-browser taxonomy YAML editing through both a raw text editor and a user-friendly structured editor
- In-browser instructions Markdown editing through a text editor

Quality review, reviewer assignment, collaboration, authentication, cloud
storage, inter-annotator agreement, and ML-assisted labeling remain explicitly
deferred. They require separate product and security decisions after the
local-first single-reviewer workflow is complete.

## License

Copyright © 2026 Michael Camerato. All rights reserved. See [LICENSE](LICENSE).
