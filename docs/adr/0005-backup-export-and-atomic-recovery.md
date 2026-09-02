# ADR 0005: Versioned portability formats and atomic recovery

- Status: Accepted
- Date: 2026-09-01

## Context

Browser-profile IndexedDB is durable application storage but is not a backup.
Projects need portable recovery without copying large source-audio collections,
and annotations need stable dataset outputs that remain interpretable after a
taxonomy changes.

## Decision

Use `audio-annotation-workbench-project` backup format version 1 for a complete
single-project JSON envelope. The format version is independent from IndexedDB
version 4 and from each persisted entity's schema version. The envelope contains
the project, every immutable taxonomy version including raw source, optional
Markdown instructions, tasks, and all draft and submitted annotations.

Serialize taxonomy versions by project-local version, tasks by stable queue
order, and annotations by task and annotation ID. Treat imported JSON as
untrusted. Enforce a 10 MB input limit and reject unknown envelope fields,
unsupported format or entity versions, duplicate IDs, invalid dates and values,
missing active taxonomy, cross-project links, missing task or taxonomy
references, multiple annotations for one task, and assignments incompatible
with their pinned taxonomy.

Do not export audio bytes, object URLs, filesystem handles, permissions,
absolute filesystem paths, waveform peaks, spectrograms, or analysis state.
Convert task media to unresolved references and retain only safe relative
identity and display information. Restoration therefore reports every task as
requiring media relinking.

Restore an already validated backup in one read/write transaction across all
five stores. Preserve the original project ID. A collision fails by default and
requires explicit user confirmation. Confirmed replacement deletes only records
scoped to that project and inserts the backup in the same transaction. Any
constraint or write failure aborts the complete operation.

Use annotation export schema version 1 for both outputs. JSONL contains one task
record with a nullable annotation and pinned-taxonomy label interpretation.
Flattened CSV contains one row per region or clip assignment with stable
columns. All-task mode emits a task-only row when a task has no assignments;
submitted-only mode includes only submitted annotations. Canonical metadata,
task order, region order, and assignment order make repeated exports comparable.

## Consequences

- Backups are compact and reviewable but intentionally do not make audio
  collections self-contained.
- Restore does not merge projects or remap IDs; collision behavior is explicit
  and predictable.
- Existing stores and indexes are sufficient, so the IndexedDB version remains
  4.
- JSONL preserves nested annotation fidelity while CSV favors analysis-tool
  interoperability.
- Future incompatible envelope or export changes require new format versions;
  entity evolution remains independently versioned.
