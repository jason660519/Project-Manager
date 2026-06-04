# AGENTS.md

This project follows Company AI App Standards v0.2.

## Required Reading

Before implementation:

1. `/Users/Company-AI-App-Standards/docs/ai-engineer-workflow.md`
2. `/Users/Company-AI-App-Standards/docs/ui-design-system.md`
3. `/Users/Company-AI-App-Standards/docs/patterns/table-governance.md`
4. `/Users/Company-AI-App-Standards/docs/file-naming-standards.md`
5. `./docs/file-naming-standards.md`
6. `./docs/engineering/table-standards.md`
7. `./DESIGN.md`
8. `./docs/design/shared-ai-desktop-style.md`
9. `./README.md`
10. `./CLAUDE.md`
11. `./docs/architecture/architecture-overview.md` + `./docs/architecture/README.md`

## Project Overrides

PM-specific rules live in: `./DESIGN.md`, `./CLAUDE.md`, `./docs/file-naming-standards.md`, `./docs/design/shared-ai-desktop-style.md`, `./docs/architecture/`, and the `table-and-sheet-layout` + `verify-before-complete` skills (under both `./.claude/skills/` and `./.agents/skills/`).

## Internal Resource Paths

No removable-volume absolute paths. Externalized resources are internalized under `./internal-resources/`; read `./docs/engineering/external-ssd-internalization-report.md` before adding, moving, or reintroducing project/sample resource paths.

## Completion gate (mandatory)

Before claiming **done**, marking a feature **100%**, or offering **commit/PR**: run `npm run verify:baseline` and follow `./.claude/skills/verify-before-complete/SKILL.md`. UI changes also require manual browser smoke in Chrome/Safari/Tauri (not the Cursor embedded browser alone) — `./docs/engineering/verification-runbook.md` §6. **Ship blocker:** Next.js dev **Issues** count must be **0** on changed routes; Tauri events use `safeUnlisten` / `subscribeAgentProcessEvents` per `docs/engineering/runtime-bridge.md` §4.

If Project Manager must deviate from company standards, create an ADR under `docs/architecture/`.

## Documentation Standards

```bash
npm run standards:check
npm run docs:check
```

## OpenAI/Codex Workflow Commands

Claude `.claude/commands/*.md` are not auto-exposed as Codex slash commands. Durable Codex workflows live under `docs/project-process/commands/`. When the user invokes one (or its aliases), follow that command doc:

| Command / triggers | Doc (`docs/project-process/commands/`) | Action |
|---|---|---|
| `/daily-report`, `每日工作日誌` | `daily-report.md` | Write date-prefixed progress report under `docs/project-process/` |
| `/debug-retro`, `沉澱本次debug經驗` | `debug-retro.md` | Update feature `debug-retro.md`, `test-scenarios.md`, dashboard metadata |
| `/feature-kickoff`, `新增今天工作ID`, `先登記Development sheet` | `feature-kickoff.md` | `npm run feature:kickoff -- …` → Development sheet entry + `.project-manager/features/<ID>/` artifacts **before** code |
| `/feature-resume Fxx`, `接續 Fxx` | `feature-resume.md` | `npm run feature:resume -- --id Fxx …` → append dev-log continuation + update metadata **before** code |
| verify completion / `可以 commit 了嗎` | `verify-before-complete.md` | `npm run verify:baseline` + UI browser smoke before claiming done / commit / PR |

## Context7

Use Context7 MCP for current docs on any library / framework / SDK / API / CLI tool / cloud service. Start with `resolve-library-id` (unless given an exact `/org/project` ID), then `query-docs` with the full question. Do not use it for refactoring, writing scripts from scratch, business-logic debugging, code review, or general programming concepts.
