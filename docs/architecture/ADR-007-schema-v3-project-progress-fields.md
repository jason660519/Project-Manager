# ADR-007: Schema v3 — Project-Progress Phase Fields

> **Created Date**: 2026-05-17
> **Created By**: Jason (Project Lead)
> **Last Modified**: 2026-05-17
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason
> **Related**: [ADR-002 — Schema Versioning Strategy](./ADR-002-schema-versioning.md), [ADR-006 — Schema v2 — Sync Identity & Audit Fields](./ADR-006-schema-v2-sync-fields.md)

---

## Background

The first iteration of the Project Progress Dashboard rendered features through a single status filter (`todo / in_progress / done / on_hold`). The reference dashboard we benchmarked against (Owner-Property-Management-AI-SPA → `superadmin/dashboard/project-progress`) operates on a four-phase lifecycle — **Development → Testing → Deployment → Operations** — and shows phase-specific aggregates (test coverage, deploy status, uptime, error rate, etc.). The PM dashboard had nowhere to *store* any of those fields, so even the table columns couldn't be modelled, let alone the aggregates.

This ADR captures the schema bump (v2 → v3) required to support that dashboard, plus the related `promptConfig` field added so each feature can carry its own auto-loop prompt for the row-level Prompt Engineer page (`/project-progress-dashboard/task?rowId=…`).

The bump is small and additive — every new field is optional, so old documents continue to load without rewriting. v1 documents still migrate through `v1 → v2 → v3` in one read.

---

## Decision

Bump `.project-manager.json` `schemaVersion` from `2` to `3`. All additions are **per-feature** and **optional** — the document root keeps the v2 shape unchanged.

### Per-feature lifecycle field

| Field         | Type                                                       | Required | Purpose                                                                                          |
| ------------- | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `phase`       | `"development" \| "testing" \| "deployment" \| "operations"` | no       | Lifecycle phase. Drives which dashboard tab the feature appears in. Defaults to `"development"`. |
| `points`      | `number` (≥0)                                              | no       | Story-point weight used in the SP-weighted progress aggregation. Defaults to `1`.                |
| `locatedPage` | `string`                                                   | no       | Free-text "where does this live" hint surfaced in the table.                                     |

### Per-feature phase-specific fields

| Field             | Type                                                       | Phase       | Purpose                                                                                  |
| ----------------- | ---------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `testCoverage`    | `number` (0–100)                                           | testing     | % covered by unit / integration tests.                                                   |
| `testStatus`      | `"passed" \| "failed" \| "pending"`                        | testing     | Current outcome of the latest test run.                                                  |
| `deployStatus`    | `"production" \| "staging" \| "not_deployed"`              | deployment  | Where the feature is currently live.                                                     |
| `deployEnv`       | `string`                                                   | deployment  | Free-text environment slug (`prod-asia`, `staging-tw-01`, …).                            |
| `deployDate`      | `string` (ISO 8601 date or date-time)                      | deployment  | Last successful deploy timestamp; sorted lexicographically to pick "latest deploy".      |
| `uptimePercent`   | `number` (0–100)                                           | operations  | Recent uptime % for the feature.                                                         |
| `errorRate`       | `number` (≥0)                                              | operations  | Recent error rate, percent.                                                              |
| `avgResponseTime` | `number` (≥0, milliseconds)                                | operations  | Mean response time over the recent window.                                               |
| `lastIncident`    | `string`                                                   | operations  | Free-text last incident note / id; the cards count features whose value is truthy.       |

### Per-feature prompt-engineer field

| Field          | Type             | Required | Purpose                                                                                |
| -------------- | ---------------- | -------- | -------------------------------------------------------------------------------------- |
| `promptConfig` | `object` (below) | no       | Auto-loop prompt configuration for the row-level Prompt Engineer page.                 |

`promptConfig` shape:

```ts
{
  body?: string;          // user-authored prompt body
  agentId?: string;       // adapter id (e.g. "claude-code")
  autoLoop?: boolean;     // re-fire until stopCondition matches
  stopCondition?: string; // substring match against the last run's output
  maxIterations?: number; // hard cap (default 5)
  workingDir?: string;    // optional working dir override
}
```

### Migration

A new `migrate_2_to_3` step chains onto the existing pipeline in [`lib/storage/migrate.ts`](../../lib/storage/migrate.ts):

