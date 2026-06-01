# Verify Before Complete

> Status: Active  
> Last updated: 2026-06-01  
> Primary command: `npm run verify:baseline`

Run this workflow when an AI engineer is about to mark work **done**, set feature progress to **100%**, or offer **commit/PR**.

## Trigger Phrases

- `verify before complete`
- `收尾驗證`
- `可以 commit 了嗎`
- `verification passed` (use this workflow to **prove** it, not to claim it)

## Steps

1. `npm run verify:baseline` — all green.
2. UI/routing changes: manual smoke in Chrome/Safari/Tauri on port 43187 (see `docs/engineering/verification-runbook.md` §6.3).
3. Update `dev-log.md` with commands **actually run**.
4. Do **not** commit unless the user explicitly asks.

Full skill: `.claude/skills/verify-before-complete/SKILL.md`
