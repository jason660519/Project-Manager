# Project Manager — Gemini Shell

> **Shared facts for all AI agents live in [`AGENTS.md`](./AGENTS.md).**
> Read it first. This file holds Gemini-specific guidance only.

## Gemini-specific surfaces

- **Context7 MCP is mandatory** for any library / framework / SDK / API / CLI / cloud
  service question. Run `resolve-library-id` → `query-docs` instead of relying on
  pre-trained knowledge — your training cutoff is older than this repo's deps.
- **Gemini Code Assist / Antigravity** users: respect the Iron Rules in `AGENTS.md` §4
  exactly; they are enforced by `npm run verify:baseline`.
- **No file-system writes outside the working tree.** Gemini Workspace integrations
  must not touch `~/.project-manager/` directly — go through the bridge or ask the user.
