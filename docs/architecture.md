# Architecture

Audio Annotation Workbench is a browser-only React and TypeScript application.
It has three runtime areas: project management, persisted project-task
annotation, and a session-only standalone editor. The development server binds
to `127.0.0.1:5173` by default.

## Routes

`RouterApplication.tsx` owns the route tree and lazy-loads each screen.

| Route                                         | Responsibility                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `/` and `/projects`                           | Active or archived project dashboard                                    |
| `/projects/new`                               | Project creation                                                        |
| `/projects/restore`                           | Backup validation, preview, and restoration                             |
| `/projects/:projectId`                        | Project tasks, reference material, data, and settings                   |
| `/projects/:projectId/edit`                   | Project metadata, taxonomy replacement, instructions, and archive state |
| `/projects/:projectId/taxonomy`               | Raw YAML and structured taxonomy editor                                 |
| `/projects/:projectId/instructions`           | Markdown instructions editor and preview                                |
| `/projects/:projectId/tasks/:taskId/annotate` | Persisted task annotation workspace                                     |
| `/editor`                                     | Session-only standalone editor                                          |
| `/404`                                        | Missing-route state                                                     |

Unknown paths redirect to `/404`. Missing project and task records render
separate recovery states. Top-level route chunks use a null Suspense fallback;
individual screens and the audio workspace own their data and media loading
states. A static production host would need to return `index.html` for the
application routes, although 0.1.0 is distributed for local use through a cloned
repository and the Vite development server.

## Source layout

- `web/src/domain/` contains framework-independent models, validation,
  normalization, task planning, annotation history, backup parsing, and export
  serialization.
- `web/src/storage/` owns IndexedDB opening, migrations, indexes, queries, and
  multi-store transactions.
- `web/src/features/projects/` owns routed project screens, task management,
  taxonomy and instructions editing, source-folder workflows, backup, and
  export UI.
- `web/src/features/annotation/` loads project-task state, resolves media,
  controls annotation history and autosave, validates submissions, and navigates
  the task queue.
- `web/src/features/waveform/` owns the WaveSurfer instance, official plugins,
  generated regions and markers, gesture precedence, synchronized views, and
  teardown.
- `web/src/features/analysis/` owns the guarded shared Web Audio graph.
- `web/src/features/spectrum/` and `web/src/features/loudness/` own observational
  analysis UI and processing.
- `web/src/components/` contains shared application, modal, editor, transport,
  annotation-list, selection, and form controls.
- `web/src/styles/` contains global tokens, reset, base, and utility styles;
  component and feature styles use colocated CSS Modules.
- `web/src/App.tsx` is the standalone editor. `web/src/RouterApplication.tsx`
  mounts all routed screens.

Persistent records, URL state, form drafts, selected browser files, and
WaveSurfer rendering objects remain separate. React components use the typed
repository instead of opening IndexedDB transactions directly.

## IndexedDB schema and migrations

The database is named `audio-annotation-workbench` and is currently version 6.

| Store              | Key and indexes                                                                          | Responsibility                                                             |
| ------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `projects`         | Project ID; status and update-time indexes                                               | Project metadata and active taxonomy/instructions/source-folder references |
| `taxonomyVersions` | Taxonomy ID; project and project/version indexes                                         | Immutable raw and parsed taxonomy history                                  |
| `instructions`     | Instructions ID; unique project index                                                    | Optional raw Markdown instructions                                         |
| `tasks`            | Task ID; project, project/status, project/update-time, and project/relative-path indexes | Queue identity, status, source reference, and metadata                     |
| `annotations`      | Annotation ID; project and unique task indexes                                           | One versioned draft or submission per task                                 |
| `sourceFolders`    | Composite project/source ID; project index                                               | Structured-cloneable read-only directory handles                           |

Migrations run in the database upgrade transaction:

1. Version 1 creates projects, taxonomy versions, instructions, and tasks.
2. Version 2 adds the project-relative-path task index.
3. Version 3 creates annotations with a unique task index.
4. Version 4 normalizes legacy region-label cardinality to one region label.
5. Version 5 reapplies the corrected normalization to existing annotations.
6. Version 6 creates the source-folder handle store.

Database version numbers describe stores and indexes. Entity schema versions
describe serialized record shapes, while taxonomy, backup, and export versions
describe their own contracts.

Operations spanning related records use explicit transactions. These include
project creation, taxonomy activation, instruction replacement or removal,
project and task deletion, first-draft status changes, submission, source-folder
metadata and handle changes, folder relinking, and backup replacement. Failed
transactions do not report success or retain partial writes.

## Domain and taxonomy ownership

Projects, tasks, annotations, and taxonomy versions use stable UUIDs. Display
names never act as database keys. A task has a stable import position and one
primary media reference independent of its lifecycle status.

