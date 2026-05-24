# Project Manager Commercial Readiness Update

> Date: 2026-05-25  
> Owner: Codex  
> Scope: Post-Gemini commit verification, packaged desktop build check, live browser-mode integration testing, and Tauri command-path smoke tests

## Summary

Gemini's pushed commits are present on `main` and the working tree was clean before this pass started. The checkpoint found one committed-state issue: the documentation-site generated manifests were stale after the new UI components report was added. Running `npm run docs:site:sync` updated the generated manifests and `npm run docs:site:check` now passes.

The packaged desktop release blocker has moved from "not verified" to "build verified locally": `npm run tauri:build` completed and produced both a macOS `.app` bundle and an Apple Silicon `.dmg`.

Live browser-mode testing also found and fixed two integration gaps:

1. The web registry sync skipped existing non-empty project snapshots, so Project Manager stayed at 20 features in the UI even after `.project-manager/config.json` was updated to 24 features.
2. The Issues tab treated browser-mode GitHub authorization as a renderer/localStorage concern even though `/api/github/sync` reads `GITHUB_TOKEN` from the server environment.

Both gaps now have regression coverage.

Tauri command-path testing also moved forward today: the Rust GitHub issue fetch path was verified with the real Project Manager repository and the local agent process path now has coverage for stdout streaming, stderr streaming, PID return, kill, and exit event propagation.

Desktop UI testing with `tauri dev` verified the dashboard can hydrate Project Manager from disk as 24 features with its GitHub URL, and the Issues tab can sync issue `#7` through the desktop app. That pass also found a dispatch-source routing bug: an issue from Project Manager could open the dispatch modal with the currently selected project's execution target. The modal now receives the issue source project and uses that project's adapters, default IDE, engineer roles, and project root.

## Verified Today

| Check | Result | Notes |
| --- | --- | --- |
| `git fetch --prune && git status --short --branch` | Pass | Local `main` matched `origin/main`; no uncommitted changes at start. |
| `.project-manager/config.json` feature inventory | Pass | 24 features: 12 `todo`, 10 `done`, 2 `in_progress`. |
| `npm run docs:check` | Pass | Docs governance passed. |
| `npm run docs:site:check` | Initially failed, then passed | Fixed by `npm run docs:site:sync`; manifests now include 53 internal-preview docs and 5 public docs. |
| `npm run standards:check` | Pass with P2 advisory | Existing hard-coded color advisory remains; no P0/P1 failure. |
| `npm run test -- --run __tests__/githubSyncRoute.test.ts` | Pass | 1 file / 3 tests. |
| `npm run test -- --run __tests__/ProjectProgressClient.issue-dispatch.test.tsx __tests__/IssuesTab.test.tsx __tests__/MainClient.sync.test.tsx` | Pass | 3 files / 28 tests after live-test fixes. |
| `npm run typecheck` | Pass | `next typegen` and `tsc --noEmit` passed. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Pass | Rust dev-profile check passed. |
| `npm run test` | Pass | 72 files / 546 tests. |
| `npm run build` | Pass | Next production build generated 56 static pages. |
| Shell syntax check | Pass | `start_project_manager.sh` plus launcher helper scripts passed `bash -n`. |
| `npm run tauri:build` | Pass | Produced `src-tauri/target/release/bundle/macos/Project Manager.app` and `src-tauri/target/release/bundle/dmg/Project Manager_0.1.0_aarch64.dmg`. |
| `PROJECT_MANAGER_NO_OPEN=1 ./start_project_manager.sh web` | Pass | Next dev server reached ready state on port `43187`; `/` and `/project-progress-dashboard` returned HTTP 200. |
| Live `/api/github/sync` against `jason660519/Project-Manager` | Pass | Returned 1 closed issue and did not set truncation header. |
| Live Issues tab sync in browser UI | Pass after fix | UI displayed issue `#7 plug in 尚未完成` and `Synced 1 repo(s) · 1 issues`. |
| Rust `fetch_github_issues` against `jason660519/Project-Manager` | Pass | Ignored live test passed with `GITHUB_TOKEN`; confirmed issue `#7` is returned through the Rust command implementation. |
| Rust `spawn_agent_process` lifecycle | Pass | Spawned a safe shell command, captured stdout/stderr, killed the process by PID, and observed exit code `-1`. |
| `tauri dev` dashboard hydration | Pass | Desktop UI showed Project Manager with 24 features and `https://github.com/jason660519/Project-Manager`. |
| `tauri dev` Issues tab sync | Pass | Desktop UI synced `#7 plug in 尚未完成` and showed `Synced 1 repo(s) · 1 issues`. |
| Issue dispatch source routing | Pass after fix | Added regression coverage so issue dispatch uses the issue source project instead of the currently selected project. |
| Live `/api/keys/validate` Anthropic | Pass | Returned 9 model IDs. |
| Live `/api/keys/validate` GitHub | Pass | Token validation returned `ok: true`. |

## New Finding

`npm run tauri:build` prints a non-blocking Tauri warning:

```text
The bundle identifier "io.projectmanager.app" set in "tauri.conf.json" identifier ends with ".app".
This is not recommended because it conflicts with the application bundle extension on macOS.
```

The build still succeeds. Context7 Tauri v2 docs confirm the identifier is the value used for macOS app identity and provisioning. Because changing it can affect app identity, signing, provisioning, and stored user state, this pass records the warning rather than changing it without an explicit product/release identity decision.

## Current Commercial Blockers

| Area | Status | Next Step |
| --- | --- | --- |
| Packaged desktop release | Locally build-verified | Decide whether to change the bundle identifier before signing/notarization; then run signed release packaging. |
| Live AI provider initialization | Partially verified | Run a real provider-key initialization scan with operator-owned credentials. |
| Live GitHub sync | Browser route and Rust command path verified | Still needs full packaged-app UI verification through Tauri IPC before beta. |
| Live agent dispatch | Core Rust lifecycle and modal routing verified | Still needs an operator-approved full agent run from the Tauri UI with logs, PID display, and kill controls. |
| Standards advisory | Open P2 | Tokenize hard-coded colors after runtime blockers are handled. |

## Recommended Next Work

1. Verify Tauri GitHub issue sync from the packaged or `tauri dev` app UI, now that the Rust command path has a live smoke test.
2. Run an operator-approved Tauri UI dispatch against a safe configured target, now that the Rust lifecycle path and issue source routing have regression coverage.
3. Run a real project initialization scan now that provider-key validation is confirmed.
4. Decide the permanent Tauri bundle identifier before any signed/notarized beta.
5. Clean the P2 hard-coded color advisory once runtime blockers are resolved.
