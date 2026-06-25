# F62 - Agent Runtime Detail Panel

## Summary

Add a read-only detail panel for Agent Runtime rows in Integrations Hub so users
can inspect runtime evidence for Agent Runtime / MCP / Skills / Session / Cost
readiness without opening raw files or exposing secrets to the renderer.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-22

## Scope

- Create a typed detail model for `agent-runtime` integration rows.
- Render that model in `IntegrationsDetailSheet` as read-only local metadata.
- Surface command availability, capability readiness, path evidence, warnings,
  diagnostics, and loaded timestamp.
- Keep all evidence metadata-only: paths and booleans are allowed, file contents
  and secret values are not.
- Add focused tests before implementation and record Red / Green / Refactor
  evidence in `dev-log.md`.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.
- Runtime config editing, command execution, MCP server lifecycle controls, or
  cost calculation logic.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
