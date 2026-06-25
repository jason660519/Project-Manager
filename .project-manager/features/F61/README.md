# F61 - Agent Runtime Snapshot Root Metadata

## Summary

Return non-secret `homeDir` and `projectRoot` metadata from the Agent Runtime
native snapshot and let the inventory service consume those roots. This removes
the F60 UI's best-effort home directory inference while preserving the read-only
security boundary.

## Current State

- Status: done
- Progress: 100%
- Phase: development
- Category: Agent Runtime
- Owner: Codex
- Created: 2026-06-23
- Completed: 2026-06-23

## Scope

- Extend `AgentRuntimeFilesystemSnapshot` with optional `homeDir` and `projectRoot`.
- Return root metadata from `build_agent_runtime_snapshot`.
- Let `loadAgentRuntimeInventory()` use snapshot roots when caller roots are omitted.
- Remove F60 UI home directory inference.
- Keep snapshot content limited to paths, commands, and non-secret roots.

## Non-Goals

- No secret values.
- No external agent config writes.
- No session or cost parsing.
- No new UI surface.
- No schemaVersion change.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
- Test: `tests/agentRuntimeRootMetadata.test.ts`

## Verification

- `npm test -- --run .project-manager/features/F61/tests/agentRuntimeRootMetadata.test.ts .project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts .project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts` - 9 passed, 0 failed.
- `cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot` - 2 passed, 0 failed.
- `npm run typecheck` - passed.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` - passed, Next dev Issues 0.
- Playwright Chromium smoke for `/integrations-hub/agent-runtime` - passed, console/page errors 0.
- `npm run verify:baseline` - passed; Vitest 1529 passed / 1 skipped, Cargo check passed, static build passed.
