# /docs-governance

Run Project Manager documentation governance workflow.

## What it does

1. Runs `./scripts/docs-governance-check.sh`.
2. Reports violations in naming, bilingual layout, and section order.
3. Optionally runs `./scripts/docs-governance-fix.sh` to apply common fixes.
4. Supports archive mode for deprecated docs.

## Usage

- `/docs-governance`
- `/docs-governance check-only`
- `/docs-governance fix-and-archive`

## Shell Shortcuts

- Check: `./scripts/docs-governance-check.sh`
- Fix common issues: `./scripts/docs-governance-fix.sh`
- Fix + archive one file: `./scripts/docs-governance-fix.sh . archive docs/some-file.md`

## Notes

- This command is intended for technical documentation under `docs/`.
- Bilingual rule is English block first, Chinese block second.
- Deprecated files must be moved to `docs/archive/` (not deleted).
