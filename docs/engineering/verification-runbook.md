# Verification Runbook

> Status: Active  
> Last updated: 2026-06-04
> Primary files: `package.json`, `scripts/verify-quick.sh`, `scripts/verify-baseline.sh`, `scripts/docs-governance-check.sh`, `src-tauri/Cargo.toml`, `vitest.config.ts`

---

## English Version

## 1. Standard Check Order

Use the tier that matches the workflow stage:

```bash
npm run verify:quick
```

Use `verify:quick` during development or before a local commit when the goal is
to catch changed-file risks without paying for the full release gate. It
classifies the current diff and runs the relevant subset: docs governance for
docs-only work, shell/Node syntax checks for script changes, TypeScript and
client hygiene for TS/UI changes, Rust `cargo check` for Tauri changes, and full
baseline for schema/storage/config-shape changes.

Run the full gate before handing off meaningful completion or landing work:

```bash
npm run verify:baseline
```

`verify:baseline` runs: `typecheck`, `standards:check`, `docs:check`, static-export hygiene scan, full `npm test`, `cargo check` (when available), and `npm run build`.

**Equivalent manual steps** (when debugging one failure):

```bash
npm run guard:legacy-surfaces
npm run docs:check
npm run standards:check
npm run verify:static-export
npm run typecheck
npm run test
cargo check --manifest-path src-tauri/Cargo.toml
npm run build
```

Use `verify:quick` for narrow local checks, but do not treat it as release
readiness. PR/main landing still requires one `verify:baseline` after syncing
the branch with `origin/main`.

## 2. What Each Check Covers

| Command | Covers | Notes |
| --- | --- | --- |
| `npm run guard:legacy-surfaces` | Retired Coding Editor entry, current `/xmux` route, draggable dashboard sheets | Also runs automatically before `npm run build`. |
| `npm run verify:quick` | Changed-file-aware local verification | Use during development and before local commits; escalates schema/storage changes to full baseline. |
| `npm run docs:check` | Filename safety, repo-local docs layout, bilingual heading order | Required after docs edits. |
| `npm run standards:check` | Company baseline standards | May report P2 advisory findings. |
| `npm run typecheck` | Next typegen and TypeScript correctness | Required after TS or UI edits. |
| `npm run test` | Vitest unit and component tests | Required after storage, UI state, parser, or helper changes. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Rust command type checks | Required after Tauri bridge or dependency changes. |
| `npm run build` | Static export build | Required before release or major UI changes. |
| `npm run verify:baseline` | **Single AI-engineer gate** — all of the above plus hygiene scan | Required before claiming done, 100%, commit, or PR. |
| `npm run verify:static-export` | Client-bundle / hydration anti-patterns only | Runs inside `verify:baseline`; use alone for quick UI diffs. |

## 3. Documentation-Only Minimum

For docs-only changes:

```bash
npm run verify:quick
```

If docs include code snippets that refer to command names or schema fields, also run targeted searches against source files to confirm names are current.

`verify:quick` runs `docs:check` for docs-only changes and explicitly skips
typecheck, tests, Rust, and build. Company Standards full/advisory scans should
run before standards-sensitive landing work or in scheduled governance; they do
not need to block every local docs-only commit unless the docs change standards
policy itself.

## 4. Release Readiness

Before a packaged desktop build:

1. Run the full check order.
2. Run `npm run branch:check`; confirm stale local branches are not the source of old UI behavior.
3. Run `npm run tauri:build`; the release secret backend guard must pass and fail if `PM_DEV_PLAINTEXT_SECRETS=1`.
4. Verify Browser mode still starts on port `43187`.
5. Verify Tauri mode can read a local `.project-manager.json`.
6. Verify secrets show configured state without rendering raw values.
7. Verify live agent dispatch shows command, working directory, PID, logs, and exit state.
8. Verify failed or blocked commands are not shown as successful.

## 5. Current Advisory

