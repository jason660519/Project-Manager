# F63 - Agent Runtime Session Cost Evidence Summary

## Summary

Add a metadata-only Session/Cost summary helper for Agent Runtime rows. The
helper turns existing scanner evidence into a typed readiness contract for
session roots and future cost ledger work without reading transcript contents,
token files, or secret-bearing config.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Create a pure TypeScript Session/Cost summary model under `lib/agent-runtime`.
- Cover normal, boundary, unsupported, abnormal, and security scenarios with
  feature-local tests before implementation.
- Reuse the summary in the Agent Runtime detail model so Session and Cost groups
  have consistent wording.
- Record Red / Green / Refactor and verification evidence in `dev-log.md`.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Reading session transcript files, parsing provider usage ledgers, calculating
  actual cost, or storing billing history.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
