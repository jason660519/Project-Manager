# F58 Dev Log

Append-only chronological log. Newest entry on top.

---

## 2026-06-23 - Kickoff and Spec

### 2.1 Work Tracking

- Created F58 on Development sheet with `npm run feature:kickoff`.
- Feature name: **Agent Runtime Tauri Snapshot Builder**.
- Goal: add a safe Rust snapshot builder for F57's pure scanner.
- Risk estimate:
  - Medium: adding a Tauri command must satisfy bridge wrapper + capability discipline.
  - Medium: filesystem metadata scans must not become content parsing.
  - Low: no UI and no external writes.

### 2.2 Spec / TDD Design

- Wrote feature spec, TDD spec, test scenarios, and this log.
- Test plan covers browser fallback, Rust path evidence, secret boundary,
  command availability, and bridge discipline.

### 2.3 TDD Cycles

| Cycle | Test | Red reason | Green fix | Result |
| --- | --- | --- | --- | --- |
| 1 | `agentRuntimeSnapshotBridge.test.ts` | `buildAgentRuntimeSnapshot` wrapper did not exist | Added typed bridge wrapper with browser fallback | Green |
| 2 | `cargo test ... agent_runtime_snapshot` | Capability entry referenced an undefined permission | Generated `src-tauri/permissions/build-agent-runtime-snapshot.json` and kept capability entry | Green |
| 3 | Rust helper tests | Snapshot helper did not exist | Added metadata-only snapshot helper and command registration | Green |

### Commands Run

```bash
npm test -- --run .project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts
# Red: buildAgentRuntimeSnapshot is not a function

npm test -- --run .project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts
# Green: 1 passed, 0 failed

cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot
# Red: Permission build-agent-runtime-snapshot not found

cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot
# Green: 2 passed, 0 failed

npm run typecheck
# Green
```

### Implementation Summary

| File | Purpose |
| --- | --- |
| `src-tauri/src/lib.rs` | Added `build_agent_runtime_snapshot`, metadata-only helper, handler registration, and Rust tests. |
| `src-tauri/permissions/build-agent-runtime-snapshot.json` | Defines the custom permission allowing only `build_agent_runtime_snapshot`. |
| `src-tauri/capabilities/default.json` | Grants the new permission to the main window. |
| `lib/bridge/index.ts` | Adds typed `buildAgentRuntimeSnapshot()` wrapper. |
| `.project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts` | Verifies browser fallback snapshot shape. |

### Security Notes

- The Rust helper uses path existence and PATH command checks only.
- It does not read file contents, parse config files, or access keychain APIs.
- Fake secret strings in Rust tests do not appear in serialized snapshot output.

### Final Verification

```bash
npm run verify:baseline
# PASS
# Vitest: 1517 passed, 1 skipped
# Cargo check: passed
# Static build: passed
```

- Manual UI smoke: not applicable; no UI, routing, localStorage, or client-rendered view changed.
- Build warnings observed from existing `app/api/integrations/scan-applications/route.ts` Turbopack tracing behavior; baseline still passed and F58 did not touch that route.

### Coverage Summary

| Layer | Coverage | Result |
| --- | --- | --- |
| Unit TS | Bridge browser fallback returns an empty snapshot and does not call Tauri in non-Tauri tests. | Pass |
| Unit Rust | Existing known home/project paths are reported as metadata. | Pass |
| Unit Rust | Fake secret contents are not present in serialized snapshot output. | Pass |
| Unit Rust | Injected PATH command evidence is deterministic. | Pass |
| Integration | Tauri command is registered and custom permission resolves during Cargo validation. | Pass |

### Remaining Risks / Next Step

- Keep the Rust path catalog aligned with `lib/agent-runtime/toolCatalog.ts` as new agent runtimes are added.
- Next slice should wire the snapshot builder into a feature-level service that combines F57 scanner output with F58 native evidence for Session and Cost UX.
