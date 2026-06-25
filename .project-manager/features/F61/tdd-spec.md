# F61 TDD Spec: Agent Runtime Snapshot Root Metadata

## Strategy

Use focused TypeScript tests for the service contract first, then Rust tests for
native metadata. Keep UI changes minimal and verify through the existing F60
route smoke.

## Test Layers

| Layer | File / Command | Purpose |
| --- | --- | --- |
| Unit TS | `.project-manager/features/F61/tests/agentRuntimeRootMetadata.test.ts` | Service root fallback, explicit precedence, sanitization. |
| Unit Rust | `cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot` | Native root metadata and secret exclusion. |
| Typecheck | `npm run typecheck` | Optional service roots and UI call compile. |
| UI smoke | `/integrations-hub/agent-runtime` | Confirm route still renders with no dev issues. |
| Baseline | `npm run verify:baseline` | Repo-wide completion gate. |

## TDD Cycles

### Cycle 1: Snapshot Root Fallback

**Given** caller omits `homeDir` and snapshot includes `homeDir`.  
**When** `loadAgentRuntimeInventory()` runs.  
**Then** scanner expands catalog paths using snapshot `homeDir`.

Expected Red: service requires or uses explicit `homeDir`, producing missing rows
or a runtime error.

### Cycle 2: Explicit Root Precedence

**Given** caller provides `homeDir` and snapshot includes a different `homeDir`.  
**When** service scans.  
**Then** explicit `homeDir` wins.

Expected Red: service blindly uses snapshot root.

### Cycle 3: Sanitization

**Given** snapshot includes `fileContents` and root metadata.  
**When** service result is serialized.  
**Then** root metadata remains but fake secret values and `fileContents` are absent.

Expected Red: sanitizer may need to preserve roots while dropping contents.

### Cycle 4: Native Metadata

**Given** Rust helper receives home/project roots.  
**When** it builds a snapshot.  
**Then** serialized snapshot includes root metadata and excludes fake secrets.

Expected Red: Rust struct lacks root fields.

## Quantified Acceptance

| Command | Pass Criteria |
| --- | --- |
| `npm test -- --run .project-manager/features/F61/tests/agentRuntimeRootMetadata.test.ts` | All F61 focused tests pass. |
| `cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot` | Rust agent runtime snapshot tests pass. |
| `npm run typecheck` | exits 0. |
| `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` | exits 0. |
| `npm run verify:baseline` | exits 0 before marking done. |
