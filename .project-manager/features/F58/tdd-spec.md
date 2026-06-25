# F58 TDD Spec - Agent Runtime Tauri Snapshot Builder

## Test Strategy

| Layer | Location | Purpose |
| --- | --- | --- |
| Unit TS | `.project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts` | Browser fallback and wrapper export |
| Unit Rust | `src-tauri/src/lib.rs` `#[cfg(test)]` | Snapshot helper path/command evidence and no content return |
| Integration | Existing `cargo check` / Tauri command registration | Compile command registration |
| E2E | Deferred | Future UI smoke |

## Scenarios

### S1 Browser fallback

**Given** code runs outside Tauri  
**When** `buildAgentRuntimeSnapshot()` is called  
**Then** it returns empty `existingPaths` and `availableCommands`.

### S2 Rust path evidence

**Given** a temp home/project root with known agent paths created  
**When** helper builds a snapshot from injected roots  
**Then** the snapshot includes existing paths  
**And** it does not include file contents.

### S3 Rust secret boundary

**Given** `auth.json` and `.env` contain fake key strings  
**When** helper builds a snapshot  
**Then** serialized snapshot includes file paths  
**And** it does not include fake key strings.

### S4 Command availability

**Given** a temp PATH directory with executable `codex`  
**When** helper checks known commands  
**Then** `codex` is present and missing commands are absent.

### S5 Bridge discipline

**Given** AGENTS.md requires typed wrapper and capability entry  
**When** the command is added  
**Then** `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, and
`src-tauri/capabilities/default.json` are updated together.

## Commands

```bash
npm test -- --run .project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts
cargo test --manifest-path src-tauri/Cargo.toml agent_runtime_snapshot
npm run typecheck
npm run verify:baseline
```
