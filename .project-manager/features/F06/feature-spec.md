# F06 Feature Spec - Storage Abstraction and Schema Sync Fields

## Purpose

Keep Project Manager storage behind a small repository interface and make project config documents safe for future cross-machine synchronization. The implementation separates shared project state from per-user preferences and ensures config files migrate through a deterministic schema pipeline.

## Source References

- `docs/architecture/ADR-006-schema-v2-sync-fields.md` - stable project identity and audit fields.
- `docs/engineering/storage-and-schema.md` - current storage and migration contract.
- `lib/storage/ProjectsRepository.ts` - repository interface.
- `lib/storage/LocalStorageProjectsRepository.ts` - localStorage implementation.
- `lib/storage/migrate.ts` - pure schema migration pipeline.

## Functional Requirements

1. Use `ProjectEntry.config` as shared project data.
2. Keep selected project and dashboard multi-select state in personal localStorage keys.
3. Run `migrateConfig()` whenever configs are read from disk or local cache.
4. Preserve unknown fields during migration unless the migration explicitly owns them.
5. Keep schema changes covered by unit tests and JSON schema updates.
6. Document strategic schema changes with ADRs.

## Dashboard Contract

This is the canonical `paths.spec` file for F06. Feature-local development logs live in `.project-manager/features/F06/`. The feature overview remains `.project-manager/features/F06/README.md`, and `notes` remains short text only.

## Acceptance Checks

- Legacy configs migrate to the current schema version through `migrateConfig()`.
- Project list reads return migrated configs without caller-specific migration code.
- Personal dashboard settings do not mutate canonical project config.
- Dashboard links for this feature resolve to files or folders that exist.
