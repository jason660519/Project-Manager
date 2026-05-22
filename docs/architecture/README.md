# Architecture Decision Records (ADR)

> **Created Date**: 2026-05-12
> **Created By**: GitHub Copilot
> **Last Modified**: 2026-05-19
> **Modified By**: Codex
> **Version**: 1.2
> **Document Type**: Architecture / ADR Index

---

## Overview

This directory contains all Architecture Decision Records (ADRs) for the Project Manager project.

ADRs document important technical decisions, the context that led to them, and the reasoning behind the choice. They serve as a historical record of how the project's architecture has evolved.

**此目錄包含 Project Manager 專案的所有架構決策記錄（ADR）。**

ADR 記錄重要的技術決策、背景和決策理由，作為專案架構演進的歷史紀錄。

---

## ADRs Index

| # | Title | Status | Date | Summary |
|---|-------|--------|------|---------|
| [001](./ADR-001-tauri-selection.md) | Tauri Selection | Accepted | 2026-05-12 | Choose Tauri v2 + Next.js over Electron for desktop shell |
| [002](./ADR-002-schema-versioning.md) | Schema Versioning | Accepted | 2026-05-12 | Implement versioning strategy for `.project-manager.json` |
| [003](./ADR-003-prompt-assembly.md) | Prompt Assembly | Accepted | 2026-05-12 | Keep prompt template logic in TypeScript frontend |
| [004](./ADR-004-api-call-security.md) | API Call Security | Accepted | 2026-05-12 | Route all API calls through Rust bridge for security |
| [005](./ADR-005-beta-testing.md) | Beta Testing Strategy | Accepted | 2026-05-12 | Use AI personas for MVP testing instead of real users |
| [006](./ADR-006-schema-v2-sync-fields.md) | Schema v2 Sync Fields | Accepted | 2026-05-12 | Add stable identity and audit fields for future sync |
| [007](./ADR-007-schema-v3-project-progress-fields.md) | Schema v3 Project-Progress Phase Fields | Accepted | 2026-05-17 | Add lifecycle phase fields for the project-progress dashboard |
| [008](./ADR-008-dashboard-folder-consolidation.md) | Dashboard Folder Consolidation | Accepted | 2026-05-19 | Use `.project-manager/` as the canonical dashboard artifact folder |
| [009](./ADR-009-schema-v5-feature-readme-path.md) | Schema v5 Feature README Path | Accepted | 2026-05-19 | Split README file pointers from human-authored notes |
| [010](./ADR-010-documentation-site-static-sync.md) | Documentation Site Static Sync | Accepted | 2026-05-23 | Generate `/documentation` routes from the repo `docs/` tree before static export |

## Architecture Sources

| Document | Purpose |
|---|---|
| [architecture-overview.md](./architecture-overview.md) | System data flow, runtime modes, and current implementation map |

---

## How to Add a New ADR

1. Create a new file: `ADR-###-kebab-case-title.md`
2. Copy the template below
3. Fill in the sections
4. Add entry to the table above
5. Commit with message: `[Author] docs(architecture): add ADR-###`

### ADR Template

```markdown
# ADR-###: Title of Decision

> **Created Date**: YYYY-MM-DD
> **Created By**: Author Name
> **Last Modified**: YYYY-MM-DD
> **Modified By**: Author Name
> **Status**: Proposed | Accepted | Superseded
> **Decision Maker**: Name

## Background

Context and problem statement.

## Decision

What decision was made and why.

## Rationale

Why this decision was chosen over alternatives.

## Evaluated Alternatives

Other options that were considered.

## Risks & Mitigation

Potential risks and how to address them.

## Consequences

Impact on the project and team.

## References

Related documents, links, and resources.
```

---

## Status Legend

- **Proposed**: Under discussion, not yet approved
- **Accepted**: Approved and being implemented
- **Superseded**: Replaced by a newer ADR
- **Deprecated**: No longer valid or relevant

---

## 修改歷史

| Date       | Version | Modified By    | Changes                    |
| ---------- | ------- | -------------- | -------------------------- |
| 2026-05-12 | 1.0     | GitHub Copilot | Initial ADR index creation |
| 2026-05-15 | 1.1     | Codex          | Added ADR-006 to index |
| 2026-05-19 | 1.2     | Codex          | Added ADR-007 through ADR-009 to index |

---

> See also: [File Naming Standards](../file-naming-standards.md)
