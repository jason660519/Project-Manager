# F45 Dev Log - Tiered Verification Workflow

## 2026-06-04 - Kickoff

### Context

Feature checkpoint created before implementation so Project Dashboard > Development, specs, tests, and dev logs stay aligned.

### Planned Work

1. Register F45 and complete feature artifacts before code changes.
2. Add a `verify:quick` script/npm entrypoint for changed-file-aware checks.
3. Update ship and verification docs so quick checks, PR baseline, and scheduled
   Company Standards governance have distinct responsibilities.
4. Run shell/docs verification and at least one quick verification command.
5. Record results and follow-ups here.

### Design Decision

Keep the optimization conservative:

- Quick checks improve daily development and commit preparation.
- Full `verify:baseline` remains mandatory before final PR/main landing.
- Scheduled Company Standards governance is recommended for cross-app/advisory
  drift, but it does not replace per-diff correctness checks.

This avoids trading time savings for a fragile `main`.

### Verification Log

- Completed: Required reading for workflow, design, file naming, architecture,
  table governance, README, CLAUDE, and verification context.
- Completed: `npm run feature:kickoff -- --title "Tiered Verification Workflow" ...`
  created F45 artifacts and Development sheet metadata.
- Completed: `bash -n scripts/verify-quick.sh` passed.
- Completed: JSON parse check for `package.json` and `.project-manager/config.json` passed.
- Completed: `npm run verify:quick -- --dry-run` passed after fixing macOS Bash
  compatibility and untracked-file detection.
- Completed: `npm run verify:quick` passed:
  - `npm run docs:check` passed.
  - `bash -n scripts/verify-quick.sh` passed.
  - `npm run typecheck` passed.
  - `node scripts/check-static-export-hygiene.mjs` passed.
  - `node scripts/check-native-dialogs.mjs` passed.
  - `node scripts/check-ui-i18n.mjs` passed.
  - `npm test` passed: 136 files, 932 tests.
  - `cargo check` skipped because no Rust/Tauri files changed.
- Completed: `npm run verify:baseline` passed:
  - `npm run typecheck` passed.
  - Company Standards check exited 0 with existing P2 hard-coded color advisory
    (`P0=0 P1=0 P2=1`).
  - `npm run docs:check` passed.
  - `node scripts/audit-table-sheets.mjs --check` passed: 29 surfaces, 0 blocking.
  - Static export hygiene, native dialog guard, and UI i18n guard passed.
  - `npm test` passed: 136 files, 932 tests.
  - `cargo check --manifest-path src-tauri/Cargo.toml` passed.
  - `npm run build` passed and generated 103 static pages.
- Completed: final `npm run verify:baseline` after completed metadata/dev-log
  update passed with the same result:
  - Company Standards exited 0 with existing P2 hard-coded color advisory
    (`P0=0 P1=0 P2=1`).
  - `npm test` passed: 136 files, 932 tests.
  - `cargo check --manifest-path src-tauri/Cargo.toml` passed.
  - `npm run build` passed and generated 103 static pages.
- Completed: post-baseline metadata sanity check restored unrelated F39 status
  and verified F45 is the only newly completed Development sheet item in this
  change.
- Completed: final `npm run verify:baseline` after F45 metadata correction
  passed:
  - Company Standards exited 0 with existing P2 hard-coded color advisory.
  - `npm test` passed: 136 files, 932 tests.
  - `cargo check --manifest-path src-tauri/Cargo.toml` passed.
  - `npm run build` passed and generated 103 static pages.
