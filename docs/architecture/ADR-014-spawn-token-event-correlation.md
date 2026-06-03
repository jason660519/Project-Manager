# ADR-014: Spawn-Token Agent Event Correlation

> **Created Date**: 2026-06-04
> **Created By**: Claude
> **Last Modified**: 2026-06-04
> **Modified By**: Claude
> **Status**: Accepted
> **Decision Maker**: Jason
> **Related**: [ADR-013 - Agent Workflow DAG Control Plane](./ADR-013-agent-workflow-dag-control-plane.md), [Runtime Bridge](../engineering/runtime-bridge.md)

## Background

`spawn_agent` (`src-tauri/src/lib.rs`) launches an agent/IDE process and emits
`agent-stdout` / `agent-stderr` / `agent-exit` events to the renderer. Until now
every event was keyed by the OS PID, and every renderer consumer
(`app/ui/MainClient.tsx` gate orchestration, the dispatch modals, `chatAgent`,
cron) correlated events to a run by that PID.

OS PIDs are reused by the kernel, and `agent-exit` can arrive **before** the
renderer learns the PID from `invoke('spawn_agent')` (Rust starts the
exit-emitting task before the command returns). This created an irreducible
race: a dispatch process exiting in the tiny window before a standards-gate
process is spawned could have its PID reused by the gate, replaying a stale exit
code onto the gate run. The race was raised repeatedly on PR #15 (Codex P2,
thread r3349346058). A TypeScript-side mitigation (`gateSpawnPendingRef` +
`onBeforeNativeSpawn` capture window) narrowed the window but could not close
it, because correlation was still fundamentally PID-based.

## Decision

Rust issues a **process-unique, monotonically increasing `spawnToken`** (`u64`,
from a global `AtomicU64` starting at 1) per `spawn_agent` call. The token is
returned alongside the PID and stamped onto every emitted event. The renderer
correlates events to runs **by token, never by PID**.

1. `spawn_agent` returns `{ pid, spawnToken }` (was: bare `pid`). `pid` is
   retained for `kill_process` and display.
2. The `agent-stdout` / `agent-stderr` / `agent-exit` payloads each gain
   `spawnToken`:
   - `agent-stdout` / `agent-stderr`: `{ pid, spawnToken, line }`
   - `agent-exit`: `{ pid, spawnToken, code }`
3. All renderer correlation keys move from PID to `spawnToken`. The gate
   early-exit cache / waiter machinery in `MainClient` is re-keyed by token and
   the `gateSpawnPendingRef` / `onBeforeNativeSpawn` capture window is **removed**
   — token uniqueness, not a timing window, is what prevents cross-correlation.

This is a **bridge event contract change**, recorded here per the bridge
discipline (event payload shape is part of the contract).

## Rationale

- Tokens are never reused, so a recycled OS PID can no longer match a live run's
  token — the race class is eliminated rather than merely narrowed.
- The token is returned by the same `invoke` call as the PID, so the
  emit-before-return ordering still exists; but staging an early exit by token is
  now safe without any guard, because a stale token can never collide with a
  future run.
- Keeping `pid` in the result and payloads preserves `kill_process` and the
  existing PID-based UI affordances with no behavioural change.
- Removing the capture-window machinery deletes the fragile code the PR #15
  mitigation introduced.

## Evaluated Alternatives

| Alternative | Outcome | Reason |
| --- | --- | --- |
| Keep PID correlation + widen the TS capture window | Rejected | The window narrows but cannot close the race; the root cause is PID reuse. |
| Encode `spawnToken` as a string to dodge JS integer limits | Rejected | A `u64` counter from 1 stays far below `Number.MAX_SAFE_INTEGER` for any realistic session; a `number` keeps the contract simple. |
| Persist the counter across app restarts | Rejected | Tokens only correlate live events to live awaits within one process lifetime; a per-process counter is sufficient. |

## Consequences

- Any new consumer of agent events MUST correlate by `spawnToken`. Correlating
  by `pid` reintroduces the race.
- `spawnAgent` callers that only need the PID for display/kill destructure
  `const { pid } = await spawnAgent(...)`.
- The bounded LRU (`GATE_EXIT_CACHE_CAP`) in `MainClient` remains as a memory
  bound for unclaimed early exits, but is no longer a correctness device.
- Regression coverage: `__tests__/BatchDispatchModal.state.test.tsx` proves a
  reused PID with a different token is not cross-correlated;
  `__tests__/bridgeEventListeners.test.ts` proves the payloads carry the token.
