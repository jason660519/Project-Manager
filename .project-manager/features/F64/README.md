# F64 - Agent Runtime Session Import Preview

## Summary

Add a metadata-only Session Import Preview for Agent Runtime rows. The preview
lists session-root candidates, whether any root is importable, and why import is
blocked when evidence is missing. It does not read transcript files or parse
session contents.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Create a pure TypeScript session import preview helper under `lib/agent-runtime`.
- Reuse Agent Runtime path observations and capability flags from F57-F63.
- Wire the preview into Agent Runtime detail model Session group details.
- Render detail group preview lines in the existing read-only detail panel.
- Record Red / Green / Refactor and verification evidence in `dev-log.md`.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Reading session files, importing transcripts, writing ledgers, cost
  calculation, or adding Tauri bridge commands.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
