# Daily Report Command

> Status: Active  
> Last updated: 2026-05-18  
> Audience: OpenAI/Codex agents working in Project Manager

This command is the Project Manager equivalent of the legacy Claude `/daily-report` workflow. It is not an app runtime feature. It is an AI workflow contract for OpenAI/Codex agents to generate a durable daily work log from the current conversation and repository state.

## Trigger Phrases

Run this workflow when the user asks for any of:

- `/daily-report`
- `daily-report`
- `每日工作日誌`
- `每日進度報告`
- `今天的工作日誌`
- `產生今天工作報告`

## Flags

| Flag | Behavior |
| :-- | :-- |
| `--chat-only` | Produce the report in chat only; do not create or update files. |
| `--no-verify` | Skip verification commands, but state clearly that verification was skipped. |

## Workflow

### Step 1. Gather Context

- Review the current conversation and tool results.
- Check `git status --short` so the report can separate this session's work from unrelated dirty worktree changes.
- Read any directly relevant runbooks under `docs/engineering/`.
- If the work touched plugin/runtime boundaries, mention state isolation, source location, and verification status.

### Step 2. Decide Whether To Write A Report

Write a report when the day included implementation, debugging, architecture decisions, plugin/runtime installation, docs changes, or verification.

If the day was pure discussion with no durable project impact, say in chat that no report is needed.

### Step 3. Create The Dev Log

Create one Markdown file under `docs/project-process/`:

```text
docs/project-process/YYYY-MM-DD-kebab-case-summary.md
```

Use this structure:

1. `Summary`
2. `Completed Work`
3. `Deliverables`
4. `Technical Issues And Root Causes`
5. `Decisions`
6. `Verification`
7. `Risks And Follow-Ups`
8. `Next Priority`

Keep the report factual. Do not invent tasks, verification results, issue IDs, or roadmap state.

### Step 4. Update Project Progress Only When Applicable

Project Manager does not currently have the Owner SPA `roadmap.ts` workflow. Do not update a roadmap by default.

Project Manager feature-local artifacts use the schema v6 document contract:

| Artifact | Config field |
| :-- | :-- |
| `.project-manager/features/<ID>/README.md` | `feature.readmePath` |
| `.project-manager/features/<ID>/feature-spec.md` | `feature.paths.spec` |
| `.project-manager/features/<ID>/tdd-spec.md` | `feature.paths.tdd` |
| `.project-manager/features/<ID>/dev-log.md` | `feature.paths.developmentLogSummaryFolder` points to the feature folder |

`feature.notes` is short summary text only. Do not put README or artifact paths in `notes`.

Only update `.project-manager.json` or feature progress fields when:

- the user explicitly asks for a feature/row progress update; or
- the current task clearly maps to an existing Project Manager feature entry and the requested progress change is unambiguous.

If no progress metadata was updated, state `Project progress metadata: not changed`.

### Step 5. Issue Creation

Project Manager has no VIS Paperclip issue workflow. Do not create external issues unless the user explicitly asks for that integration.

If the work produced follow-up risk, list it in the report's `Risks And Follow-Ups` section.

### Step 6. Verification

Run the narrowest relevant checks. For documentation-only changes, run:

```bash
npm run docs:check
```

For code or config changes, prefer:

```bash
npm run typecheck
npm run build
```

For repo standards changes, also run:

```bash
npm run standards:check
```

If a command fails, include the exact command, status, and cause.

### Step 7. Final Response

Reply in Traditional Chinese with:

```text
已完成每日工作日誌

Dev Log: <path>
Project progress metadata: <changed/not changed>
Verification: <commands and result>
Follow-ups: <short list or none>
```

## Notes

- Keep filenames English and date-prefixed.
- Do not store secrets, tokens, or full `.env` contents in the report.
- Mention ignored local runtime directories only by path, not by secret contents.
- If the report references generated local state under `.project-manager/`, make clear that it is intentionally git-ignored.