`standards:check` currently reports a P2 advisory for hard-coded color values outside docs, build, and icon folders. This is not a blocking P0 or P1 failure, but future UI cleanup should migrate repeated arbitrary colors into shared Tailwind tokens or documented design tokens.

## 6. AI Engineer Completion Contract

Automated tests alone are **not** sufficient for UI work. This section exists because partial verification (e.g. subset of tests without `npm run build`, or no browser open) has shipped broken static exports and hydration errors.

### 6.1 Mandatory automated gate

During development:

```bash
npm run verify:quick
```

This is the fast feedback gate. It may be enough to decide the next coding step,
but it is not enough to claim the feature is complete.

Before completion or landing:

```bash
npm run verify:baseline
```

All steps must exit 0 before:

- saying "verification passed" or "all green"
- setting Development sheet progress to **100%** or status `completed`
- offering git commit or PR (user must still explicitly request commit/PR)

Skill: `.claude/skills/verify-before-complete/SKILL.md`. Cursor rule: `.cursor/rules/verify-before-complete.mdc`.

For a commit-only request where the user is not asking to ship or open a PR,
`verify:quick` may be used as a pre-commit fast gate if the final response
states exactly what it covered. Do not call that "full verification passed."

### 6.2 Static-export hygiene (inside baseline)

`npm run verify:static-export` (`scripts/check-static-export-hygiene.mjs`) blocks:

| Pattern | Failure mode |
| --- | --- |
| Node `fs` import in client-reachable modules | `npm run build` / client bundle error |
| `useState(readStored…)` or `useState(() => localStorage…)` in `'use client'` files | React hydration mismatch |
| Missing `*.server.ts` split for sidecar / disk I/O | Same as fs leak |

**Fix:** constant SSR-safe initial state → `useEffect` hydrate → persist only after hydrated.

### 6.3 Manual browser smoke (UI / routing / client state)

After green `verify:baseline`:

1. `npm run dev` (port **43187**) or `npm run tauri:dev` for shell/bridge changes.
2. Open changed route(s) in **Chrome, Safari, or Tauri**.
3. DevTools Console: no React hydration errors on happy path.
4. Exercise one primary interaction on the changed surface.
5. **Zero runtime overlay errors:** the Next.js dev **Issues** badge (bottom-left, e.g. “1 Issue”) must be **0** on every changed route after smoke. Uncaught exceptions — including Tauri `unregisterListener` / `listeners[eventId].handlerId` from async event subscribe races — are **ship blockers**. Do not hand off with “fix later”.

Automated route check:

```bash
npm run verify:dev-issues -- --routes /changed-route[,/another-route]
```

Run this while `npm run dev` is serving port **43187**. The command reads the Next.js dev overlay and fails on any non-zero **Issues** badge, browser console error, or uncaught page error. Tauri-only shell/bridge behavior still needs manual Tauri smoke because the web route can be clean while the desktop shell raises a runtime overlay.

**Do not** use Cursor embedded browser as the only smoke test — it may inject `data-cursor-ref` and produce false hydration warnings.

Tauri event listeners: follow `docs/engineering/runtime-bridge.md` §4 (`safeUnlisten`, `cancelled` guard, `subscribeAgentProcessEvents`).

### 6.4 Fresh post-test QA environment

Use this when automated checks have finished and the next step is human testing in a clean desktop/browser environment:

```bash
npm run test:restart-pm
npm run verify:restart-pm
```

These commands run the selected test gate first. Only after a zero exit code do they call `/Users/Project-Manager/start_project_manager.sh restart`, which:

- closes old Project Manager browser tabs on port `43187` in Chrome, Edge, Brave, and Safari on macOS
- stops stale Project Manager Tauri, launcher, and Next.js dev-server processes
- confirms port `43187` is free before startup
- starts the Tauri desktop app in the background
- waits for `/project-progress-dashboard` to return healthy before reporting success
- performs a final delayed health check before returning success
- opens a fresh browser tab for manual QA

