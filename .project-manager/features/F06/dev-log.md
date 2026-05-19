# F06 Dev Log — Storage Abstraction and Schema Sync Fields

## 2026-05-12

- Added `ProjectsRepository` as the storage abstraction boundary.
- Added localStorage implementation with shared and personal key namespaces.
- Added schema v2 identity and audit fields through `migrateConfig()`.
- Documented the decision in `docs/architecture/ADR-006-schema-v2-sync-fields.md`.

## 2026-05-19

- Normalized Project Progress Dashboard artifacts for schema v5.
- Added canonical feature-local spec at `.project-manager/features/F06/feature-spec.md`.
- Moved dashboard dev-log linkage to the feature folder while preserving the historical source log folder under `docs/dev-logs/`.
