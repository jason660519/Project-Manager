# F50 - Keys 三工作表重構：store v2 + arenaRunner + promotion 管線

## Summary

針對 Keys 分類下三個工作表（LLM Arena / VLM Arena / Coding Agent Candidates）的系統性重構。
核心病灶：四套互不相容的狀態管理模式、至少 5 個彼此隔離的 localStorage 持久化孤島、
評測 data contract（`LlmArenaResultRow`）只實作一半、Arena 評測結果到 Coding Candidates
之間資料鏈完全斷裂。

重構主軸：

1. **keys store v2** — 單一 versioned envelope（`projectManager:keys:v2`）+ migration runner
   （從 5 個舊 key 遷移）+ 統一事件匯流排 `keysStoreEvents`。
2. **arenaRunner** — 統一執行引擎：AbortController 真取消、`maxParallelRuns` 併發 limiter、
   rate-limit 指數退避 retry、真實 httpStatus、token 標注 measured/estimated、
   直接產出 spec contract（含 run_id / trial_index）。
3. **前置檢核 gate** — 無 key / metadata 過期 / browser-mode VLM 在選擇節點就擋下。
4. **VLM 模型清單雙來源** — curated 種子（進 store 可編輯）+ providerMetadata 動態發現；
   修掉 gemini 未驗證也永遠出現在清單的 bug。
5. **promotion 管線** — Arena 升級判定（master/fallback）→ Coding Candidates suggested 列
   （含 run_id 溯源）+ stale 警示。

## Phases

| Phase | 內容 | 出口條件 |
| --- | --- | --- |
| 0 | P0 安全網測試（對現有行為寫測試，不改實作） | P0 全綠、verify:baseline 綠 |
| 1 | keys store v2 + migration + 事件匯流排收斂 | 三表讀寫走 v2；舊 key 遷移實測通過 |
| 2 | arenaRunner + 前置檢核 gate，LLM Arena 先接 | contract conformance 綠；timeout 取消可驗證 |
| 3 | VLM 接 runner + 模型清單雙來源 + browser-mode gate | P1 的 VLM 測試綠 |
| 4 | promotion 管線 + Candidates suggested/stale + P2 壓測 | 端到端：Arena 達標 → candidate 建議列出現 |

## Current State

- Status: in_progress
- Progress: 5%
- Phase: development
- Category: Frontend/UI
- Created: 2026-06-10

## Scope

- `lib/keys/store/`（新增）、`lib/keys/arenaRunner.ts`（新增）、`lib/keys/promotionRules.ts`（新增）
- `app/ui/views/Keys/*`（接線改造，表格元件 Phase 1–2 不動）
- `__tests__/keys.*`（P0/P1/P2 測試）

## Non-Goals

- 表格元件（TanStack / DataTableShell）視覺與互動改版
- Evaluation 五維評分公式本身的調整（沿用 `LLM_ARENA_EVALUATION_CONFIG`）
- per-project key overrides（F22 遺留，另案）
- `/api/chat`、`/api/keys/validate` route 行為變更（僅補測試）

## Risk Controls

- migration 前自動備份原始 localStorage key（`.bak` 副本），保留 v1 fallback reader 一版
- 壓測一律 mock transport；runner 的 transport 設計為可注入介面
- 既有 3 個 focus regression 測試（llmArenaPromptFocus / vlmArenaPromptFocus /
  codingCandidateNoteFocus）列入每 phase 必跑

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
