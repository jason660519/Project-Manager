# ADR-009: Schema v5 — Feature README Path

> **Created Date**: 2026-05-19
> **Created By**: Codex
> **Last Modified**: 2026-05-19
> **Modified By**: Codex
> **Status**: Accepted
> **Decision Maker**: Jason
> **Related**: [ADR-002 — Schema Versioning Strategy](./ADR-002-schema-versioning.md), [ADR-008 — Dashboard Folder Consolidation](./ADR-008-dashboard-folder-consolidation.md)

---

## Background

Feature records used `notes` for two different meanings:

1. A short human-authored note or summary.
2. A relative path to the feature README, for example `.project-manager/features/F01/README.md`.

This ambiguity created operational risk. The dashboard sometimes tried to open a prose note as a file path, while recovery and initialization logic could not reliably distinguish a README pointer from free-form text. It also encouraged engineers and AI initialization flows to invent different conventions each time a config was rebuilt.

The project now stores feature documentation under `.project-manager/features/<feature-id>/README.md`, with optional deeper artifacts such as `feature-spec.md`, `tdd-spec.md`, and `dev-log.md` in the same folder.

---

## Decision

Bump the Project Manager config schema to `5` and split README pointers from notes:

| Field | Type | Purpose |
| --- | --- | --- |
| `readmePath` | `string` | Canonical relative path to the feature overview README. |
| `notes` | `string` | Optional short human-authored summary or note. It must not be used as a file path. |

The default README path for a feature with `paths.featureFolder = ".project-manager/features/F01/"` is:

```text
.project-manager/features/F01/README.md
```

`paths.spec` remains reserved for an actual spec document, such as `feature-spec.md` or a product spec under `docs/`. It must not point to the feature overview README.

---

## Migration

The `v4 -> v5` migration follows deterministic rules:

1. Preserve an existing `readmePath` if one is already present.
2. If legacy `notes` ends with `README.md`, move it to `readmePath`.
3. If `paths.spec` ends with `README.md`, move it to `readmePath` and remove `paths.spec`.
4. If no README path is present but `paths.featureFolder` exists, infer `<featureFolder>/README.md`.
5. If legacy `notes` was a README path, restore text notes from `metadata.notesSummary` when available.
6. Preserve non-README `paths.spec` values unchanged.

The migration is pure and idempotent through `migrateConfig(raw)`.

---

## Rationale

`notes` and `readmePath` are different types of information. A note is content. A README path is a filesystem pointer. Keeping them in the same field makes both UI behavior and AI recovery brittle.

The schema now gives initialization logic a stable rule: feature overview docs live in `readmePath`, feature specs live in `paths.spec`, and short dashboard summaries live in `notes`.

---

## Evaluated Alternatives

### Option A: Keep `notes` as the README path

**Pros:** Smallest code change.
**Cons:** Continues the ambiguity. Engineers and AI agents cannot safely tell whether `notes` is text or a path.
**Conclusion:** Rejected.

### Option B: Rename `notes` to `noteOrReadme`

**Pros:** Describes the current ambiguity more honestly.
**Cons:** Makes the ambiguity official instead of fixing it. UI code would still need path heuristics.
**Conclusion:** Rejected.

### Option C: Store README path only in `paths.spec`

**Pros:** Reuses an existing nested path object.
**Cons:** A README is an overview document, not a feature spec. Overloading `paths.spec` caused the current broken-link problem.
**Conclusion:** Rejected.

---

## Consequences

**Positive:**

- Dashboard cells can open README files without guessing.
- Short notes can render as text without being treated as paths.
- Reinitialization and recovery can rebuild configs deterministically from `.project-manager/features/<id>/README.md`.
- Actual specs remain separate from README overviews.

**Negative:**

- Consumers that read `Feature.notes` as a README path must move to `Feature.readmePath`.

**Neutral:**

- Existing v1-v4 configs migrate automatically when read through the supported migration pipeline.
