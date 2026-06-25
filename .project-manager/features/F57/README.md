# F57 - Agent Environment Scanner Foundations

## Summary

Build the first read-only foundation for Project Manager's agent runtime inventory,
inspired by CC Switch but scoped to PM's local-first architecture. F57 detects
local agent tool environments, normalizes their config/session/MCP/skills
surfaces, and exposes a typed inventory contract for future Agent Runtime, MCP,
Skills, Session, and Cost modules.

## Current State

- Status: done
- Progress: 100%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23
- Completed: 2026-06-23

## Today Scope

- Define the F57 spec and TDD plan before implementation.
- Implement a pure TypeScript read-only scanner contract under `lib/agent-runtime`.
- Detect known agent tools from explicit filesystem snapshots without touching
  real external config during unit tests.
- Normalize support for Codex, Claude Code, Gemini CLI, OpenCode, OpenClaw, and
  Hermes Agent.
- Record all test assets under `.project-manager/features/F57/tests/`.

## Non-Goals

- No provider key handling.
- No writes to `~/.codex`, `~/.claude`, `~/.gemini`, OpenCode, OpenClaw, or Hermes config.
- No local proxy, router, or failover implementation.
- No UI table in this slice.
- No schemaVersion bump to `.project-manager/config.json`.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Tests: `tests/agentEnvironmentScanner.test.ts`
- Dev log: `dev-log.md`

## Verification

- `npm test -- --run .project-manager/features/F57/tests/agentEnvironmentScanner.test.ts` - 9 passed
- `npm run typecheck` - passed
- `npm run verify:baseline` - PASS
- Manual UI smoke - not applicable; F57 has no UI route changes
