# Feature Resume Command

> Status: Active  
> Last updated: 2026-05-28  
> Audience: OpenAI/Codex and Claude agents working in Project Manager

This command resumes an existing Project Manager Development-sheet feature ID. Use it when continuing a teammate's work, continuing yesterday's work, or picking up a feature that already has `.project-manager/features/<ID>/` artifacts.

## Trigger Phrases

Run this workflow when the user asks for any of:

- `/feature-resume F36`
- `feature-resume F36`
- `接續 F36`
- `接續同事的 feature id`
- `繼續今天的 work id`
- `繼續 F36 開發`
- `接手既有 feature`

## Flags And Arguments

Use the repo-local resume script whenever possible:

```bash
npm run feature:resume -- --id F36 --progress 70 --notes "Resume xmux resize profiling" --plan "Profile xmux resize and native browser bounds sync"
```

| Flag | Behavior |
| :-- | :-- |
| `--id F36` | Required. Existing feature ID to resume. Positional `F36` is also accepted. |
| `--progress 70` | Optional progress update. |
| `--status in_progress` | Optional status update. |
| `--phase development` | Optional phase update. |
| `--notes "<summary>"` | Optional short dashboard notes. Never put artifact paths here. |
| `--plan "<summary>"` | Optional continuation plan appended to `dev-log.md`. |
| `--updated-by "Codex"` | Optional actor; defaults to `Codex`. |
| `--dry-run` | Print the planned change without writing files. |
| `--no-devlog` | Update metadata only; use only for administrative progress changes. |

## Workflow

### Step 1. Preflight

- Check `git status --short --branch`.
- Confirm the user wants to continue an existing feature, not create a new one.
- If the scope has changed into a separate product feature, recommend `/feature-kickoff` for a new ID instead.

### Step 2. Resolve And Read Feature Context

- Read `.project-manager/config.json`.
- Locate the exact `feature.id`; do not infer from array position.
- Read all available canonical artifacts:
  - `README.md`
  - `feature-spec.md`
  - `tdd-spec.md`
  - `test-scenarios.md`
  - `dev-log.md`
- Summarize current state before coding:
  - completed work
  - remaining work
  - next smallest implementation slice
  - relevant tests and manual checks

### Step 3. Append Continuation Log

Run:

```bash
npm run feature:resume -- --id F36 --plan "<today's continuation plan>" --notes "<dashboard summary>"
```

The script appends a dated continuation block to `dev-log.md`, updates `feature.updatedAt`, and optionally updates progress, status, phase, and notes.

### Step 4. Continue Implementation

Only after the resume checkpoint is recorded, continue implementation. Keep changes aligned with the existing feature spec and TDD spec. If the implementation reveals new user scenarios, update `test-scenarios.md` before or alongside the fix.

## Verification

For resume metadata/script changes:

```bash
node --check scripts/resume-feature-checkpoint.mjs
npm run feature:resume -- --id F36 --plan "Dry run resume" --dry-run
npm run docs:check
```

If docs commands changed, also run:

```bash
npm run docs:site:sync
npm run docs:site:check
```

## Final Response

Reply in Traditional Chinese with:

```text
已完成 Feature Resume

Feature: <ID> - <name>
Artifacts reviewed: README/spec/TDD/scenarios/dev-log
Dev log: appended / skipped
Dashboard metadata: updated / not changed
Verification: <commands and result>
Next: <implementation slice>
```

## Notes

- Do not create a new ID when the work still belongs to the existing feature scope.
- Do create a new feature when the scope becomes a distinct product capability.
- Do not overwrite teammate artifacts unless the user explicitly asks for a rewrite.
- Do not fabricate previous verification results; quote only what is present in the artifacts or current run.
