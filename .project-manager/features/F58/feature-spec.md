# F58: Agent Runtime Tauri Snapshot Builder

## Problem Definition

F57 introduced a pure TypeScript scanner over an injected
`AgentRuntimeFilesystemSnapshot`. It deliberately avoids real filesystem reads
so client code cannot accidentally inspect local files or secret material. To
make the scanner useful in the desktop app, Project Manager needs a Tauri/Rust
boundary that builds that snapshot safely.

## User Value

| User | Value |
| --- | --- |
| PM operator | Future inventory UI can reflect real local agent tool readiness. |
| Engineer | Gets a single bridge entrypoint instead of ad hoc filesystem reads in React. |
| Security reviewer | Can inspect one Rust command and confirm it returns metadata only. |

## In Scope

1. `src-tauri/src/lib.rs`
   - Add serializable `AgentRuntimeFilesystemSnapshot`.
   - Add helper functions to collect known path existence and command evidence.
   - Add `#[tauri::command] build_agent_runtime_snapshot(project_root: Option<String>)`.
   - Register the command in `tauri::generate_handler!`.
   - Add Rust unit tests for command/path evidence and secret content exclusion.
2. `lib/bridge/index.ts`
   - Add typed wrapper `buildAgentRuntimeSnapshot(projectRoot?: string)`.
   - Return an empty snapshot outside Tauri.
3. `src-tauri/capabilities/default.json`
   - Add capability permission for the new command.
4. `.project-manager/features/F58/tests/agentRuntimeSnapshotBridge.test.ts`
   - Verify browser fallback and exported shape.

## Out of Scope

- UI.
- Running F57 scanner inside Rust.
- Reading file contents.
- Parsing auth, env, TOML, JSON, YAML, sessions, or logs.
- Writing or syncing external tool configs.
- Provider key handling.

## Data Flow

```text
Tauri command build_agent_runtime_snapshot
  -> AgentRuntimeFilesystemSnapshot { existingPaths, availableCommands }
  -> bridge buildAgentRuntimeSnapshot()
  -> future scanAgentEnvironment(snapshot, { homeDir, projectRoot })
```

## Security Contract

- The command may call `Path::exists()` / `is_file()` / `is_dir()`.
- The command may inspect PATH command availability.
- The command must not call `read_to_string`, `read`, TOML/JSON parsers, or any
  keychain APIs.
- Returned JSON must contain paths and command names only.
- Secret-bearing paths like `auth.json`, `.env`, `settings.json`, and
  `config.yaml` may appear as paths when present; their contents must never
  appear.

## Acceptance Criteria

1. `build_agent_runtime_snapshot` is registered, wrapped, and permissioned.
2. Browser mode wrapper returns `{ existingPaths: [], availableCommands: [] }`.
3. Rust helper tests prove existing path detection without content reads.
4. Rust helper tests prove command availability is deterministic with injected
   test PATH directories.
5. Focused TS and Rust tests pass.
6. Full `npm run verify:baseline` passes before completion.
