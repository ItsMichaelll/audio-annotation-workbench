# Audio Annotation Workbench

Audio Annotation Workbench is a local-first, keyboard-first application for
expert audio engineers and ML dataset reviewers. It combines project and
taxonomy management with a DAW-style waveform editor for precise temporal
review.

The application is browser-only. It has no backend, account system, telemetry,
or cloud dependency. Audio stays in its original location and is never copied
into the project database.

## Current implementation

The project-foundation milestone adds the application structure around the
existing audio workbench:

- Persistent active and archived projects
- Project creation, detail, editing, restoration, and deliberate deletion
- Required JSON or YAML taxonomies with immutable local version history
- Optional Markdown instructions with safe rendering
- Task and media-source foundation types for the next milestone
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

Project task ingestion and project-based labeling are intentionally not included
in this milestone. New projects therefore show zero tasks.

## Application structure

The completed product is organized into four primary areas:

1. **Projects dashboard** — active and archived projects, progress, timestamps,
   and project navigation.
2. **Project creation and editing** — project metadata, taxonomy versions,
   Markdown instructions, archive state, and deletion.
3. **Project detail and task manager** — project status, task import and
   filtering, progress, annotation export, backup, and restoration. The current
   milestone implements the project summary and task zero state.
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
| `/editor` | Transitional standalone audio workbench |

Unknown routes and unknown project IDs show explicit recovery states. React
Router owns route state and browser history. Vite supplies development fallback;
production static hosting must serve `index.html` for these application paths.

## Persistence and data ownership

IndexedDB database `audio-annotation-workbench` is currently schema version 1.
It contains:

| Store | Responsibility |
| --- | --- |
| `projects` | Project identity, metadata, status, and active record references |
| `taxonomyVersions` | Immutable project-local taxonomy versions and source text |
| `instructions` | Optional raw Markdown instructions |
| `tasks` | Future-compatible task records and status indexes |

The typed repository is independent of React and owns database initialization,
migrations, queries, and writes. Project creation and deletion are transactional.
Taxonomy and instruction changes atomically update their corresponding project
references. Errors propagate to the UI instead of being treated as successful
writes.

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

Project creation requires a `.json`, `.yaml`, or `.yml` taxonomy no larger than
1 MB. The parser requires an object at the document root and extracts optional
`name` and `schema_version` metadata without imposing the future annotation
contract.

Each record preserves:

- Original filename, format, and source text
- Parsed document and extracted metadata
- Browser-native SHA-256 content hash
- Project-local version number and creation timestamp

Replacing a taxonomy creates a new immutable record and changes the project's
active reference. Identical content is detected by hash and does not create a
duplicate version. Earlier versions remain available in project history.

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

Task types represent a primary media reference separately from project metadata.
The media-source adapter contract covers browser capability detection, permission
query and request behavior, missing or moved files, unresolved references, and
future fallback adapters. This allows File System Access API handles, a local
companion service, or a desktop wrapper to be added later without rewriting
project and annotation domain logic.

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
| A / D | Move backward / forward 1 second |
| Home / End | Move to file start / end |
| F | Fit the complete waveform |
| + / - | Zoom around the visible playhead or viewport center |
| L | Toggle selected-region looping |
| Delete / Backspace or Ctrl + D | Delete the selected region |
| Escape | Clear region selection |
| Ctrl + Z | Undo region edit |
| Ctrl + Y or Ctrl + Shift + Z | Redo region edit |

### Pointer

| Gesture | Action |
| --- | --- |
| Click or drag empty waveform | Seek or create a region |
| Drag region body or edge | Move or resize a region |
| Double-click region | Play that region |
| Wheel over waveform or minimap | Zoom around pointer |
| Alt + wheel | Scale waveform height |
| Shift + wheel | Nudge hovered or selected region |
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

### 2. Task ingestion and management — next

- Direct audio-file and dataset-directory selection
- JSON, JSONL, and CSV manifest import
- Stable task IDs and metadata
- Duplicate, missing-file, and conflict detection with import preview
- Task table, filters, sorting, status counts, and navigation

### 3. Annotation-workspace integration

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

Quality review, reviewer assignment, collaboration, authentication, cloud
storage, inter-annotator agreement, and ML-assisted labeling remain explicitly
deferred. They require separate product and security decisions after the
local-first single-reviewer workflow is complete.

## License

Copyright © 2026 Michael Camerato. All rights reserved. See [LICENSE](LICENSE).
