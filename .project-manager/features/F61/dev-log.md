# F61 Dev Log

Append-only chronological log. Newest entry on top.

---

## 2026-06-23 - Kickoff and Spec

### 2.1 Work Tracking

- Created F61 on Development sheet with `npm run feature:kickoff`.
- Feature name: **Agent Runtime Snapshot Root Metadata**.
- Goal: remove F60 home directory inference by returning non-secret root metadata
  from the native snapshot and consuming it in F59 service.
- Risk estimate:
  - Medium: service root precedence must stay deterministic.
  - Medium: sanitizer must preserve root metadata while dropping fixture contents.
  - Low: no external writes, no new UI, no secrets.

### 2.2 Spec / TDD Design

- Wrote feature spec, TDD spec, test scenarios, and this log before implementation.
- Test plan covers snapshot-root fallback, explicit-root precedence,
  sanitization, Rust metadata, UI smoke, and baseline.

### Planned Commands

```bash
npm test -- --run .project-manager/features/F61/tests/agentRuntimeRootMetadata.test.ts
cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot
npm run typecheck
npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime
npm run verify:baseline
```

### 2.3 TDD Cycles

| Cycle | Test | Red reason | Green fix | Result |
| --- | --- | --- | --- | --- |
| 1 | `agentRuntimeRootMetadata.test.ts` | Missing `homeDir` caused scanner `.trim()` runtime error; sanitized snapshot dropped roots | Made service options roots optional, preserved sanitized root metadata, and resolved scan roots from options or snapshot | Green |
| 2 | `cargo test ... agent_runtime_snapshot` | Rust snapshot struct lacked root fields | Added `homeDir` and `projectRoot` metadata to native snapshot | Green |

### Commands Run

```bash
npm test -- --run .project-manager/features/F61/tests/agentRuntimeRootMetadata.test.ts
# Red: 4 failed; service did not support snapshot root fallback

npm test -- --run .project-manager/features/F61/tests/agentRuntimeRootMetadata.test.ts .project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts .project-manager/features/F60/tests/agentRuntimeIntegrationSheet.test.ts
# Green: 9 passed, 0 failed

cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot
# Green: 2 passed, 0 failed

npm run typecheck
# Green

npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime
# Green: Next dev Issues 0
```

### Implementation Summary

| File | Purpose |
| --- | --- |
| `lib/agent-runtime/types.ts` | Adds optional snapshot `homeDir` and `projectRoot`; service callers may omit roots. |
| `lib/agent-runtime/inventoryService.ts` | Resolves scan roots from explicit options or sanitized snapshot metadata. |
| `src-tauri/src/lib.rs` | Returns root metadata from `build_agent_runtime_snapshot` and verifies it in Rust tests. |
| `app/ui/views/Plugins/PluginsHubView.tsx` | Removes F60 home directory inference; Agent Runtime sheet relies on service/native metadata. |
| `.project-manager/features/F61/tests/agentRuntimeRootMetadata.test.ts` | Covers root fallback, explicit precedence, sanitization, and loader failure fallback. |

### Security Notes

- Root metadata is path metadata only.
- Sanitizer still drops fixture-only `fileContents`.
- Rust tests confirm fake secret strings are not serialized.

### Final Verification

```bash
npm run verify:baseline
# PASS
# Vitest: 1529 passed, 1 skipped
# Cargo check: passed
# Static build: passed
```

- Manual UI smoke: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed with Next dev Issues 0.
- Playwright Chromium smoke passed with Agent Runtime content present, read-only/diagnostic text present, runtime rows present, and console/page errors 0.
- Build warnings observed from existing `app/api/integrations/scan-applications/route.ts` Turbopack tracing behavior; baseline still passed and F61 did not touch that route.

### Coverage Summary

| Layer | Coverage | Result |
| --- | --- | --- |
| Unit TS | Service uses snapshot `homeDir` when caller omits `homeDir`. | Pass |
| Unit TS | Explicit `homeDir` takes precedence over snapshot `homeDir`. | Pass |
| Unit TS | Root metadata remains while fixture `fileContents` and fake secret values are dropped. | Pass |
| Unit TS | Loader failure still returns deterministic fallback rows and diagnostic. | Pass |
| Unit Rust | Native snapshot serializes `homeDir`/`projectRoot` and excludes fake secrets. | Pass |
| UI smoke | Agent Runtime sheet remains clean after removing home-dir inference. | Pass |

### Remaining Risks / Next Step

- Future metadata additions must remain path-only unless an ADR explicitly widens the contract.
- Next slice can add a row detail panel for runtime evidence, MCP preview, session roots, and cost readiness using the now-stable root metadata.
