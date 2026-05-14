# AGENTS.md

This project follows Company AI App Standards v0.1.

## Required Reading

Before implementation, read:

1. `/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/ai-engineer-workflow.md`
2. `/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/ui-design-system.md`
3. `/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/file-naming-standards.md`
4. `./docs/file-naming-standards.md`
5. `./DESIGN.md`
6. `./docs/design/shared-ai-desktop-style.md`
7. `./README.md`
8. `./CLAUDE.md`
9. `./docs/architecture/architecture-overview.md`
10. `./docs/architecture/README.md`

## Project Overrides

DevPilot-specific implementation rules live in:

- `./DESIGN.md`
- `./CLAUDE.md`
- `./docs/file-naming-standards.md`
- `./docs/design/shared-ai-desktop-style.md`
- `./docs/architecture/`

If DevPilot must deviate from company standards, create an ADR under `docs/architecture/`.

## Documentation Standards

Use the company documentation rules plus DevPilot's repo-local docs governance:

```bash
npm run standards:check
npm run docs:check
```

## Context7

Use Context7 MCP to fetch current documentation whenever the task asks about a library, framework, SDK, API, CLI tool, or cloud service. Start with `resolve-library-id` unless the user provides an exact `/org/project` library ID, then use `query-docs` with the selected library ID and the full question.

Do not use Context7 for refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.
