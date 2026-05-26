---
description: 端到端落地當前分支：verify → commit → push → open PR。最後一步，假設已實作完且通過 pre-landing-review。
argument-hint: [可選：PR 標題或補充說明]
---

呼叫 `ship` skill 把當前分支落地成 PR。

## 補充 / PR 標題

$ARGUMENTS

> 若上方為空，自動從 commit log + diff 推斷 PR 標題與 body。

## 流程

1. **Pre-flight** — branch 不可是 main、要有 diff against `origin/main`、不可 detached HEAD。Diff >200 LOC 且本 session 沒跑 `/plan-review` → 提示先跑
2. **Sync base** — `git merge origin/main --no-edit`；簡單衝突自動解（lock 檔等），真衝突 STOP
3. **Verification gauntlet**：
   - `npm run guard:legacy-surfaces`
   - `npm run branch:check`
   - `npm run typecheck`
   - `cargo check --manifest-path src-tauri/Cargo.toml`
   - `npm test`
   - `cargo test --manifest-path src-tauri/Cargo.toml`
   - `npm run docs:check`
   - `npm run build`（靜態 export smoke test）
   - 任一紅 → STOP，貼失敗 output
4. **PM invariants**（用一次 batched AskUserQuestion 確認）：
   - schemaVersion 動到 → 確認 bump
   - 新 `#[tauri::command]` → 確認 `capabilities/default.json` + `lib/bridge/index.ts` 都加了
   - ADR 衝突（004 key / 003 prompt / `app/api/` 被靜態 build 引用）→ 確認 ADR 修訂 OR 退回變更
   - `app/ui/**` 大幅變動 → DESIGN.md 還對得上嗎
   - navigation / dashboard sheets / workspace 變動 → `guard:legacy-surfaces` 必須通過，避免舊版 Coding Editor、舊 `/cmux` 入口或非拖拽 sheets 回歸
   - bugfix / regression 類 feature → 是否已更新 `debug-retro.md` 與 `test-scenarios.md`，並在 `config.json` 的 `paths.debugRetro` / `paths.testScenarios` 登記
   - 大 diff（>3 檔）且本 session 沒跑 `/pre-landing-review` → 建議先跑
   - Override 要記在 commit footer：`Override: <reason>`
5. **Commit** — Conventional commit（`feat(area):` / `fix(area):` 等，area 例：bridge / ingestion / ui / adapter / schema / rust）；body 寫**為什麼**不是**是什麼**；附 `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`；HEREDOC 傳訊息
6. **Push** — `git push -u origin <branch>`（不 force-push）。遠端領先 → pull → 重跑 Step 3 → 再 push
7. **Open PR** — `gh pr create` with body（Summary / Changes / PM invariants 狀態 / Verification 結果 / Test plan checklist）
8. **SHIP REPORT** — branch / commit / pushed / PR url / verification 全綠/部分跳過原因 / invariants 狀態 / follow-ups

## 紀律

- ❌ 不可 force-push
- ❌ 不可 push 到 main 直接
- ❌ 不可 `git add .` / `git add -A`（明確 add 檔案，避免帶到 `.env` / 大檔）
- ❌ 不可帶 `--no-verify` 跳 hook（hook 紅就修 root cause，必要時叫 `/investigate`）
- ❌ 不可 commit `.env*` / `*.key` / `keychain*` / `credentials*`，遇到要 warn
- ❌ pre-commit hook fail → 修問題 → re-stage → 建**新 commit**（不 amend）
- ✅ verification 紅 → 停下叫 `/investigate`，修完再回來 ship
- ✅ Schema 動到 → bump `schemaVersion`（ADR-002）
- ✅ 高成本 debug / regression → 補 `.project-manager/features/<ID>/debug-retro.md` + `test-scenarios.md`，讓 TDD/E2E 能重用真實使用情境
- ✅ Navigation / dashboard sheet / xmux work → 跑 `npm run guard:legacy-surfaces`；branch hygiene 相關疑慮 → 跑 `npm run branch:check`
- ✅ 新 Tauri command → 同時更新 `capabilities/default.json` + `lib/bridge/index.ts` wrapper
- ✅ skip 任何驗證步驟 → 在輸出明說（例：`Skipped: cargo test (doc-only change)`）
