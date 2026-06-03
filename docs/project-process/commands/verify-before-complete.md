# Verify Before Complete

> Status: Active  
> Last updated: 2026-06-01  
> Primary commands: `npm run verify:baseline` and, for UI routes, `npm run verify:dev-issues`

Run this workflow when an AI engineer is about to mark work **done**, set feature progress to **100%**, or offer **commit/PR**.

## Trigger Phrases

- `verify before complete`
- `收尾驗證`
- `可以 commit 了嗎`
- `verification passed` (use this workflow to **prove** it, not to claim it)

## Steps

1. `npm run verify:baseline` — all green.
2. UI/routing changes: run `npm run dev`, then `npm run verify:dev-issues -- --routes /changed-route[,/another-route]`.
3. UI/routing changes: manual smoke in Chrome/Safari/Tauri on port 43187 (see `docs/engineering/verification-runbook.md` §6.3); the Next.js dev **Issues** badge must remain **0** after interaction.
4. Update `dev-log.md` with commands **actually run**.
5. Do **not** commit unless the user explicitly asks.

Full skill: `.claude/skills/verify-before-complete/SKILL.md`
