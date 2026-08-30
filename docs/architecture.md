# Frontend architecture

Audio Annotation Workbench is a browser-only React application with two current
product layers: durable project management and the transitional standalone audio
editor. No project or audio data is sent over a network.

## Application boundaries

- `domain/` contains versioned project, taxonomy, instructions, task, and media
  reference types plus framework-independent calculations and validation.
- `storage/` owns the IndexedDB schema, upgrades, repository, transactions, and
  browser storage durability checks.
- `features/projects/` owns project queries, actions, and routed screens.
- `features/waveform/` owns WaveSurfer lifecycle, official plugins, pointer
  gestures, waveform/spectrogram viewport synchronization, and teardown.
- `features/analysis/` owns the guarded shared Web Audio graph and its single
  media-element source.
- `features/spectrum/` and `features/loudness/` own observational analysis.
- `App.tsx` remains the standalone editor shell. `RouterApplication.tsx` owns
  URL routing and mounts it only at `/editor`.

Persistent domain state, URL state, form state, and ephemeral waveform state do
not share one global store. Focused hooks load repository data and guard against
stale async updates. Forms prepare and validate files before repository writes.

## Routing

React Router provides `/`, `/projects`, `/projects/new`, project detail and edit
paths, and `/editor`. Navigation uses links and route parameters rather than
component-local page state. Unknown routes and missing IndexedDB projects render
distinct states. Browser back and forward navigation follows URL history.

Development routing uses Vite's application fallback. A production static host
must route application paths to `index.html`.

## IndexedDB ownership

Database `audio-annotation-workbench`, version 2, contains `projects`,
`taxonomyVersions`, `instructions`, and `tasks`. Database access is confined to
`storage/`; React components do not open stores or transactions.

The database upgrade callback applies migrations in ascending version order.
Version 1 creates:

- projects by stable UUID, with status and update-time indexes
- immutable taxonomy versions by UUID, project, and project-local version
- one optional instruction record per project
- task records by UUID, project, project/status, project/update time, and
  project-relative source path (added by the forward version-2 migration)

All record models carry centralized schema versions independently from the
IndexedDB schema version. Database versions describe physical storage changes;
record schema versions describe serialized domain shapes.

Operations that must preserve cross-store integrity are transactional:

- project + initial taxonomy + optional instructions creation
- taxonomy version creation + active project reference update
- instruction replacement/removal + project reference update
- project + associated taxonomy, instructions, and task deletion

Creation aborts without partial records. Deletion uses project-scoped indexes and
never performs filesystem operations.

## Project and taxonomy model

A project UUID is independent from its mutable display name. Projects record
active/archive state, active taxonomy version, optional instructions reference,
and ISO 8601 created/updated timestamps.

Taxonomy versions preserve the source filename, JSON/YAML format, original text,
parsed object, extracted `name` and `schema_version` metadata, SHA-256 content
hash, local version number, and created timestamp. Updating a taxonomy appends a
record and changes the active reference; it never rewrites history. A matching
project content hash suppresses duplicate versions.

Detailed label semantics are deferred until annotation integration. This avoids
locking the persistence format to an unvalidated taxonomy contract.

## Markdown security

Instruction uploads accept `.md` files up to 512 KB and preserve raw Markdown.
`react-markdown` creates React elements without enabling raw HTML parsing. The
renderer uses an explicit element allowlist, excludes images and executable
embeds, filters link protocols, and adds `noopener noreferrer` to links opened in
new tabs. A rendering error boundary shows an explicit failure without changing
the stored source.

## Task and media-source foundation

Task ingestion parses JSON/JSONL manifests and browser-selected audio file
lists without reading audio bytes. Pure normalization and import planning detect
unsafe paths, duplicates, conflicts, and unresolved sources before atomic task
writes. Task media references preserve only a safe relative identity and, where
available, browser file handles; fallback selections are session-only. Relinking
requires a matching relative identity unless a replacement is explicitly allowed.

Media references describe file-handle, external, and unresolved states without
storing audio bytes. The adapter contract separates capability detection,
permission query/request, and file resolution. Future browser handle, fallback,
companion-service, or desktop adapters can implement this contract without
changing tasks or projects.

Project creation does not request filesystem access. Audio is never copied to
IndexedDB or OPFS.

## Waveform and analysis ownership

The standalone editor owns selected `File` objects and revocable object URLs.
WaveSurfer region instances remain a rendering layer; serializable region
metadata and snapshot history stay separate.

The waveform creates one WaveSurfer instance and uses official Timeline,
Minimap, Regions, Zoom, Hover, and Spectrogram plugins. Pure synchronization
modules coordinate scrolling and spectrogram geometry. The existing keyboard and
pointer precedence is documented in `interaction-model.md`.

One guarded `MediaElementAudioSourceNode` supplies a direct audible route and
zero-gain spectrum/loudness taps. Loudness worklet processing and deterministic
offline file/selection rendering remain observational and never modify playback.

## Browser limitations

- IndexedDB is browser-profile storage and can be unavailable, blocked, cleared,
  or evicted.
- Durable storage requests are browser decisions, not backup guarantees.
- File System Access API capability and persistent handle permissions vary by
  browser.
- Codec, Web Audio, worker, and offline rendering support remain browser and
  operating-system dependent.
- Large decoded audio and offline analysis can consume substantial memory even
  though source audio is not persisted.

## Validation

`pnpm validate` runs Prettier checking, ESLint, strict TypeScript, Vitest, and the
Vite production build. Tests cover the IndexedDB schema and transactions, project
lifecycle, taxonomy parsing/hashing/versioning, instruction security and
lifecycle, progress derivation, routes, and the existing editor domain and
analysis behavior.