- For every feature, default `phase = 'development'` if absent.
- For every feature, default `points = 1` if absent, zero, or negative (guards against junk data).
- Every other field stays untouched: undefined remains undefined, so the dashboard renders an em-dash for unknown values instead of inventing defaults.

The migration is **additive and idempotent** — running a v3 document through `migrateConfig` returns it unchanged.

The migration runs at the same three points as before — Rust→TS read, repository load, and ProjectsView add/scan — so callers continue to need zero awareness of versioning.

---

## Rationale

### Why a separate `phase` field instead of inferring it from `status`?

`status` describes *progress within a phase* ("todo / in_progress / done"). `phase` describes *which lifecycle stage the feature is in* (a feature can be in the operations phase but in_progress with respect to an SLA fix). Overloading status with phase would force the UI to invent compound labels like "operations-in_progress" and would conflate two orthogonal axes.

### Why default `phase` to development?

Existing v1/v2 corpora are entirely features being built — that's the only phase the product currently models. Defaulting matches the user's mental model and lets the new dashboard render meaningfully on day-one data without any backfill.

### Why default `points` to 1 (not 0)?

Aggregations divide by `totalPoints`. Defaulting to 0 would mean a fresh feature contributes nothing to the weighted progress until someone manually sets a number — surprising and easy to forget. Defaulting to 1 gives every feature an equal vote, matching the implicit "one feature one weight" model PM has shipped with from day one.

### Why are phase-specific fields optional and never back-filled?

The dashboard shows em-dashes for missing values. That's the correct UX — pretending `uptimePercent = 0` would be a lie when the feature simply hasn't been measured yet. Optional + undefined is the only honest encoding.

### Why `deployDate` as a string?

Same reasoning as ADR-006: human-readable in `git diff`, sortable lexicographically when ISO 8601, valid JSON Schema `date` / `date-time` format. Some sources publish `YYYY-MM-DD` only; allowing either form keeps the field practical.

### Why `promptConfig` here and not in a sidecar?

Each feature can have its own prompt loop (different stop conditions per feature). Storing the config inside the feature keeps `(documentId, featureId)` as the single sync key — same principle as ADR-006. A sidecar file or a separate root array would introduce a second sync surface for the future cloud-sync layer to reconcile. Keeping it nested means **zero** new sync work.

### Why namespace the dashboard's `customRows` outside the schema?

Custom rows added through the dashboard's "Add Row" buttons are inherently *per-user UI state* — they don't belong to the canonical project document and shouldn't sync across machines (a custom row I added on my dev box has no meaning to my teammate). They live in localStorage under `projectManager.progressDashboard.phase.<phase>`, mirroring the `projectManager.personal.*` convention in [`ProjectsRepository.ts`](../../lib/storage/ProjectsRepository.ts).

---

## Evaluated Alternatives

### Option A: One enum `lifecycleStatus` replacing both phase and status

**Pros:** fewer fields, simpler model.
**Cons:** conflates the two orthogonal axes (phase vs. progress within a phase), forces compound labels in the UI, breaks every existing feature record's `status`. Bad trade.
**Conclusion:** ❌ Rejected.

### Option B: Keep phase outside the schema (a per-project setting that maps category → phase)

**Pros:** zero schema change, simpler v2 → v3 (none required).
**Cons:** feature granularity is the right unit — two features in the same category can be in different phases (one in dev, one already in production). Category-level mapping can't express that.
**Conclusion:** ❌ Rejected.

### Option C: Defer the schema bump and store all new fields in localStorage as a sidecar

**Pros:** no schema work, instantly shippable.
**Cons:** the values are *project data* (uptime, deploy status), not user preferences. They need to be shared across machines / engineers / Git history. Storing in localStorage hides them from `.project-manager.json` and from any future sync layer — exactly the same retrofit-pain ADR-006 was designed to avoid.
**Conclusion:** ❌ Rejected — same anti-pattern as the v1 → v2 case.

### Option D: A dedicated `metrics` object per feature

```jsonc
{ "id": "F01", "metrics": { "testCoverage": 80, "deployStatus": "production" } }
```