Taxonomy uploads preserve the filename, source format, raw text, parsed object,
display metadata, semantic content hash, local version, and timestamp. Replacing
a taxonomy creates or reactivates an immutable version and updates the project's
active reference in the same transaction. The first annotation draft pins its
taxonomy version permanently.

The raw taxonomy editor owns source fidelity. Structured editing uses the same
parser and annotation schema, then serializes supported fields as canonical
YAML after explicit confirmation where source details could be lost.

Annotation documents are independent from WaveSurfer region objects. They own
regions, timestamp markers, clip assignments, notes, revision, submission state,
and the taxonomy pin. Normalization and submission validation live in the domain
layer. Multi-region selection is transient UI state over the document; bulk
changes still create ordinary annotation revisions and autosave through the same
path.

## Media lifecycle

Project creation and manifest import do not request filesystem access or read
audio bytes.

Temporary file and directory selection follows this lifecycle:

1. The browser returns `File` objects after a user gesture.
2. Direct imports validate extension, size, and leading file signature.
3. A session registry maps an opaque locator to each selected file; only the
   locator and portable identity are stored with the task.
4. The annotation route resolves the `File`, creates a short-lived object URL,
   and revokes it when the task changes or the route unmounts.
5. After a restart the session registry is empty, so the user relinks the task.

Persistent folder access follows a separate path. A supported browser returns a
read-only directory handle after **Connect folder**. The handle is stored in the
`sourceFolders` store; the project record stores only its stable ID and display
name. Folder tasks store that ID and a normalized relative path. Permission is
queried without prompting during load and requested only after a user action.
Folder scanning is recursive and extension-based. Resolution traverses the
saved root to obtain the current file.

Per-task relinking validates the selected file and its stored identity, then
uses the session registry. Replacing or forgetting a folder never deletes audio
or annotations. Project and task deletion also performs no filesystem writes.

Audio bytes, decoded PCM, object URLs, waveform peaks, spectrograms, and analysis
results are not written to IndexedDB or OPFS.

## Waveform and audio analysis

The waveform feature creates one WaveSurfer instance with Timeline, Minimap,
Regions, Zoom, Hover, and Spectrogram plugins. WaveSurfer regions and markers are
a generated rendering layer synchronized from serializable state. Completed
edits enter snapshot history; live drag frames do not create separate entries.

One guarded `MediaElementAudioSourceNode` supplies the audible route to the
audio destination. Spectrum and loudness branches are zero-gain analysis taps.
The live loudness worklet and deterministic offline File and Selection rendering
observe the audio without changing playback.

Pointer precedence is implemented in the waveform layer: amplitude scaling,
selected-region nudging or horizontal panning, drag panning, pointer-centered
zoom, and region gestures are resolved before WaveSurfer receives the event.
Keyboard commands are ignored for editable controls and dialogs. Marker
navigation additionally requires waveform focus and returns boundary Tab events
to normal browser focus movement.

## Backup and export architecture

`domain/projectBackup.ts` owns strict parsing, portable normalization, stable
ordering, and serialization of backup version 2. The validator treats imported
JSON as untrusted and checks every entity and relationship before storage sees
it. The repository restores or replaces a project in one transaction across all
six stores. Native handles and permissions are excluded.

`domain/annotationExport.ts` builds schema version 2 JSONL task records and CSV
rows without React or IndexedDB dependencies. JSONL retains the complete
annotation and its pinned taxonomy interpretation. CSV flattens region
assignments, markers, clip assignments, and empty all-task records into explicit
row scopes. See [Data formats](data-formats.md) for the complete contract.

Downloads are generated in memory and handed to a temporary browser object URL.
The application has no upload endpoint.

## Browser security and privacy

- There is no backend, login, telemetry, cloud provider, or application runtime
  upload.
- IndexedDB and directory handles belong to the exact browser profile and
  origin. Browser storage can be blocked, cleared, or evicted.
- Durable storage is a browser decision and remains independent from project
  backup.
- Files and folders are opened only after user gestures. Folder access is
  read-only.
- Markdown raw HTML, images, scripts, iframes, and embedded content are excluded.
  Allowed links can contact an external site only when the user follows them.
- Codec decoding, Web Audio, offline rendering, and File System Access behavior
  remain browser and operating-system boundaries.

## Validation and development conventions

The root `pnpm validate` command runs, in order:

1. Prettier over `web/`, root Markdown, and `docs/**/*.md`
2. ESLint
3. Stylelint over `web/src/**/*.css`
4. TypeScript project checking
5. Vitest
6. A TypeScript and Vite production build

GitHub Actions runs the same gate after `pnpm install --frozen-lockfile` with
Node 22 and pnpm `10.33.0` on pull requests and relevant pushes. Domain and
storage behavior should remain testable without browser UI. Storage tests use
`fake-indexeddb`; audio tests use small synthetic fixtures rather than project
recordings.
