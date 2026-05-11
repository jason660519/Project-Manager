# docs-bilingual-governance

## Purpose

Standardize and maintain DevPilot documentation with bilingual block layout:

1. English section on top (`## English Version`)
2. Chinese section below (`## 中文版本`)
3. No mixed-language lines or mixed heading patterns
4. Archive deprecated files into `docs/archive/`

## When To Use

Use this skill when user asks to:

- Check documentation naming/layout consistency
- Reformat docs into English-first and Chinese-second structure
- Archive outdated technical docs
- Normalize docs for release or handoff

## Inputs

- Target files or directory under `docs/`
- Optional archive reason and replacement file path

## Procedure

1. Run governance checker:
   - `./scripts/docs-governance-check.sh`
2. If failed, fix files by:
   - running `./scripts/docs-governance-fix.sh`
   - splitting mixed bilingual paragraphs
   - adding `## English Version` and `## 中文版本`
   - moving Chinese explanation below English section
3. Archive deprecated files:
   - move to `docs/archive/archived-YYYYMMDD-original-name.md`
   - or run `./scripts/docs-governance-fix.sh . archive docs/target-file.md`
   - add archive notice at top
4. Re-run checker until pass.
5. Summarize changed files and unresolved warnings.

## Guardrails

- Do not delete historical docs directly.
- Use English-only filenames.
- Keep code comments in English.
- Preserve existing technical meaning while rewriting format.

## Quick Commands

- Check only: `./scripts/docs-governance-check.sh`
- Check from custom root: `./scripts/docs-governance-check.sh /path/to/repo`
- Fix common issues: `./scripts/docs-governance-fix.sh`
- Fix and archive one file: `./scripts/docs-governance-fix.sh . archive docs/some-file.md`
