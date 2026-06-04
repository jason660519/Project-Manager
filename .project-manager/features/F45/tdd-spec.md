# F45 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F45 exists with phase `development` unless intentionally changed |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text, not an artifact path |

## Suite B: Core behavior

| Case | User action | Expected |
| --- | --- | --- |
| B1 | Engineer runs `npm run verify:quick` on docs-only changes | Command runs docs governance and standards/governance checks appropriate for docs, while skipping TS/Rust/test/build with explicit output |
| B2 | Engineer runs `npm run verify:quick` after TS/UI changes | Command runs typecheck, static-export hygiene, i18n/native-dialog guards, and focused/full tests as configured |
| B3 | Engineer runs `npm run verify:quick` after Rust/Tauri changes | Command runs `cargo check` when cargo exists and still runs typecheck for bridge surface safety |
| B4 | Engineer runs `npm run verify:quick` after schema/config-shape changes | Command escalates to full `verify:baseline` because migration/build/test risk is broad |
| B5 | Engineer runs final ship workflow | Docs instruct one full baseline after syncing main, before commit/push/PR, rather than repeated baseline at every git sub-step |
| B6 | Standards owner reviews governance expectations | Docs separate scheduled Company Standards/advisory scans from per-diff blockers |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Existing routes or sheets regress | Focused tests or manual smoke cover affected routes |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |
| C4 | `origin/main` is unavailable | Quick verification falls back to local changed files without failing before checks run |
| C5 | CI diverges from local docs | Verification runbook states CI baseline remains authoritative for PR/main, with local standards skipped only where unavailable |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F45-M01 | Quick docs workflow | Edit or inspect docs-only diff, then run `npm run verify:quick` | Output shows docs-focused gate and explicit skips |
| F45-M02 | Quick code workflow | Inspect TS/script diff, then run `npm run verify:quick` | Output shows code-focused checks and does not silently skip risk gates |
| F45-M03 | Final landing workflow | Review ship docs | One merged-state `verify:baseline` remains required before PR/main landing |

## Required Verification

- Focused tests for changed behavior.
- `npm run docs:check` when docs or feature artifacts change.
- `bash -n scripts/verify-quick.sh` if the quick script is added.
- `npm run verify:quick` at least once in this session.
- `npm run docs:check` after docs and feature artifacts change.
