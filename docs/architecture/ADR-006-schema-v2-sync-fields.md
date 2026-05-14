# ADR-006: Schema v2 — Sync Identity & Audit Fields

> **Created Date**: 2026-05-12
> **Created By**: Jason (Project Lead)
> **Last Modified**: 2026-05-12
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason
> **Related**: [ADR-002 — Schema Versioning Strategy](./ADR-002-schema-versioning.md)

---

## Background

Project Manager ships today as a single-user desktop tool: every `.project-manager.json` lives in a project folder and the dashboard reads it from disk. As the product moves toward multi-user / multi-machine usage (cross-region engineering teams collaborating on the same project pipeline), three pieces of state become unavoidable:

1. **Stable identity** — a project must be referenceable across machines without depending on its filesystem path. Today, two machines that mount the same repo at different roots see two unrelated `.project-manager.json` documents.
2. **Monotonic clocks** — any future sync (peer-to-peer, cloud-backed, or git-based merge) needs a per-document and per-feature timestamp to drive last-write-wins or conflict surfacing.
3. **Authorship** — when multiple engineers can mutate feature status, knowing *who* last touched a row is a prerequisite for any kind of activity feed or audit log.

The existing v1 schema has none of these. We don't want to bolt them on after the sync layer ships — adding required fields after the fact forces ugly back-fills against live user data.

Adding the fields **now** — even before any sync code exists — costs almost nothing and avoids a much harder migration later. This ADR captures that pre-emptive bump.

---

## Decision

Bump `.project-manager.json` `schemaVersion` from `1` to `2`. The new shape adds four fields at the document root and three on each feature.

### Document root (additions)

| Field        | Type     | Required | Purpose                                                            |
| ------------ | -------- | -------- | ------------------------------------------------------------------ |
| `id`         | `string` | **yes**  | Stable UUID. Identity for cross-device sync; path-independent.     |
| `createdAt`  | `string` | no       | ISO 8601 timestamp set on document creation.                       |
| `updatedAt`  | `string` | no       | ISO 8601 timestamp; bumped on every modification.                  |
| `updatedBy`  | `string` | no       | Identifier of the last editor (e.g. GitHub login, email).          |

### Per-feature (additions)

| Field        | Type     | Required | Purpose                                                            |
| ------------ | -------- | -------- | ------------------------------------------------------------------ |
| `createdAt`  | `string` | no       | ISO 8601 timestamp set on feature creation.                        |
| `updatedAt`  | `string` | no       | ISO 8601 timestamp; bumped on every modification.                  |
| `updatedBy`  | `string` | no       | Identifier of the last editor.                                     |

Feature IDs (`feature.id`, e.g. `"F01"` / `"031"`) remain user-facing strings and are **not** replaced with UUIDs. The pair `(documentId, featureId)` is unique enough for any sync scheme and the human-readable IDs are what users put in commit messages and PRs.

### Migration

A pure TypeScript pipeline in [`lib/storage/migrate.ts`](../../lib/storage/migrate.ts) lifts v1 documents to v2 on every read:

- Generates a fresh UUID for `id` if absent.
- Stamps `createdAt` / `updatedAt` with the current time on the root and on every feature that lacks them.
- Idempotent: passing a v2 document returns it unchanged (modulo back-filling missing optional fields).

The migration runs at three points so callers never have to think about it:

1. [`lib/bridge/index.ts`](../../lib/bridge/index.ts) — `readConfig()` pipes Rust output through `migrateConfig()`.
2. [`lib/storage/LocalStorageProjectsRepository.ts`](../../lib/storage/LocalStorageProjectsRepository.ts) — `listProjects()` migrates each cached `ProjectEntry.config` on load.
3. [`app/ui/views/ProjectsView.tsx`](../../app/ui/views/ProjectsView.tsx) — the AI-scan and manual-add paths run user-edited JSON through the migration before persisting.

---

## Rationale

### Why a stable UUID instead of using the file path?

Path identity breaks the moment two engineers mount the same repo at different roots (`/Users/alice/work/repo` vs `/Volumes/KLEVV/repo`). It also breaks when a project is moved or renamed. A UUID generated once and stored inside the document is path-independent and survives any number of relocations. This is the same reason GitHub uses opaque IDs alongside `owner/repo` slugs.

### Why ISO 8601 strings instead of epoch numbers?

- Human-readable in `git diff` and in raw editors — engineers will look at `.project-manager.json` directly.
- JSON Schema has a standard `format: "date-time"` validator.
- The 8-byte cost over an epoch number is negligible and never hot-path.

### Why are timestamps optional?

Required-from-day-one would force every legacy v1 document to fail validation until migration runs. Marking them optional lets the migration *back-fill* without producing temporarily invalid documents during the load → migrate → save cycle. Once the in-memory shape goes through `migrateConfig`, both fields are always populated.

