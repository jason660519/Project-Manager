# F45 - Tiered Verification Workflow

## Summary

Split Project Manager's AI shipping verification into clearer tiers so routine
development and commit preparation can run targeted checks, while PR landing
still gets a full merged-state baseline and Company Standards can own scheduled
governance scans.

## Current State

- Status: completed
- Progress: 100%
- Phase: done
- Category: Engineering Workflow
- Owner: Codex
- Created: 2026-06-04

## Scope

- Add a quick verification entrypoint for changed-file workflows.
- Keep `verify:baseline` as the final PR/main safety gate.
- Document which checks are local diff blockers, PR blockers, or scheduled
  governance checks.
- Update the ship and verification guidance so AI engineers stop repeating full
  baseline at every git step.
- Record verification evidence in `dev-log.md`.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Removing CI baseline protection for PRs or pushes to `main`.
- Automating real Chrome/Safari/Tauri manual smoke in this slice.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
