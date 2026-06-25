# F78 Feature Spec - Agent Runtime Session Target Hydration

## Problem Definition

F77 exposes a safe native target lister and F76 can render redacted target
candidates, but Integration Hub does not yet connect those pieces. Agent Runtime
rows therefore still rely on optional pre-existing metadata.

## In Scope

- Add `hydrateAgentRuntimeRowsWithSessionTargets`.
- For each Agent Runtime row:
  - find existing `sessions-root` paths from `payload.agentRuntime.paths`
  - call injected lister with `{ approved: true, rootPaths, maxTargets, maxDepth }`
  - store `result.targets` into `payload.agentRuntime.sessionTargets` when ready
  - append a diagnostic when the lister blocks or throws
- Wire `PluginsHubView.loadAgentRuntime` to hydrate mapped rows.
- Keep display safety: never turn target filenames into row notes, badges, or
  visible summaries.

## Out of Scope

- Recursive indexing policy changes.
- Persisting target lists.
- Rendering transcript content.
- Additional UI controls.
- Tauri command changes.

## User Value

After Agent Runtime refresh, rows can carry redacted target candidates into the
existing F76 selector. Users no longer need to rely on pasted paths once native
metadata is available.

## Success Metrics

- Hydration calls the lister only for rows with existing session roots.
- Ready lister results populate `payload.agentRuntime.sessionTargets`.
- Blocked/thrown lister results preserve rows and create diagnostics.
- Display-facing row fields do not contain target filenames or unsafe fixture
  strings.
- Full verification baseline passes before completion.

## Dependencies and Constraints

- Reuses F77 `listAgentRuntimeRedactedSessionTargets`.
- Reuses F76 `sessionTargets` payload contract.
- Does not call raw `invoke()` from React components.
- Must maintain zero silent failures with diagnostics.
