# F44 - Execution Policy Integration

## Summary

Unify **Integrations Hub CLI exposure**, **AI Assistant Permissions** (`tool:run_command`), and **Terminal Operational Boundaries** (whitelist/blacklist) into one evaluation path for Company Standards gate runs and documented operator surfaces. **Revert F43** `skipSystemCliInventoryCheck` bypass.

## Current State

- Status: in_progress
- Progress: 10% → updated in dev-log after implementation
- Phase: development
- Category: Security/Platform
- Owner: Cursor
- Created: 2026-06-03

## Scope

- `lib/companyStandards/executionPolicy.ts` — layered policy evaluation + remediation hints
- Update `spawnStandardsGate.ts` — no System CLI bypass; call policy first
- Remove `skipSystemCliInventoryCheck` from `spawnAgent` options
- i18n + Company Standards UI messages per policy layer
- `docs/guides/features/execution-policy.md` + cross-links (integrations-hub, ai-assistants, company-standards)
- F43 spec/dev-log note: gates use F44 policy stack

## Non-Goals

- Replacing F41 terminal boundary editor
- Auto-enabling `npm` without user action in Integrations Hub
- Full F35 runtime adapter work
- Project `.project-manager.json` schema bump for assistant permissions (console localStorage remains source for v1)

## Related Features

| ID | Role |
| --- | --- |
| F41 | Terminal whitelist/blacklist (done) |
| F43 | Standards gate Run UI (wire to F44 policy) |
| F35 | Workflow / AI Engineer control plane (future: same policy helper) |

## Artifacts

- `feature-spec.md`, `tdd-spec.md`, `test-scenarios.md`, `dev-log.md`
