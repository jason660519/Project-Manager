# Project Manager — Claude Code Shell

> **Shared facts for all AI agents live in [`AGENTS.md`](./AGENTS.md).**
> Read it first. This file holds Claude-Code-specific guidance only.
>
> Tier model (see [`docs/engineering/multi-ai-config.md`](./docs/engineering/multi-ai-config.md)):
> 1. Global — `~/.claude/CLAUDE.md` (personal preferences, all projects)
> 2. Project — this file + `AGENTS.md` (team-shared, in git)
> 3. Local — `./.claude/local.md` (per-user, gitignored, optional)

## Skills routing

| Phase | Skill | Trigger |
|---|---|---|
| Design a non-trivial change | `plan-review` | Before ExitPlanMode |
| Debug bug / regression / IPC failure | `investigate` | Stack trace / "it was working" |
| Any table / sheet / tab-panel view | `table-and-sheet-layout` | New / modified view |
| Final diff audit | `pre-landing-review` | Before `git push` |
| **Mark done / wrap up / UI complete** | **`verify-before-complete`** | **Before 100%, commit, PR, or "verification passed"** |
| Ship (verify → commit → push → PR) | `ship` | "ship it / land this" |
| Save / resume session state | `context-save` / `context-restore` | "checkpoint" / "where was I" |
| Audit / clear an open PR | `check-pr` / `pr-review-loop` | "check the PR" / "clear reviewer bots" |
| Bilingual doc edits | `docs-bilingual-governance` | Editing `docs/*.md` |

Skill sources of truth live in [`./.agents/skills/`](./.agents/skills/);
`.claude/skills/` are symlinks back to those (Claude-only skills like
`check-pr` and `pr-review-loop` stay in `.claude/skills/`).

## Claude-Code-specific surfaces

- **Slash commands** under [`.claude/commands/`](./.claude/commands/) (not auto-shared with
  other agents — Codex equivalents live under `docs/project-process/commands/`).
- **`/loop`** for self-paced recurring tasks.
- **`/code-review ultra`** for multi-agent cloud review (user-triggered, billed).
- **Subagent types** like `Explore`, `Plan` for fan-out search and architecture planning.

## Tier-3 personal overrides

Anything machine-specific (paths, in-progress conventions, personal workflow quirks)
goes into `./.claude/local.md` — Claude Code loads it automatically and it is
gitignored. **Do not** put personal preferences into this file or `AGENTS.md`.
