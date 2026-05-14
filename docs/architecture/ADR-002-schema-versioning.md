# ADR-002: Schema Versioning Strategy for `.project-manager.json`

> **Created Date**: 2026-05-12
> **Created By**: Jason (Project Lead)
> **Last Modified**: 2026-05-12
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason

---

## Background

`.project-manager.json` is the core configuration file format that travels with each project. As the product evolves, the schema will need to accommodate:

- New optional fields (e.g., GitHub repository URL, AI model preferences)
- Breaking changes (e.g., restructuring task format)
- Backward compatibility concerns

Without a versioning strategy, older projects will become incompatible with newer Project Manager versions, creating a poor user experience.

---

## Decision

Implement schema versioning using a top-level `schemaVersion: number` field in `.project-manager.json`.

**Current version:** `1`

### Versioning Rules

| Change Type | Action | Example |
|------------|--------|---------|
| **Additive** (optional fields) | Keep `schemaVersion` unchanged | Add `githubUrl?: string` field |
| **Breaking** (deletion, rename, type change) | Increment `schemaVersion` | Remove `tasks`, add `features` |

---

## Rationale

- **Explicit versioning**: Developers immediately know the schema generation
- **Backward compatibility**: Old projects can be migrated when loaded
- **Progressive upgrade**: Users don't need to manually update all configs
- **Clear migration path**: Code can handle multiple schema versions
- **Minimal overhead**: Single number field; negligible size impact

---

## Implementation

### TypeScript Migration Handler

```typescript
// lib/bridge/migrate.ts
import { ProjectManagerConfig } from '@/lib/types';

interface RawConfig {
  schemaVersion?: number;
  [key: string]: any;
}

export function migrateConfig(raw: unknown): ProjectManagerConfig {
  const config = raw as RawConfig;
  const version = config.schemaVersion ?? 0;

  // Apply migrations in sequence
  if (version < 1) {
    return migrate_0_to_1(config);
  }
  if (version < 2) {
    return migrate_1_to_2(config);
  }

  return config as ProjectManagerConfig;
}

function migrate_0_to_1(config: RawConfig): ProjectManagerConfig {
  // v0 → v1: Rename 'tasks' to 'features'
  return {
    schemaVersion: 1,
    ...config,
    features: config.tasks || [],
    tasks: undefined, // Remove old field
  };
}

function migrate_1_to_2(config: RawConfig): ProjectManagerConfig {
  // Future migration example
  return {
    schemaVersion: 2,
    ...config,
  };
}
```

### Schema Definition

```typescript
// lib/types/index.ts
export interface ProjectManagerConfig {
  schemaVersion: number;  // ← NEW
  projectName: string;
  features: Feature[];
  adapters: AdapterConfig[];
  // ... other fields
}

export interface Feature {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'blocked' | 'done';
  // ...
}
```

### Sample Configs

**v0 (old format):**
```json
{
  "projectName": "Project Manager",
  "tasks": [
    { "id": "t1", "title": "Implement Tauri bridge" }
  ]
}
```

**v1 (current format):**
```json
{
  "schemaVersion": 1,
  "projectName": "Project Manager",
  "features": [
    { "id": "f1", "title": "Implement Tauri bridge" }
  ]
}
```

---

## Evaluated Alternatives

### Option A: No Versioning (Assume Forward Compatibility)

**Pros:**
- Simple; no migration logic needed

**Cons:**
- Breaking changes break user projects
- No way to detect old format
- Poor user experience when upgrading

**Conclusion:** ❌ Not viable — inevitably causes data loss

### Option B: Separate Schema Files for Each Version

**Pros:**
- Version history is explicit

**Cons:**
- Verbose and hard to maintain
- Unclear which version is current

**Conclusion:** ❌ Rejected — single version field is cleaner

### Option C: Use Zod/Joi Schemas with Runtime Validation

**Pros:**
- Strong type safety at runtime

**Cons:**
- Adds dependency; migration logic still needed

**Conclusion:** ⚠️ Considered — can complement this ADR, but not required for MVP

---

## Migration Frequency

| Scenario | Action | Example |
|----------|--------|---------|
| **MVP (v1)** | No migration needed | App v1.0.0 reads v1 configs |
| **Feature addition** | No schema change | Add optional `githubUrl` field |
| **Major feature** | Increment version | v2 restructures task format |
| **Quarterly review** | Assess migration burden | Every 3 months, consider merging old versions |

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Migration bugs lose data | Low | Critical | Test migrations thoroughly; create backup before upgrade |
| Forgetting to increment version | Medium | Medium | Add check to PR review (increment version if schema changes) |
| Multiple migrations chain too long | Low | Medium | Merge old migrations when older versions no longer used |

---

## Consequences

**Positive:**
- Users can upgrade Project Manager without breaking projects
- Schema changes are tracked and explicit
- New features don't require manual config updates

**Negative:**
- Migration code maintenance burden grows over time
- More complex than rigid schema

---

## Future Considerations

- **Backward compatibility window**: Support last 3 versions; deprecate older
- **Schema dump utility**: CLI tool to show which version a config is
- **Automatic backup**: Create `.project-manager.json.backup` before migration

---

## References

- [Semantic Versioning](https://semver.org/)
- [Database Migration Best Practices](https://www.liquibase.org/get-started/best-practices)
- [JSON Schema](https://json-schema.org/)

---

## Change History

| Date       | Version | Modified By | Changes |
|------------|---------|------------|---------|
| 2026-05-12 | 1.0     | Jason      | Initial ADR creation |
