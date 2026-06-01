# Verification Runbook

> Status: Active  
> Last updated: 2026-05-26
> Primary files: `package.json`, `scripts/docs-governance-check.sh`, `src-tauri/Cargo.toml`, `vitest.config.ts`

---

## English Version

## 1. Standard Check Order

Run these before handing off meaningful changes:

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

Use narrower checks for small documentation-only changes, but `docs:check` and `standards:check` should still run.

## 2. What Each Check Covers

| Command | Covers | Notes |
| --- | --- | --- |
| `npm run guard:legacy-surfaces` | Retired Coding Editor entry, current `/xmux` route, draggable dashboard sheets | Also runs automatically before `npm run build`. |
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
npm run docs:check
npm run standards:check
```

If docs include code snippets that refer to command names or schema fields, also run targeted searches against source files to confirm names are current.

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

```bash
npm run verify:baseline
```

All steps must exit 0 before:

- saying "verification passed" or "all green"
- setting Development sheet progress to **100%** or status `completed`
- offering git commit or PR (user must still explicitly request commit/PR)

Skill: `.claude/skills/verify-before-complete/SKILL.md`. Cursor rule: `.cursor/rules/verify-before-complete.mdc`.

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

**Do not** use Cursor embedded browser as the only smoke test — it may inject `data-cursor-ref` and produce false hydration warnings.

### 6.4 dev-log honesty

`dev-log.md` must list commands **actually run** in the session, not a generic checklist copied from this doc.

## 7. CI and Local Git Hooks

### 7.1 GitHub Actions

Workflow: `.github/workflows/verify-baseline.yml`

Runs on every **pull request** and **push to `main`**: `npm run verify:baseline` (typecheck, docs, hygiene, full tests, `cargo check`, static build). Company `standards:check` is skipped in CI (`VERIFY_SKIP_STANDARDS=1`) because the standards repo path is machine-local; run `npm run standards:check` locally before ship.

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

有實質變更時，交付前執行：

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

小型 docs-only changes 可以跑較窄的檢查，但仍應執行 `docs:check` 與 `standards:check`。

## 2. 各檢查涵蓋範圍

| Command | Covers | 說明 |
| --- | --- | --- |
| `npm run guard:legacy-surfaces` | Retired Coding Editor entry、current `/xmux` route、draggable dashboard sheets | `npm run build` 前會自動執行。 |
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
npm run docs:check
npm run standards:check
```

如果文件中的 code snippets 提到 command names 或 schema fields，也要針對 source files 做 targeted searches，確認名稱仍是最新。

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

**勿**僅以 Cursor embedded browser 當唯一 smoke test — 可能注入 `data-cursor-ref` 造成假 hydration 警告。

### 6.4 dev-log 誠實紀錄

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
