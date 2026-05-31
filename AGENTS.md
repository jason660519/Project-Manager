# AGENTS.md

This project follows Company AI App Standards v0.2.

## Required Reading

Before implementation, read:

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
11. `./docs/architecture/architecture-overview.md`
12. `./docs/architecture/README.md`

## Project Overrides

Project Manager-specific implementation rules live in:

- `./DESIGN.md`
- `./CLAUDE.md`
- `./docs/file-naming-standards.md`
- `./docs/design/shared-ai-desktop-style.md`
- `./docs/architecture/`
- `./.claude/skills/table-and-sheet-layout/SKILL.md`
- `./.agents/skills/table-and-sheet-layout/SKILL.md`

If Project Manager must deviate from company standards, create an ADR under `docs/architecture/`.

## Documentation Standards

Use the company documentation rules plus Project Manager's repo-local docs governance:

```bash
npm run standards:check
npm run docs:check
```

## OpenAI/Codex Workflow Commands

Claude `.claude/commands/*.md` files are not automatically exposed as Codex slash commands. For Project Manager, durable OpenAI/Codex workflow commands live under `docs/project-process/commands/`.

When the user asks for `/daily-report`, `daily-report`, `每日工作日誌`, or a similar daily progress report request, follow `docs/project-process/commands/daily-report.md` and write the report under `docs/project-process/` using the repo-local date-prefixed filename convention.

When the user asks for `/debug-retro`, `debug-retro`, `沉澱本次debug經驗`, or asks to convert a debugging session into reusable TDD/E2E scenarios, follow `docs/project-process/commands/debug-retro.md` and update the affected feature's `debug-retro.md`, `test-scenarios.md`, and dashboard metadata.

When the user asks for `/feature-kickoff`, `feature-kickoff`, `新增今天工作ID`, `先登記Development sheet`, `先建Feature Spec/TDD/Dev log`, or asks to create the feature checkpoint before implementation, follow `docs/project-process/commands/feature-kickoff.md` and use `npm run feature:kickoff -- ...` to create or update the Development sheet feature entry and canonical `.project-manager/features/<ID>/` artifacts before code changes.

When the user asks for `/feature-resume Fxx`, `feature-resume`, `接續 Fxx`, `接續同事的 feature id`, or asks to continue an existing work ID, follow `docs/project-process/commands/feature-resume.md` and use `npm run feature:resume -- --id Fxx ...` to read the existing feature artifacts, append a continuation block to `dev-log.md`, and update Development sheet metadata before code changes.

## Context7

Use Context7 MCP to fetch current documentation whenever the task asks about a library, framework, SDK, API, CLI tool, or cloud service. Start with `resolve-library-id` unless the user provides an exact `/org/project` library ID, then use `query-docs` with the selected library ID and the full question.

Do not use Context7 for refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.
