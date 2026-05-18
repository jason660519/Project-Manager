---
description: 把當前 session 工作狀態存成 .context/sessions/ 下的 markdown checkpoint，供 /context-restore 接續。不改 source code。
argument-hint: [可選：checkpoint 標題；不給就從對話脈絡自動推斷]
---

呼叫 `context-save` skill 存 checkpoint。

## Checkpoint 標題

$ARGUMENTS

> 若上方為空，從這次 session 對話內容推斷 3–6 字的 slug（例如 `bridge-error-surfacing`、`ingestion-md-parser`、`projects-view-empty-state`）。

## 流程

1. **收集 git state** — branch / status --short / diff stat（unstaged + staged）/ log -10 / log origin/main..HEAD
2. **合成摘要**（用對話歷史 + git state）：
   - Goal（1–2 句）
   - Decisions made（含**為什麼**）
   - Remaining work（含具體檔案路徑）
   - Gotchas / 開放問題（試過不通的、卡住的、等外部資訊的）
   - Verification baseline（typecheck / cargo check / jest / cargo test 的最後狀態；本 session 沒跑就標 UNKNOWN）
3. **算檔名（必須在 bash 裡 sanitize，不可在 LLM 層拼字串）**：
   - `mkdir -p .context/sessions`
   - 標題 sanitize：lowercase → 空白轉 `-` → 只留 `a-z 0-9 . -` → 截 60 字
   - 空標題 fallback `untitled`
   - 同秒同 slug collision → 加 4 字 random suffix
4. **寫 checkpoint** 到 `.context/sessions/<timestamp>-<slug>.md`，含 frontmatter（title / branch / saved_at / files_touched_unstaged / files_touched_staged / last_commit / schemaVersion: 1）
5. **輸出 CHECKPOINT SAVED**：file / title / branch / resume 指令（`/context-restore` 或 `/context-restore <slug-fragment>`）

## 紀律

- ❌ 不改 source code——只寫 **一個** checkpoint 檔
- ❌ 標題 sanitize **必須在 bash 裡做**（防 shell injection），不可在 LLM 層拼路徑
- ❌ 不覆寫既有 checkpoint（append-only，同秒同名加 random suffix）
- ❌ 不擅自改 `.gitignore`（第一次建 `.context/sessions/` 時提醒使用者決定要不要 ignore）
- ✅ session 早期 context 很薄也照存——`Goal: TBD` 是合法，下次 restore 會補

## 跟 /handoff 的差別

| | 用途 | 輸出 | 場景 |
|---|---|---|---|
| `/handoff` | 給**全新 AI session** 用的自包含 prompt | 一份 markdown 給人複製貼上 | 跨 AI 接手、隔天/隔週重啟 |
| `/context-save`（本 command） | 同專案內**快速 snapshot** + 後續 `/context-restore` 載回 | `.context/sessions/<ts>-<slug>.md` 檔 | 中途暫停、午餐前、切 branch 前、做風險實驗前 |
