---
description: 對症狀進行系統性 debug（Iron Law：沒有 root cause 不修）。呼叫 investigate skill。
argument-hint: [症狀、stack trace、要 debug 的功能或檔案]
---

呼叫 `investigate` skill 對下方症狀做系統性根因調查。

## 症狀 / 起點

$ARGUMENTS

> 若上方為空，先用 AskUserQuestion **問一個**最關鍵的釐清問題（不要連問多個），把症狀補齊再開始 Phase 1。

## 流程（一定要走完，不可跳）

1. **Phase 1：Root Cause Investigation** — 收 symptoms、trace 程式路徑（UI → bridge → Rust）、`git log` 看 recent changes、deterministic reproduce、查同檔案 repeat-offender 歷史
2. **Phase 2：Pattern Analysis** — 比對 PM 特有 12 種模式（bridge contract drift / capability missing / static-export miss / schema mismatch / adapter not registered / Anthropic keyring miss / prompt-assembly leak / renderer key exposure / file watch race / TanStack column drift / Next.js cache stale / Tauri event leak）
3. **Phase 3：Hypothesis Testing** — 不寫 fix 前先驗證假設；3-strike rule（連錯 3 個 hypothesis 就 STOP 改問架構）
4. **Phase 4：Implementation** — 修 root cause 不修 symptom；最小 diff；regression test 必須沒 fix 會 fail / 有 fix 會 pass；>5 檔案要 AskUserQuestion blast radius
5. **Phase 5：Verification & Report** — fresh reproduce + DEBUG REPORT 格式（Symptom / Root cause / Fix / Evidence / Regression test / Related / Status: DONE | DONE_WITH_CONCERNS | BLOCKED）

## 鐵律

- ❌ 不可「quick fix for now」——這個 codebase 沒有「for now」
- ❌ 不可在沒驗證 hypothesis 前就寫 fix
- ❌ 不可說「this should fix it」——驗證並證明（跑測試 + reproduce）
- ❌ 任何 `.unwrap()` / `.expect()` / `unimplemented!()` 在 user-facing path 是 **critical defect**
- ❌ 任何 `catch (e) {}` / `catch (_) {}` 無 log 無 UI surface 是 silent failure
- ✅ 3+ failed hypotheses → STOP 問架構
- ✅ Fix 觸發 ADR 衝突（002 / 003 / 004）→ 大聲標記
- ✅ 順手發現的不相干 cleanup → 用 spawn_task 開新任務，不要混進這次 fix
