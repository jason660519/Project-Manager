# ADR-008: Dashboard Folder Consolidation — `.project-manager/`

> **Created Date**: 2026-05-19
> **Created By**: Jason (Project Lead)
> **Last Modified**: 2026-05-19
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason

---

## Background

Before this change, dashboard-relevant artifacts lived in three different places under each project root:

```
my-project/
├── .project-manager.json     ← config + features array
├── docs/features/            ← per-feature spec markdown
└── docs/dev-logs/            ← daily work logs (daily-report skill)
```

This caused:

- New users do not know which files belong to Project Manager and which to their own docs.
- The `docs/` folder competes with the project's own documentation conventions.
- Engineers who clone a repo without PM installed see scattered files that look like project metadata but are tool-specific.
- The dashboard's "single source of truth" lives in three different write paths.

## Decision

Consolidate every dashboard-owned artifact under a single hidden top-level folder:

```
my-project/
└── .project-manager/
    ├── config.json           ← was: .project-manager.json
    ├── features/             ← was: docs/features/
    │   ├── F01-auth.md       (optional spec docs per feature)
    │   └── .gitkeep
    └── dev-logs/             ← was: docs/dev-logs/
        ├── 2026-05-19.md
        └── .gitkeep
```

Per-user runtime data (agent sessions, run logs) does NOT live in this folder — it stays in the platform's app data directory (`~/Library/Application Support/project-manager/…` on macOS), so the project folder remains 100 % canonical, commit-safe, team-shareable data.

### What's in vs. out

| Category | Inside `.project-manager/`? | Why |
|---|---|---|
| `config.json` | yes | canonical project state, must be committed |
| `features/<id>.md` (spec docs) | yes | team-shared feature documentation |
| `dev-logs/YYYY-MM-DD.md` | yes | shared work-log history |
| Agent session JSON files | **no** — `app_data_dir/projects/<id>/sessions/` | per-user, machine-local, can be large |
| Agent run-logs (stdout/stderr) | **no** — `app_data_dir/projects/<id>/run-logs/` | per-user, ephemeral, noisy |
| `.gitignore` exceptions | **none required** | everything inside is meant to be committed |

### Migration strategy (single round)

For backward compatibility on already-tracked projects:

1. **New projects** initialize directly into the new layout.
2. **Existing projects** with only `<root>/.project-manager.json` auto-migrate on first read:
   - Create `<root>/.project-manager/` and subdirs.
   - Move (rename) `<root>/.project-manager.json` → `<root>/.project-manager/config.json`.
   - Add `.gitkeep` to `features/` and `dev-logs/`.
3. **Read fallback** in the bridge layer also tolerates a project that still has the legacy file (e.g. on a machine where migration was interrupted), so the dashboard never goes blank because of a partial migration.

Schema (`schemaVersion`) is **not** bumped — the JSON shape inside `config.json` is identical to the previous `.project-manager.json`. This is a storage-layout change, not a schema change (ADR-002 applies to JSON shape, not file location).

### Why a hidden folder

- Mirrors `.git/`, `.vscode/`, `.idea/`, `.claude/` — engineers immediately recognise "this is tool config".
- IDEs and shells collapse it by default, so the engineer's own file tree isn't polluted.
- Naming continues from the existing `.project-manager.json`, so existing users have minimal cognitive friction.

## Alternatives considered

1. **Visible `pm-dashboard/`** — rejected: pollutes file trees and looks like project content.
2. **Leave files scattered (status quo)** — rejected: see Background.
3. **Move per-user runtime data inside the folder too** — rejected: would require `.gitignore` exceptions, conflate canonical and ephemeral data, and risk committing local API conversation history.
4. **Bump `schemaVersion` to 5** — rejected: nothing inside the JSON changes; only its filesystem location does. Bumping would falsely signal that consumers of older `schemaVersion: 4` files need to upgrade their parsers.

## Consequences

- All path constants in TS / Rust update from `.project-manager.json` → `.project-manager/config.json`.
- The `daily-report` slash command writes to `.project-manager/dev-logs/` (was `docs/dev-logs/`).
- `initialize_project` (Rust) creates the new folder layout instead of `docs/features` + `docs/dev-logs`.
- Bridge `readConfig` is unchanged in behaviour for callers; under the hood it falls back to the legacy path so any project that didn't complete migration still loads.
- A new Rust command `migrate_project_layout` is the explicit migration entry-point; the import flow calls it immediately after an old layout is detected, so the user sees the move happen exactly once per legacy project.
- The features-as-individual-markdown refactor (`features/<id>.md` as canonical, not just spec docs) is **deferred** to a follow-up; for now `config.json` still owns the features array and `features/` directory is for spec docs only.

## References

- ADR-002 — schema versioning (NOT triggered by this change).
- ADR-004 — Anthropic key isolation (no impact).
- ADR-006 / ADR-007 — schema v2 / v3 feature shape (preserved).
