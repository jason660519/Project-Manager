# AGENTS.md

This project follows Company AI App Standards v0.1.

## Required Reading

Before implementation, read:

1. `/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/ai-engineer-workflow.md`
2. `/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/ui-design-system.md`
3. `/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/patterns/table-governance.md`
4. `/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/file-naming-standards.md`
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

## Context7

Use Context7 MCP to fetch current documentation whenever the task asks about a library, framework, SDK, API, CLI tool, or cloud service. Start with `resolve-library-id` unless the user provides an exact `/org/project` library ID, then use `query-docs` with the selected library ID and the full question.

Do not use Context7 for refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.