Operational controls:

- `npm run pm:restart` skips tests and performs the same cleanup/startup sequence.
- `./start_project_manager.sh start`, `all`, `core`, and `auto` perform the same clean-start preflight by default.
- `PROJECT_MANAGER_SKIP_BROWSER_CLEANUP=1` preserves existing browser tabs.
- `PROJECT_MANAGER_REUSE_EXISTING=1` intentionally reuses an already running local app instead of cleaning first.
- `PROJECT_MANAGER_AFTER_TEST_FINAL_CHECK_SECONDS=30` lengthens the wrapper's final stability window.
- Logs are written to `.project-manager/dev-logs/restart-after-tests.log` and `.project-manager/dev-logs/project-manager-desktop.log`.

### 6.5 dev-log honesty

`dev-log.md` must list commands **actually run** in the session, not a generic checklist copied from this doc.

## 7. CI and Local Git Hooks

### 7.1 GitHub Actions

Workflow: `.github/workflows/verify-baseline.yml`

Runs on every **pull request** and **push to `main`**: `npm run verify:baseline` (typecheck, docs, hygiene, full tests, `cargo check`, static build). Company `standards:check` is skipped in CI (`VERIFY_SKIP_STANDARDS=1`) because the standards repo path is machine-local; run `npm run standards:check` locally before ship.

### 7.1a Scheduled Company Standards Governance

Company Standards governance is the right home for recurring cross-app checks:

- `company-standards.sh check .` full/advisory scans.
- Color-token drift and P2 advisory reports.
- File naming and documentation layout trend reports across governed apps.
- App profile adoption and standards package extraction readiness.

Scheduled governance supplements PR checks; it does not replace per-diff
typecheck, tests, build, Rust, static-export, schema, bridge, or manual UI smoke.

### 7.2 Pre-commit hook (optional, recommended)

Install once per clone:

```bash
npm run githooks:install
```

Hooks live in `.githooks/pre-commit` and run **`npm run verify:static-export`** when staged files include `.ts` / `.tsx`. Fast guard against client `fs` leaks and hydration footguns.

To bypass in an emergency (discouraged): `git commit --no-verify` — document why in the PR.

---

## 中文版本

## 1. Standard Check Order

開發中或 local commit 前需要快速回饋時，執行：

```bash
npm run verify:quick
```

`verify:quick` 會依 changed files 選擇 docs、script syntax、TypeScript/client
hygiene、Rust check，或在 schema/storage 風險時升級到 full baseline。

完成交付或 landing 前執行：

```bash
npm run verify:baseline
```

`verify:baseline` 依序執行：`typecheck`、`standards:check`、`docs:check`、static-export hygiene scan、完整 `npm test`、`cargo check`（若可用）、`npm run build`。

**等價手動步驟**（除錯單一步驟時）：

```bash
npm run guard:legacy-surfaces
npm run docs:check
npm run standards:check
npm run verify:static-export
npm run typecheck
npm run test
cargo check --manifest-path src-tauri/Cargo.toml
npm run build
```

小型 local 檢查可跑 `verify:quick`，但 PR/main landing 仍必須在同步 `origin/main`
後跑一次 `verify:baseline`。

## 2. 各檢查涵蓋範圍

