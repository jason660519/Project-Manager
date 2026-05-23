# ADR-011: Schema v6 — Located Section Rename

> **Created Date**: 2026-05-24
> **Created By**: Codex
> **Last Modified**: 2026-05-24
> **Modified By**: Codex
> **Status**: Accepted
> **Decision Maker**: Jason
> **Related**: [ADR-002 — Schema Versioning Strategy](./ADR-002-schema-versioning.md), [ADR-007 — Schema v3 — Project-Progress Phase Fields](./ADR-007-schema-v3-project-progress-fields.md)

---

## Background

Schema v3 introduced `feature.locatedPage` as a free-text "where this feature lives" hint for Project Progress Dashboard rows. In practice, many features map to a module section, flow segment, or functional area rather than a single page/route.

The UI wording was therefore misleading (`Located Page`) and encouraged route-only values.

---

## Decision

1. Bump schema version from `5` to `6`.
2. Rename `Feature.locatedPage` to `Feature.locatedSection`.
3. Update dashboard column labels and editors from `Located Page` to `Located Section`.
4. Add backward-compatible migrations:
   - Config migration `v5 -> v6`: copy `locatedPage` to `locatedSection` when needed.
   - Dashboard localStorage custom-row migration: map legacy `locatedPage` to `locatedSection`.

---

## Rationale

- The field captures location context, not only URL routes.
- "Section" better matches engineering workflows where work is tracked by area (`auth`, `billing`, `project sidebar`) rather than path.
- A schema bump keeps versioning explicit and auditable per ADR-002.

---

## Risks and Mitigation

| Risk | Mitigation |
| --- | --- |
| Older configs still store `locatedPage` only | `migrate_5_to_6` lifts legacy value to `locatedSection` |
| Existing localStorage custom rows still use old key | `usePhasePreferences` migration maps `locatedPage` to `locatedSection` on read |
| Dashboard tests fail due column id/header rename | Updated tests to use the new `section` column id and patch payload key |

---

## Consequences

**Positive**
- Clearer semantics in UI and schema.
- Better fit for multi-surface features.
- Existing data remains readable through migration.

**Negative**
- Requires one additional migration step in `migrateConfig`.
- Any external tooling pinned to `locatedPage` must update to `locatedSection`.

---

## References

- `lib/types/index.ts`
- `schema/project-manager.schema.json`
- `lib/storage/migrate.ts`
- `app/project-progress-dashboard/_lib/columns.tsx`
- `app/project-progress-dashboard/_components/AddRowModal.tsx`

