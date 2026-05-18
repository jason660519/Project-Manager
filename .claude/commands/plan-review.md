---
description: 對當前計畫進行 gstack 風格的嚴格審查（Pre-Review Audit + Step 0 + Failure modes + Test diagram）。不做任何 code change。
argument-hint: [可選：要審查的計畫摘要、PR 描述，或聚焦的範圍]
---

呼叫 `plan-review` skill，對下方計畫進行完整審查。

## 審查目標

$ARGUMENTS

> 若上方為空，就審查「目前 session 內最近一份待 `ExitPlanMode` 的計畫」或「使用者剛剛口述/貼上的方案」。

## 必須完整跑完（依序）

1. **Pre-Review System Audit**
   - `git status --short`、`git log --oneline -30`、`git diff main --stat`、`git stash list`
   - `grep -rn "TODO\|FIXME\|HACK\|XXX"` 在 `app/ lib/ src-tauri/src/`
   - 讀 `CLAUDE.md`、相關 `docs/architecture/ADR-*.md`、`docs/engineering/README.md`
   - 若計畫動到 schema，讀 `schema/project-manager.schema.json`
   - Retrospective check：同檔案的歷史 commit 有沒有 review-driven refactor / revert，遞迴的問題區是架構味道
   - EXPANSION 模式才做 Taste Calibration
2. **Step 0：Nuclear Scope Challenge**
   - 0A 前提挑戰
   - 0B 既有程式碼槓桿（不重造輪子）
   - 0C Dream State 對齊（CURRENT → PLAN → 12-MONTH IDEAL）
   - 0D 選 mode：EXPANSION / HOLD / REDUCTION，跑該 mode 的子題
3. **Implementation Interrogation**（EXPANSION / HOLD 才做）：把實作期會卡住的決策現在就解掉
4. **Failure Modes 表**（每個非 trivial 步驟）：silent failure、錯誤命名、catch/rescue、tested？、edge cases、observability、security、rollback
5. **Test Diagram**：unit / integration / cargo test / manual 對 happy / nil / 上游失敗 / 重試 / 中斷 / 慢回 / 權限 / schema migration
6. **Opinionated Recommendations**：KEEP / CHANGE / ADD / DEFER / SCRAP（可包含「整份 scrap，改做 X」）

## 紀律（必守）

- **不要**做任何 code change。
- **不要**呼叫 `ExitPlanMode`，直到上面 6 步全跑完且 Outputs Checklist 全勾。
- **不可跳過**：Step 0、System Audit、Error/Rescue Map、Failure Modes。
- 為任何非 trivial 流程畫 **ASCII 圖**（state machine / data flow / pipeline）。
- 為**每個**錯誤命名具體類別，不接受「handle errors gracefully」這種敷衍。
- 任何 silent failure 路徑視為**critical defect**，明確標紅。
- 與**任何 closed ADR** 衝突時，大聲說出來，不要默默接受。
- 你**有授權**講「整份 scrap，改做 X」——這是最有價值的輸出之一。

## 專案特定紅旗（出現就要點名）

- `.unwrap()` / `.expect()` 在使用者面向路徑
- `catch (e) { /* nothing */ }`
- Anthropic key 出現在 Rust `call_anthropic` 之外（違反 ADR-004）
- 元件直接呼叫 `invoke()`，沒走 `lib/bridge/index.ts`（違反 bridge discipline）
- 改 `.project-manager.json` shape 但沒 bump `schemaVersion`（違反 ADR-002）
- 新增 Tauri command 但沒更新 `src-tauri/capabilities/default.json`
- 新增 child process spawn 但沒過 command allowlist
- AI prompt 在 Rust 組（違反 ADR-003，prompt 組裝在 TS）

## 輸出格式

按 skill 內 Outputs Checklist 一節，依序輸出。最後一段用 KEEP / CHANGE / ADD / DEFER / SCRAP 收尾。
