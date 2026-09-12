# Application redesign

Continue the editor's warm white/slate surfaces, cornflower-blue actions,
orange attention accents, compact controls, and visible keyboard focus.
Use two increments, pausing for user permission after each. Do not commit
without explicit permission. Commit subjects follow `refactor(css): …`.

Typography uses the existing sans-serif stack throughout the interface, with
tabular numerals for steady timing and numeric alignment. Monospace is reserved
for code and raw YAML/Markdown editing through the `--font-code` token. This
global refinement also covers canvas-rendered spectrum labels. Completion
readouts have explicit baseline spacing; confirmation dialogs separate the
input from actions and scroll within short viewports.

## 1. Project workspace — implemented

Project library, project detail, and the shared navigation/control foundations.
The library becomes searchable, sortable rows with progress. Project detail
separates Tasks, Reference, and Data through URL-backed section navigation.
Tasks get the full available width; import is contextual, selection actions are
grouped, and exports/project administration live in Data. Retain all existing
domain, storage, annotation, versioning, and confirmation behavior.

## 2. Setup and authoring — awaiting permission after increment 1

Project creation and settings, shared import/form composition, taxonomy editor
(structured and source editing, scales, validation, version history), Markdown
instructions editor (editing, preview, unsaved changes), and backup restoration.
Finish the light-theme migration and verify cross-route consistency, responsive
behavior, focus, dialogs, loading/empty/error states, and the editor handoff.

## Increment 1 decisions

No global sidebar: Projects and Editor remain the two product destinations.
Project-specific sections use a compact horizontal navigation. Operational
counts precede the task queue; stable IDs and creation dates belong to Data.
Reference retains active taxonomy, immutable history, and rendered instructions.
Storage durability and backups remain visible in the library's local-storage
notice without displacing the project list. Setup/authoring bodies retain their
current theme until increment 2; light tokens are scoped to migrated routes and
inherit into their dialogs. Shared buttons use semantic tokens in both themes.

Two deliberate behavior corrections accompany the layout changes: pagination
clamps to the last remaining page after task deletion, and download failures
remain visible instead of being overwritten by a success message.

## Increment 1 verification

- `pnpm validate`: formatting, ESLint, Stylelint, TypeScript, 199 tests across
  46 files, and the production build. Existing taxonomy specificity and
  WaveSurfer browser-externalization warnings remain outside this increment.
- Isolated Playwright with synthetic local audio: project search/sorting,
  archive filtering, durability request, task search/status filters, import,
  bulk skip/restore/delete, deletion confirmation and pagination, reference
  navigation/reload, backup contents, JSONL/CSV export, project archive/restore,
  and editor relinking, region/marker creation, submission, and reopening.
- Desktop and 1024/768/390/320 px layouts, screenshot review and refinement,
  automated accessibility checks, keyboard dropdown selection, visible focus,
  confirmation Escape/focus return, dialog focus containment, and empty states.

No commits or pushes were made. Increment 2 requires explicit user approval.