### Why is `id` required (not optional like the timestamps)?

`id` is the field downstream sync code will key on; allowing it to be absent would force every sync caller to re-implement "generate one if missing" logic. Migration always supplies it, so by the time application code touches a config, `id` is guaranteed present.

### Why no per-feature UUID?

Adding a UUID per feature would double the noise in the document with no real benefit. `feature.id` is already a user-facing stable string ("F01", "031-landlord-grid") chosen to be referenced in commits and Slack. The pair `(document.id, feature.id)` is the natural sync key.

---

## Evaluated Alternatives

### Option A: Defer until sync code is written

**Pros:** zero work today; YAGNI.
**Cons:** retrofitting required fields onto live user documents is the painful version of this migration. The cost is paid by *users* (broken loads, confusing prompts) instead of by us today.
**Conclusion:** ❌ Rejected — preempting is much cheaper.

### Option B: Use file-path or repo URL as identity

**Pros:** no schema change, no UUIDs.
**Cons:** breaks under any rename / relocation / mount-point variance. Two engineers can't co-own a project without sharing the exact filesystem layout.
**Conclusion:** ❌ Rejected — defeats the purpose of cross-machine collaboration.

### Option C: Epoch milliseconds for timestamps

**Pros:** cheaper string length, faster comparison.
**Cons:** unreadable in `git diff`; loses JSON Schema `date-time` validation; no observable perf benefit at our document sizes.
**Conclusion:** ❌ Rejected — readability wins.

### Option D: Vector clocks instead of wall-clock `updatedAt`

**Pros:** strictly correct under concurrent edits.
**Cons:** massively over-engineered for a single-writer-per-feature workflow; we're not building a CRDT system. Last-write-wins on a per-feature basis is acceptable for the activity feed / audit use cases the timestamps target.
**Conclusion:** ❌ Rejected — wrong tool for the problem we expect.

---

## Implementation Notes

- `crypto.randomUUID()` is the primary UUID source. A v4-shaped fallback exists in [`migrate.ts`](../../lib/storage/migrate.ts) for older Node test environments where `globalThis.crypto.randomUUID` is undefined.
- Sample configs under [`config/samples/`](../../config/samples/) ship with deterministic UUIDs (`11111111-…`, `22222222-…`) so `git diff` doesn't churn on every reload.
- The `updatedBy` field is currently never populated by code — it's reserved for the future cloud-sync layer that will set it from the authenticated identity. It exists in schema today so callers don't need a second migration when that lands.

---

## Risks & Mitigation

| Risk                                                              | Likelihood | Impact   | Mitigation                                                           |
| ----------------------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------- |
| Migration drops or duplicates fields on edge-case documents       | Low        | High     | Migration is unit-testable pure function; idempotent on re-runs.     |
| Two machines generate different UUIDs for the "same" project      | Medium     | Medium   | UUID is generated once at first migration. Document the manual-merge story before launching sync. |
| `crypto.randomUUID()` unavailable in some host                    | Very Low   | Low      | Fallback v4-shaped generator in `migrate.ts`.                        |
| Wall-clock skew between machines causes wrong last-write-wins     | Medium     | Low      | Acceptable for the activity-feed use case; revisit if real LWW conflict resolution is needed. |

---

## Consequences

**Positive:**
- The schema is now ready for any sync layer (cloud, P2P, git-based merge) without another migration.
- Activity feed / audit log become trivial to build — the data is already there.
- Per-feature `updatedAt` enables "what changed since I last looked" UX.

**Negative:**
- Documents grow by ~200 bytes per feature. Not material at our scale.
- One more migration step in the pipeline, with the usual maintenance burden noted in ADR-002.
- Sample fixture diffs are noisier (extra fields per feature), though deterministic UUIDs keep churn out.

---

## Future Considerations

- When the sync layer lands, `updatedBy` should be populated from the authenticated identity (GitHub login / email).
- Consider a `schemaMinor` field for additive-only changes that don't warrant a major bump but should still be visible to consumers.
- Backup-on-migrate (`/.project-manager.json.backup`) — not in scope here, but referenced in ADR-002's "Future Considerations" and increasingly relevant as the migration pipeline grows.

---

## References

- [ADR-002 — Schema Versioning Strategy](./ADR-002-schema-versioning.md)
- [RFC 4122 — UUID](https://datatracker.ietf.org/doc/html/rfc4122)
- [JSON Schema — `date-time` format](https://json-schema.org/understanding-json-schema/reference/string#built-in-formats)

---

## Change History

| Date       | Version | Modified By | Changes                                              |
| ---------- | ------- | ----------- | ---------------------------------------------------- |
| 2026-05-12 | 1.0     | Jason       | Initial ADR creation; schema v1 → v2 sync-field bump. |
