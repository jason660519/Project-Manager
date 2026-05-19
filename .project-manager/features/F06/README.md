# F06 — Storage Abstraction & Schema v2 Sync Fields

**Status**: done | **Progress**: 100%  
**Category**: Core/Architecture  
**Spec**: `docs/architecture/ADR-006-schema-v2-sync-fields.md`  
**Implementation**: `lib/storage/`  
**Dev Logs**: `docs/dev-logs/`

## Summary

Async `ProjectsRepository` abstraction with namespaced localStorage keys, GitHub token migration to OS Keychain, and schema v1→v2 field additions.

## Changes Shipped

- `ProjectsRepository` class wrapping all storage reads/writes
- Namespaced localStorage keys (prevent collisions across projects)
- GitHub personal access token moved to OS Keychain via `keyring` crate
- Schema v2 adds: `id` (UUID), `createdAt`, `updatedAt`, `updatedBy` on Feature
- ADR-006 documents the schema evolution decision

## ADR Reference

ADR-006 at `docs/architecture/ADR-006-schema-v2-sync-fields.md` covers:
- Why sync fields were added at v2 instead of v1
- Keychain vs. localStorage trade-off for the GitHub token
- Migration strategy for v1 → v2 data

## Related Files

- `lib/storage/` — repository implementation
- `lib/types/index.ts` — updated Feature interface
- `schema/project-manager.schema.json` — canonical schema (schemaVersion: 2+)
- `docs/architecture/ADR-006-schema-v2-sync-fields.md` — architecture decision
