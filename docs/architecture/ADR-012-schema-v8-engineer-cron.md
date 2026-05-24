# ADR-012: Schema v8 — Engineer Cron Dispatch

> **Created Date**: 2026-05-24
> **Created By**: Jason
> **Last Modified**: 2026-05-24
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason
> **Related**: [ADR-002 — Schema Versioning Strategy](./ADR-002-schema-versioning.md), [ADR-003 — Prompt Assembly Location](./ADR-003-prompt-assembly.md), [ADR-004 — API Call Security](./ADR-004-api-call-security.md)

---

## Background

`CronJob.action` has only ever supported `{ type: 'run-command' }`, which spawns
a child process via the existing `spawnAgent` bridge. With F23 (Engineer
Capability Framework) shipped, engineer roles now carry `capabilities`
(eyes / voice / hands / recording) and a `primaryModel`, but **there is no
scheduled-dispatch entry point** — engineers only run when a user clicks "Run"
from a dispatch modal.

This blocks recurring engineer workloads such as "every morning run the
Documentation Engineer on the current branch diff" or "every 4 hours have the
Watchdog Engineer scan for stalled features".

A second motivation: `/cron-jobs` will gain a two-sheet layout
(Engineers Cron Jobs / System Cron Jobs) so the two action types are visibly
separated. That UI change requires the schema split first.

---

## Decision

1. Bump schema version from `7` to `8`.
2. Change `CronAction` from a single `{ type: 'run-command' }` shape into a
   discriminated union of `RunCommandAction | DispatchEngineerAction`,
   discriminated by the existing `type` field.
3. Add `DispatchEngineerAction` with fields:
   - `type: 'dispatch-engineer'`
   - `roleId: string` — references `EngineerRole.id` on the same project
   - `promptTemplate: string` — raw text only in v8; variable substitution
     (`{{branch}}`, `{{date}}`) deferred to a follow-up
   - `modelOverride?: ModelFallbackEntry` — defaults to `role.primaryModel`
     when absent
4. Add observability fields the previous schema lacked:
   - `CronJob.lastError?: { reason: string; message: string }`
   - `CronRun.error?: { reason: string; message: string }`
   - `CronRun.outputSnippet?: string` — first ~200 chars of LLM output, for
     the run-history panel
5. Add a `v7 -> v8` migration in `lib/storage/migrate.ts`. The migration is a
   no-op on `action` (existing `run-command` rows already have `type` set),
   so its only job is bumping `schemaVersion` and back-filling any
   `cronJobs[].action.type` that is missing on legacy rows.

---

## Scheduler Location — Frontend, For Now

The cron scheduler currently runs in `app/ui/MainClient.tsx` as a 30-second
`setInterval` heartbeat. It is **not** in Rust. This means:

- Cron jobs only fire while the desktop app window is open.
- `cronHistory` and the "next run" map live in React state — closing the app
  resets both.

This ADR keeps scheduler-in-renderer for v8 because:

- Moving to a Rust daemon is a separate, larger change (cross-platform
  background process, OS-level scheduling, persistence of history) and would
  bloat this PR beyond what review can absorb.
- The frontend scheduler is the existing pattern; adding a `dispatch-engineer`
  branch beside the existing `run-command` branch is mechanical.

A follow-up ADR will revisit "scheduler in Rust" once the schema and UX are
stable.

---

## Historical Note — v6 → v7 ADR Gap

Schema v7 was introduced by F23 (Engineer Capabilities) without a dedicated
ADR. ADR-011 covers v6; this ADR covers v8. The implementation of v7 is
captured in `lib/storage/migrate.ts:170` (`migrate_6_to_7`). This is a
process debt — not corrected by this ADR, but noted so the gap is visible
and future schema bumps land with an ADR per ADR-002.

---

## Rationale

- A discriminated union on `type` keeps `CronAction` extensible without
  adding a parallel `kind` discriminator that would duplicate information
  (single-source-of-truth).
- Naming `lastError` and `outputSnippet` at the type level (rather than free
  text) forces the scheduler to classify failures, which directly counters
  the existing "silent failure" smell where the cron error path only writes
  `{ status: 'error' }` with no message.
- Keeping prompt assembly in TypeScript respects ADR-003 — the new
  `dispatch-engineer` action reuses the existing `callAnthropic` bridge
  wrapper, with the prompt assembled on the renderer side from `roleId` +
  `promptTemplate`.
- The Anthropic key never leaves Rust because `callAnthropic` already loads
  it from the keychain (release) or `dev_secrets` (debug) — ADR-004 holds.

---

## Risks and Mitigation

| Risk | Mitigation |
| --- | --- |
| Stale `roleId` after a role is deleted | Scheduler classifies as `EngineerDispatchError { reason: 'role_missing' }`; UI surfaces via `lastError` on the row |
| No Anthropic key on this machine | Scheduler classifies as `reason: 'no_api_key'`; UI links to `/keys` |
| Two scheduler ticks fire for the same job (in-flight overlap) | In-flight `Set<jobId>` guard added in the PR2 scheduler change (out of scope for this PR) |
| Engineer cron silently burns budget overnight | `maxRunsPerDay` and a `dryRun` mode are intentionally **deferred** to a follow-up; v8 ships the data model only |
| Existing v7 configs on disk mid-upgrade | `migrate_7_to_8` is idempotent and only bumps version + back-fills `action.type` if absent |

---

## Consequences

**Positive**
- Engineers can be scheduled, unblocking automation workflows that F23 implied.
- Cron failures stop being silent; every error has a `reason`.
- `/cron-jobs` two-sheet UI (PR2) has a clean schema to render against.

**Negative**
- One more migration in the chain. The chain is now 7 hops long; per ADR-002
  this is the threshold to start considering migration consolidation.
- App-closed-no-fire limitation is now more visible because engineer cron
  raises user expectations of "set and forget".

---

## References

- `schema/project-manager.schema.json`
- `lib/types/index.ts`
- `lib/storage/migrate.ts`
- `app/ui/MainClient.tsx` (scheduler heartbeat — modified in follow-up PR2)
- `app/ui/views/CronJobsView.tsx` (two-sheet layout — PR2)
- ADR-002 (schema versioning), ADR-003 (prompt assembly in TS), ADR-004 (Anthropic key in Rust)
