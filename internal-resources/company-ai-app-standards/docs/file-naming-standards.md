# File Naming Standards

Status: Company baseline v0.2

## Core Rules

1. Use English filenames and directory names for source code, config, migrations, and operational documentation.
2. Preserve meaningful history by archiving deprecated documents instead of deleting them.
3. Keep product docs, engineering docs, ADRs, handoffs, and archives in predictable locations.
4. Use repo-local ADRs for project-specific deviations from company standards.

## Source Files

| Type | Rule | Example |
|---|---|---|
| React component | PascalCase | `TaskDispatchModal.tsx` |
| TypeScript utility | camelCase | `promptBuilder.ts` |
| Hook | camelCase with `use` prefix | `useAgentStatus.ts` |
| Rust module | snake_case | `process_manager.rs` |
| Config | kebab-case or ecosystem convention | `next.config.mjs` |

## Documentation Files

| Type | Rule | Example |
|---|---|---|
| Product docs | numeric prefix or clear kebab-case | `01-user-scenarios.md` |
| ADR docs | `ADR-###-kebab-case.md` | `ADR-001-initial-architecture.md` |
| Reports | date prefix | `20260514-weekly-report.md` |
| Archived docs | `archived-YYYYMMDD-name.md` | `archived-20260514-old-plan.md` |

## Directory Names

Use stable English directory names:

```text
docs/architecture/
docs/archive/
docs/project-process/
docs/product/
docs/engineering/
docs/design/
```

## Exceptions

Traditional Chinese filenames are acceptable for user-facing product material, legal/domain source samples, client-facing exports, and archived legacy material when renaming would reduce traceability. Prefer English filenames for engineering docs, ADRs, source code, and automation entrypoints.

If a legacy file cannot be renamed immediately, document the reason in a migration issue or ADR. New engineering files should follow this standard.
