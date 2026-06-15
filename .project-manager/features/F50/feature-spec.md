# F50: Keys 三工作表重構：store v2 + arenaRunner + promotion 管線

## Purpose

把 Keys 分類（LLM Arena / VLM Arena / Coding Agent Candidates）從「三套狀態模式 +
五個持久化孤島 + 斷裂的評測→策展鏈路」收斂成單一資料層、單一執行引擎、可追溯的
promotion 管線。受益者是唯一使用者（評測流程有下游、失敗在選擇節點就被擋下）與
未來維護者（一套心智模型、schema 有遷移路徑）。

## Background（現況證據）

- 持久化孤島：`projectManager:keys-state:v1`（KeysContext，version:1）、
  `pm.arena.llm.results`（useArenaChat，**無 version 欄位**）、
  `projectManager:keys-vlm-image-to-image:v1`（VLM singleton）、
  `pm:keys-metadata`、`projectManager-llm-provider-order`（各自無版本）。
- 狀態模式分歧：LLM 用 hook 私有 state（`useArenaChat.ts`）、VLM 用 module-level
  singleton + listener（`VlmImageToImageEvaluation.ts:97-99`）、Coding 用 KeysContext。
- 執行引擎缺陷（`useArenaChat.ts`）：
  - `withTimeout` 只是 Promise.race，無 AbortController（timeout 後請求照跑照燒 token）
  - config 有 `maxParallelRuns: 4` 但全部 models 一次 `Promise.allSettled` 開出
  - Tauri 路徑 `httpStatus` 硬寫 200；`retryCount` 永遠 0（無 retry 機制）
  - browser 路徑 token 用 `length/4` 估算且不標注
  - browser mode 帶圖請求落入 Tauri-only 的 `callSingleProvider`（line 170 分流條件）
- VLM 模型清單：`VLM_IMAGE_TO_IMAGE_CAPABLE_MODELS` 硬編碼；
  `imageToImageProvidersFrom`（line 126）讓 gemini 未驗證 key 也永遠出現。
- Contract 斷層：`LlmArenaResultRow`（run_id / trial_index / task_bucket / input_hash）
  定義完整，但 `ArenaResult` 無 run_id / trial_index，resultKey = `provider-model`
  造成多次取樣互相覆寫。
- 鏈路斷裂：spec 的 master/fallback 門檻只存在於
  `LLM_ARENA_EVALUATION_CONFIG.thresholds`，無任何邏輯推進到 Coding Candidates。

## User Stories

| ID | Story |
| --- | --- |
| US-01 | 作為使用者，我在 Arena 選模型時就能看到「不可執行與原因」（無 key / metadata 過期 / 運行時不支援），不會跑到一半才爆錯。 |
| US-02 | 作為使用者，Arena 跑出達標模型後，Coding Candidates 自動出現帶分數快照與 run_id 溯源的建議列，我只需 accept/dismiss。 |
| US-03 | 作為使用者，timeout 或取消後請求真的被中止，不再背景燒 token。 |
| US-04 | 作為使用者，升級 App 後既有的評測結果與 candidate 清單完整保留（v1→v2 自動遷移）。 |
| US-05 | 作為維護者，三個工作表共用一套 store/事件模型，新增欄位走 versioned migration。 |

## Functional Requirements

- FR-1 keys store v2：單一 envelope `projectManager:keys:v2 = { version: 2, llmArena, vlmArena, codingCandidates, meta }`；啟動時偵測 5 個舊 key → 合併遷移 → 備份原始值 → 寫入 v2。
- FR-2 損毀降級：corrupt JSON 備份至 `<key>.bak` 後重建空 state，不靜默吞掉（meta 記錄 recovery 事件）。
- FR-3 arenaRunner：輸入 `RunRequest[]`（含 run_id / trial_index / task_bucket），輸出 `LlmArenaResultRow[]`；AbortController 真取消；併發 ≤ maxParallelRuns；rate-limit 退避 retry ≤ 2 並回填 retry_count；token 標注 `measured | estimated`。
- FR-4 前置檢核 gate：執行前產出「可執行清單 + 阻擋原因」；阻擋條件 = 無 key、metadata 過期（>7 天）、運行時 capability 不符（browser-mode 影像）。
- FR-5 VLM 模型清單雙來源：curated 種子進 store（可編輯）+ providerMetadata 動態發現；無 validated key 的 provider 不出現（修 gemini bug）。
- FR-6 promotion 管線：history window 統計達 `passSuccessRate` → `master`，達 `fallbackSuccessRate` → `fallback`；產生 Coding Candidates `suggested` 列（sourceRunId + 分數快照）；dismiss 後不重複建議；provider key 失效 → stale 警示。
- FR-7 `listCodingAgentCandidates()` 對 AI Assistant 的介面不變（新增可選 provenance 欄位）。

## Technical Requirements

- 新模組：`lib/keys/store/`（envelope、migrations、events）、`lib/keys/arenaRunner.ts`、`lib/keys/promotionRules.ts`。
- transport 可注入（測試 mock；browser=/api/chat、tauri=callSingleProvider）。
- 表格元件（LlmArenaMatrixTable / VlmArenaMatrixTable / CodingAgentCandidateTable）Phase 1–2 不動。
- 事件收斂：`METADATA_CHANGED_EVENT` / `PROVIDER_ORDER_CHANGED_EVENT` / VLM listener → `keysStoreEvents`（discriminated union payload），KeysContext 只訂一次。
- 不在 artifacts 或 store 中存任何 API key 明文。

## Acceptance Criteria

1. Phase 0：P0 安全網測試全綠（migration 前置行為、現有持久化、跨 tab 狀態保留、focus regression）。
2. Phase 1：三表讀寫走 v2 store；5 個舊 key 的遷移在四種情境（完整/部分/損毀/quota）測試通過；遷移後舊資料可見。
3. Phase 2：arenaRunner contract conformance 測試綠；timeout 觸發時 AbortController 被呼叫可驗證；併發數可驗證 ≤ 4；LLM Arena 全流程走 runner。
4. Phase 3：VLM 走 runner；browser mode 下 VLM Run 被 gate 且訊息明確；未驗證 provider 不出現在模型清單。
5. Phase 4：端到端 — mock 模型達標 → Candidates 出現 suggested 列 → accept 後 `listCodingAgentCandidates()` 含該列。
6. 全程：`npm run verify:baseline` 綠；3 個 focus regression 測試綠；UI 手動 smoke（桌面 + browser）通過。

## Open Decisions

- promotion 對 VLM 的門檻公式（e2eMs + 人工 score 分布）細節在 Phase 4 開工前定案。
- curated VLM 清單的編輯 UI 放在 VLM sheet 內或 Settings，Phase 3 定案（先做 store 資料面）。