| Command | Covers | 說明 |
| --- | --- | --- |
| `npm run guard:legacy-surfaces` | Retired Coding Editor entry、current `/xmux` route、draggable dashboard sheets | `npm run build` 前會自動執行。 |
| `npm run verify:quick` | Changed-file-aware local verification | 開發中與 local commit 前使用；schema/storage changes 會升級 full baseline。 |
| `npm run docs:check` | Filename safety、repo-local docs layout、bilingual heading order | Docs edits 後必跑。 |
| `npm run standards:check` | Company baseline standards | 可能回報 P2 advisory findings。 |
| `npm run typecheck` | Next typegen 與 TypeScript correctness | TS 或 UI edits 後必跑。 |
| `npm run test` | Vitest unit 與 component tests | Storage、UI state、parser、helper changes 後必跑。 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Rust command type checks | Tauri bridge 或 dependency changes 後必跑。 |
| `npm run build` | Static export build | Release 或 major UI changes 前必跑。 |
| `npm run verify:baseline` | **AI 工程師單一關卡** — 上述全部加上 hygiene scan | 宣稱 done、100%、commit、PR 前必跑。 |
| `npm run verify:static-export` | 僅 client-bundle / hydration 反模式 | 含於 `verify:baseline`；UI diff 可單獨快跑。 |

## 3. Documentation-Only Minimum

Docs-only changes：

```bash
npm run verify:quick
```

如果文件中的 code snippets 提到 command names 或 schema fields，也要針對 source files 做 targeted searches，確認名稱仍是最新。

`verify:quick` 在 docs-only changes 會執行 `docs:check`，並明確略過 typecheck、
tests、Rust 與 build。Company Standards full/advisory scans 適合在
standards-sensitive landing 前或 scheduled governance 中執行；除非文件本身改到
standards policy，否則不需要阻塞每個 local docs-only commit。

## 4. Release Readiness

Desktop packaged build 前：

1. 執行 full check order。
2. 執行 `npm run branch:check`；確認 stale local branch 不是舊 UI 復活來源。
3. 執行 `npm run tauri:build`；release secret backend guard 必須通過，若 `PM_DEV_PLAINTEXT_SECRETS=1` 必須失敗。
4. 確認 Browser mode 仍在 port `43187` 啟動。
5. 確認 Tauri mode 可讀本機 `.project-manager.json`。
6. 確認 secrets 只顯示 configured state，不 render raw values。
7. 確認 live agent dispatch 顯示 command、working directory、PID、logs、exit state。
8. 確認 failed 或 blocked commands 不會被顯示為 successful。

## 5. Current Advisory

`standards:check` 目前會回報 hard-coded color values outside docs、build、icon folders 的 P2 advisory。這不是 P0 或 P1 blocking failure，但未來 UI cleanup 應把重複 arbitrary colors 收斂進 shared Tailwind tokens 或 documented design tokens。

## 6. AI 工程師收尾合約

Automated tests **不足以**涵蓋 UI 工作。本節是因部分驗證（例如未跑 `npm run build`、或未實際開啟 app）曾交付壞掉的 static export 與 hydration error。

### 6.1 強制自動化關卡

```bash
npm run verify:baseline
```

以下行為前，所有步驟必須 exit 0：

- 宣稱「verification passed」或「all green」
- 將 Development sheet progress 設為 **100%** 或 status `completed`
- 主動提供 git commit 或 PR（使用者仍須明確要求 commit/PR）

Skill：`.claude/skills/verify-before-complete/SKILL.md`。Cursor rule：`.cursor/rules/verify-before-complete.mdc`。

### 6.2 Static-export hygiene（含於 baseline）

`npm run verify:static-export`（`scripts/check-static-export-hygiene.mjs`）阻擋：

| 模式 | 失敗型態 |
| --- | --- |
| client 可達模組 import Node `fs` | `npm run build` / client bundle 錯誤 |
| `'use client'` 內 `useState(readStored…)` 或 `useState(() => localStorage…)` | React hydration mismatch |
| sidecar / 磁碟 I/O 未拆 `*.server.ts` | 同 fs leak |

**修法：** SSR-safe 常數初始 state → `useEffect` hydrate → hydrated 後才 persist。

### 6.3 手動 browser smoke（UI / routing / client state）

`verify:baseline` 全綠後：

