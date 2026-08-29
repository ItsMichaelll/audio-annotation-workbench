# ADR 0001: Dedicated React and WaveSurfer frontend

- Status: Accepted
- Date: 2026-08-29

## Context

The product needs DAW-like waveform navigation, precise temporal editing, and a configurable annotation model. The first milestone exists specifically to validate interaction quality before committing to storage, taxonomy, or collaboration architecture.

## Decision

Build a dedicated React and TypeScript frontend with WaveSurfer.js v7 and official plugins. Load local audio with browser object URLs. Keep domain state independent from WaveSurfer rendering objects.

## Why not fork Label Studio

Label Studio is a broad data-labeling platform whose application structure, terminology, and persistence model are larger than this navigation experiment requires. A fork would make core pointer and keyboard behavior harder to own, introduce unrelated infrastructure, and couple the project to another product's release and extension model.

## Consequences

The workbench can shape its interaction model directly and remain a small standalone public project. It must implement its own future configuration, persistence, import/export, and collaboration boundaries; those are intentionally deferred until navigation ergonomics are validated.