**Pros:** groups phase data away from feature core fields.
**Cons:** the metrics aren't a single conceptual unit — they belong to three different phases. Grouping would force consumers to indirect through `feature.metrics.testCoverage` even though there's no meaningful "metrics" abstraction. Flat fields read more naturally in both code and `git diff`.
**Conclusion:** ❌ Rejected.

---

## Implementation Notes

- TypeScript types in [`lib/types/index.ts`](../../lib/types/index.ts) expose `FeaturePhase`, `TestStatus`, `DeployStatus`, and `FeaturePromptConfig` as union types so the UI gets exhaustive switches over phase variants.
- JSON Schema additions in [`schema/project-manager.schema.json`](../../schema/project-manager.schema.json) mark all new fields as optional. The schema deliberately does not enforce field-vs-phase correctness ("a `testCoverage` only makes sense when `phase === 'testing'`"). Cross-field validation lives in the dashboard aggregations, which simply ignore irrelevant fields for the active phase. Keeping the schema permissive lets a feature carry forward, say, an old `deployDate` after moving back into the development phase — useful audit data, not an error.
- All four `migrate_*_to_*` steps share the same idempotency property, so a v3 document round-trips through `migrateConfig` unchanged.
- Dashboard aggregations live in [`app/project-progress-dashboard/_lib/aggregations.ts`](../../app/project-progress-dashboard/_lib/aggregations.ts) and treat missing values defensively (em-dash for ops percents, `0` for empty SP-weighted progress) so the UI is never asked to render `NaN`.

---

## Risks & Mitigation

| Risk                                                                       | Likelihood | Impact   | Mitigation                                                                                                            |
| -------------------------------------------------------------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| Stale `deployDate` after a phase rollback misleads "latest deploy" card    | Low        | Low      | The card surfaces the *value present in the document*. Operators clear it explicitly if needed; we don't auto-erase.  |
| Manually authored junk `points` (negative, NaN, missing) skews aggregates  | Medium     | Low      | Migration coerces non-positive numbers to 1; aggregation clamps progress to [0,100].                                  |
| Future field additions force another schema bump per phase                 | Medium     | Medium   | Phase fields are flat-namespaced, so future additions remain additive and a v3.x minor doesn't need a major bump.     |
| `promptConfig` body could be edited concurrently from two clients          | Low        | Medium   | The feature already carries `updatedAt`; last-write-wins is acceptable for prompt config the same way it is for status. |
| Custom rows in localStorage diverge across machines for the same teammate  | High       | Low      | Documented as *per-user UI state* in this ADR; never synced. If teammates need a shared row, they add it as a real feature. |

---

## Consequences

**Positive:**
- The dashboard can now express the full Owner-Property reference UI (four-phase tabs, phase-specific aggregates, per-row prompt).
- Existing v1 / v2 documents load and migrate in one read — no user action required.
- The schema is still additive-only, so a v3.x can keep accreting optional fields without another major bump.

**Negative:**
- `.project-manager.json` size grows by up to ~140 bytes per feature when every phase field is populated. Not material at our scale (typical project: tens of features).
- One more migration step in the pipeline.

**Neutral:**
- The schema deliberately does not enforce phase-vs-field correctness. Validation lives at the UI / aggregation layer, where context is available.

---

## Future Considerations

- A formal `metricsSource` field per feature ("manual / github-actions / datadog / …") if multiple ingestors start writing to the operations fields.
- Promote `promptConfig` to a richer model (system prompt, env vars, file refs) once more than one feature uses it — at that point the auto-loop story would warrant its own ADR.
- Per-phase categorical taxonomies (so a feature in deployment can be labelled "rolling / canary / blue-green") if the deployment phase grows.

---

## References

- [ADR-002 — Schema Versioning Strategy](./ADR-002-schema-versioning.md)
- [ADR-006 — Schema v2 — Sync Identity & Audit Fields](./ADR-006-schema-v2-sync-fields.md)
- Reference dashboard the v3 shape was modelled on: `Owner-Property-Management-AI-SPA/apps/superadmin/app/superadmin/dashboard/project-progress/`

---

## Change History

| Date       | Version | Modified By | Changes                                                              |
| ---------- | ------- | ----------- | -------------------------------------------------------------------- |
| 2026-05-17 | 1.0     | Jason       | Initial ADR creation; schema v2 → v3 phase + prompt-config bump.     |
