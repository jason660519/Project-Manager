---
description: 對當前分支 vs origin/main 的 diff 做 push 前審查（PM 特有紅旗 + Fix-First）。push / open PR 前必跑。
argument-hint: [可選：聚焦範圍、關注點或要特別檢查的檔案]
---

呼叫 `pre-landing-review` skill 對當前分支做 pre-landing 審查。

## 聚焦 / 補充

$ARGUMENTS

> 若上方為空，就審查 `git diff origin/main` 的全部變更。

## 流程

1. **Branch sanity** — 不是 main、要有 diff，抓 touched-files
2. **抓 diff + baseline** — `git diff origin/main` + `npm run typecheck` + `cargo check --manifest-path src-tauri/Cargo.toml`。任一紅 → STOP 報告
3. **Critical pass（必修）**：
   - Bridge & IPC：新 `invoke()` 沒走 `lib/bridge/index.ts` / 新 Tauri command 沒進 `capabilities/default.json` / Rust↔TS 簽名 drift / child-process 注入
   - Anthropic & Secrets：key 跑出 `call_anthropic` 外（ADR-004） / `process.env.*` 在 renderer / prompt 在 Rust 組（ADR-003）
   - Schema & Storage：改 `.project-manager.json` 形狀沒 bump `schemaVersion`（ADR-002） / 沒 atomic rename / `app/api/` 被 component 引用
   - LLM trust：LLM 字串寫檔/路徑/shell 沒驗證 / LLM URL 沒 allowlist / `JSON.parse(llmOutput)` 沒 type guard
   - Enum 完整性：新 variant 沒 grep + read 每個 consumer
   - Concurrency：bridge call 沒 dedupe / file watcher race / `useEffect` 沒 cleanup / Rust `Mutex` cross `.await`
   - Error 表面化：`.unwrap()` / `catch(e){}` / 通用 `String` error / 無 log 無 UI
4. **Informational pass** — Dead code / DESIGN.md 一致性 / `docs:check` / TanStack 模式 / 測試覆蓋 / Bundle 衛生
5. **Fix-First**：mechanical → AUTO-FIX 直接做；judgment → 批一次 ASK（≤3 個分問也行）
6. **重跑 baseline** 確認 AUTO-FIX 沒打破 typecheck / cargo check
7. **輸出**：findings + verification 結果 + ADR collisions + schema/capability needs + **VERDICT: SHIP / FIX-THEN-SHIP / STOP-AND-RETHINK**

## 紀律

- ❌ 不寫新 feature——AUTO-FIX 只做 mechanical 修正
- ❌ 不可漏 Step 3 任一類別（無發現也要明說「no findings in this category」）
- ❌ 不 push、不 merge、不 open PR（那是 `/ship` 的事）
- ❌ 不寫「likely / probably / looks fine」——cite 證據或標 unverified
- ✅ 找到 plan-level 架構味道（大改、ADR 撞牆、scope creep）→ STOP，建議先跑 `/plan-review`
- ✅ 自己的 claim 都要 cite（檔案行號 / 測試名稱 / handler 位置）