1. `npm run dev`（port **43187**）或 shell/bridge 變更時 `npm run tauri:dev`。
2. 在 **Chrome、Safari 或 Tauri** 開啟變更路由。
3. DevTools Console：happy path 無 React hydration error。
4. 在變更 surface 執行一個主要互動。
5. **零 runtime overlay 錯誤：** Next.js 開發模式左下角 **Issues**（例如「1 Issue」）在變更路由上必須為 **0**。未捕獲例外（含 Tauri `unregisterListener` / `listeners[eventId].handlerId` 非同步訂閱競態）屬 **阻擋合併** 問題，不可留給使用者除錯。

自動化路由檢查：

```bash
npm run verify:dev-issues -- --routes /changed-route[,/another-route]
```

請在 `npm run dev` 以 **43187** port 服務時執行。此命令會讀取 Next.js dev overlay，遇到非零 **Issues** badge、browser console error、或未捕獲 page error 就失敗。Tauri-only shell/bridge 行為仍需手動 Tauri smoke，因為 web route 乾淨時 desktop shell 仍可能觸發 runtime overlay。

**勿**僅以 Cursor embedded browser 當唯一 smoke test — 可能注入 `data-cursor-ref` 造成假 hydration 警告。

Tauri event：`docs/engineering/runtime-bridge.md` §4（`safeUnlisten`、`cancelled`、`subscribeAgentProcessEvents`）。

### 6.4 測試後全新 QA 環境

當自動化檢查完成、下一步要進入人工測試時，使用：

```bash
npm run test:restart-pm
npm run verify:restart-pm
```

這兩個命令會先執行指定測試關卡。只有 exit code 為 0 時，才會呼叫 `/Users/Project-Manager/start_project_manager.sh restart`，其流程會：

- 關閉 macOS Chrome、Edge、Brave、Safari 中 port `43187` 的舊 Project Manager browser tabs
- 停止殘留的 Project Manager Tauri、launcher、Next.js dev-server processes
- 啟動前確認 port `43187` 已釋放
- 在背景啟動 Tauri desktop app
- 等待 `/project-progress-dashboard` healthy 後才回報成功
- 回傳成功前再執行一次延遲 health check
- 開啟新的 browser tab 供人工 QA

操作控制：

- `npm run pm:restart` 會略過測試，只執行相同 cleanup/startup sequence。
- `./start_project_manager.sh start`、`all`、`core`、`auto` 預設也會執行相同 clean-start preflight。
- `PROJECT_MANAGER_SKIP_BROWSER_CLEANUP=1` 可保留既有 browser tabs。
- `PROJECT_MANAGER_REUSE_EXISTING=1` 可刻意沿用已執行中的 local app，不先清理。
- `PROJECT_MANAGER_AFTER_TEST_FINAL_CHECK_SECONDS=30` 可拉長 wrapper final stability window。
- Logs 寫入 `.project-manager/dev-logs/restart-after-tests.log` 與 `.project-manager/dev-logs/project-manager-desktop.log`。

### 6.5 dev-log 誠實紀錄

`dev-log.md` 必須列出本 session **實際執行**的指令，不可只複製本文件 checklist。

## 7. CI 與本機 Git Hooks

### 7.1 GitHub Actions

Workflow：`.github/workflows/verify-baseline.yml`

每個 **pull request** 與 **push 到 `main`** 執行 `npm run verify:baseline`（typecheck、docs、hygiene、完整 tests、`cargo check`、static build）。CI 略過 Company `standards:check`（`VERIFY_SKIP_STANDARDS=1`），因 standards repo 路徑在本機；ship 前請在本機跑 `npm run standards:check`。

### 7.2 Pre-commit hook（選用，建議）

每個 clone 安裝一次：

```bash
npm run githooks:install
```

Hook 位於 `.githooks/pre-commit`；當 staged 檔含 `.ts` / `.tsx` 時執行 **`npm run verify:static-export`**，快速擋 client `fs` leak 與 hydration 反模式。

緊急略過（不建議）：`git commit --no-verify` — 請在 PR 說明原因。

---

---
