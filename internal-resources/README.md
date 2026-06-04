# Internal Resources

This directory stores Project Manager-owned snapshots that replace previous
dependencies on external SSD paths.

## Contents

| Path | Purpose |
| --- | --- |
| `company-ai-app-standards/` | Snapshot of the company standards files that older docs referenced through an external SSD path. |
| `projects/owner-property-management-ai-spa/` | Minimal bundled project snapshot used by Project Manager sample/seed configuration. |
| `workspaces/` | Local placeholder workspace roots for fallback xmux rows that previously pointed at external SSD projects. |

## Rules

- Do not place secrets, `.env` files, credentials, build outputs, dependency
  folders, logs, or complete third-party worktrees here.
- Keep snapshots minimal and limited to files Project Manager actually reads.
- Record any added snapshot in `docs/engineering/external-ssd-internalization-report.md`.

