# F61: Agent Runtime Snapshot Root Metadata

## Problem Definition

F60 made Agent Runtime inventory visible in Integrations Hub, but the UI had to
infer the user's home directory from the repo/project root so F57 path expansion
could match F58 absolute path evidence. That inference is brittle.

The native snapshot builder already resolves `HOME` and project root. It should
return those non-secret roots as metadata, and the TypeScript inventory service
should use them when callers omit roots.

## User Value

| User | Value |
| --- | --- |
| PM operator | Sees more accurate Agent Runtime readiness rows without manual config. |
| Engineer | Gets a cleaner service contract that does not require UI callers to guess OS roots. |
| Security reviewer | Can verify only non-secret path roots are returned; no file contents or keys. |

## In Scope

1. `lib/agent-runtime/types.ts`
   - Add optional `homeDir` and `projectRoot` to `AgentRuntimeFilesystemSnapshot`.
   - Make `AgentRuntimeInventoryServiceOptions.homeDir` optional.
2. `lib/agent-runtime/inventoryService.ts`
   - Load snapshot first.
   - Resolve scan roots from explicit options, snapshot metadata, or safe empty fallback.
   - Preserve snapshot sanitization by omitting `fileContents`.
3. `src-tauri/src/lib.rs`
   - Add `home_dir` and `project_root` to serialized snapshot.
   - Include roots in helper/command return values.
   - Extend Rust tests to prove roots are returned and secret contents are not.
4. `app/ui/views/Plugins/PluginsHubView.tsx`
   - Stop inferring home dir for Agent Runtime sheet.
5. `.project-manager/features/F61/tests/agentRuntimeRootMetadata.test.ts`
   - Cover service fallback to snapshot roots, explicit root precedence, and secret-boundary behavior.

## Out of Scope

- No new route or table.
- No changes to MCP/Skills/Session/Cost parsing.
- No keychain or provider key handling.
- No schemaVersion changes.

## Security Contract

- `homeDir` and `projectRoot` are path metadata, not file contents.
- Snapshot may return secret-bearing file paths, but never reads or returns contents.
- TypeScript service must not copy fixture-only `fileContents` into service results.
- UI must call the service and not raw Tauri `invoke()`.

## Acceptance Criteria

1. `loadAgentRuntimeInventory()` works when caller omits `homeDir` and snapshot contains `homeDir`.
2. Explicit `homeDir` option takes precedence over snapshot metadata.
3. Browser fallback snapshot still works with empty roots.
4. Rust snapshot includes `homeDir` and resolved `projectRoot` metadata.
5. Fake secret values do not appear in serialized service or Rust snapshot output.
6. F60 Agent Runtime sheet no longer uses home-dir inference.
