# Project Manager Commercial Readiness Status

> Date: 2026-05-24  
> Owner: Codex  
> Scope: Local desktop/browser development readiness for Project Manager

## Current Status

Project Manager is not yet commercial-release ready, but the local development baseline is healthy. The current codebase now includes commercial-readiness work around AI project initialization, section/evidence validation, GitHub URL detection, GitHub issue sync pagination, and launcher automation.

## Verified Baseline

The following checks passed in this commercial-readiness checkpoint:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run test` | Pass, 71 files / 543 tests |
| `npm run docs:check` | Pass |
| `npm run docs:site:check` | Pass |
| `bash -n start_project_manager.sh` | Pass |
| `bash -n scripts/next-dev-if-needed.sh scripts/hermes-agent.sh scripts/openclaw.sh scripts/sync-openclaw-env.sh scripts/install-openclaw.sh scripts/install-hermes-agent.sh` | Pass |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass |
| `npm run build` | Pass |
| `npm run standards:check` | Pass with one existing P2 advisory for hard-coded colors |
| `PROJECT_MANAGER_NO_OPEN=1 ./start_project_manager.sh web` | Pass outside the sandbox; reused the existing Next.js dev server on port `43187` without opening a browser |

## Commercial-Readiness Checkpoints

1. Runtime correctness: keep AI initialization honest with provider fallback traces, model selection safeguards, validation metadata, and persisted initialization run evidence.
2. Startup reliability: keep `start_project_manager.sh` idempotent, browser-safe, and clear about PM, Hermes, OpenClaw, and helper-page status.
3. Core workflow validation: verify add/import project, initialize project scan, GitHub URL detection/editing, GitHub issue sync, dashboard tab flows, and dispatch/run visibility.
4. Error and empty states: show missing provider keys, malformed scan output, low-confidence feature locations, missing GitHub remotes, and blocked startup states without implying success.
5. Documentation alignment: keep bridge/runtime docs, verification runbook, README launcher notes, and project-process status current whenever command contracts or startup behavior change.

## Known Commercial Blockers

| Area | Status | Evidence / Next Step |
| --- | --- | --- |
| Packaged desktop release | Not verified | `npm run tauri:build` has not been run in this checkpoint. Required before a release candidate. |
| Live AI provider initialization | Partially verified | Unit tests cover fallback, validation, and model selection. A real provider-key scan still needs an operator-owned credential check. |
| Live GitHub sync | Partially verified | Browser route and Rust paths are covered by tests/typecheck. A real GitHub token sync should be run before release. |
| Live agent dispatch | Not reverified | Existing UI/run tests pass, but a full Tauri dispatch with logs, PID, and kill path should be rechecked before commercial beta. |
| Standards advisory | Open | `verification-runbook.md` already records the P2 hard-coded color advisory from `standards:check`. |

## Next Recommended Checkpoint

Run launcher-safe local startup validation with `PROJECT_MANAGER_NO_OPEN=1`, then perform a short manual workflow pass in browser mode: add local project, edit/detect GitHub URL, open Project Progress Dashboard, sync GitHub issues with a test token, and confirm initialization failure states are understandable when provider keys are missing.
