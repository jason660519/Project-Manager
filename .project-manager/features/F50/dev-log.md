# F50 Dev Log - Keys 三工作表重構：store v2 + arenaRunner + promotion 管線

## 2026-06-10 - Kickoff

### Context

Keys 三工作表（LLM Arena / VLM Arena / Coding Agent Candidates）重新規劃方案已與 user
對齊核准（對話結論 2026-06-10）。本 feature 落地該方案的 5 個 phase。問題盤點、
目標架構、風險對策全文見 `feature-spec.md` 與 README。

### Planned Work

1. Phase 0：P0 安全網測試（對現有行為寫測試，不改實作）— B1–B9 + 跨 tab 保留。
2. Phase 1：keys store v2 + migration runner + keysStoreEvents 收斂。
3. Phase 2：arenaRunner（abort/併發/retry/contract）+ 前置檢核 gate，LLM Arena 先接。
4. Phase 3：VLM 接 runner + 模型清單雙來源 + browser-mode gate。
5. Phase 4：promotion 管線 + Candidates suggested/stale + P2 壓測收尾。

### Design Decision

- 先測試後重構：Phase 0 把現狀行為（包含已知 bug，如 gemini 清單、resultKey 覆寫）
  用測試釘住，重構時逐項改寫為目標行為，避免裸奔。
- transport 抽成可注入介面，壓測與單元測試一律 mock，不打真 API。
- 表格元件 Phase 1–2 不動，隔離 focus regression 風險。

### Verification Log

- `npm run docs:check` — PASS（kickoff artifacts）
- `node --check scripts/create-feature-checkpoint.mjs` — PASS

## 2026-06-10 - Phase 0: P0 安全網測試

### Work

新增四個測試檔（對現有行為，不改任何實作）：

- `__tests__/keys.p0-persistence-safety.test.tsx` — B1 損毀 JSON 回退預設、
  B2 version≠1 整包拒絕、B4 quota-exceeded 靜默且 in-memory state 照常更新。
- `__tests__/keys.p0-arena-chat-safety.test.tsx` — B3 損毀 results 回退空、
  B6 resultKey=provider-model 覆寫（已知限制，Phase 2 引入 trial_index 後改寫）、
  B7 timeout 產生 errorType=timeout（注意：現狀不會真正 abort，Phase 2 修）、
  B8 missing_key 只影響該模型不影響同批其他模型。
- `__tests__/keys.p0-vlm-provider-sources.test.ts` — B9 釘住 gemini 未驗證仍出現
  的 bug（Phase 3 修正後改寫為 E1）+ 名稱式 capability heuristic。
- `__tests__/keys.p0-tab-state-retention.test.tsx` — B5a 四 sheet 平行掛載
  display-toggle（DOM node identity 不變）、B5b 三表 state 跨四 tab 循環保留
  + envelope 持久化。

### Notes

- 測試中 mock `lib/keys/loadProviderKey` 與 `lib/scanner/runProjectScan`
  （browser path 不得觸 Tauri bridge）；fetch 用 vi.stubGlobal。
- 修過一個測試 helper bug：`className.includes('hidden')` 會誤判
  `overflow-hidden`，改用 `classList.contains('hidden')`。

### Verification Log

- 4 個 P0 測試檔：13/13 PASS
- `npm run verify:baseline`：PASS（2026-06-10，Phase 0 出口達成）

## 2026-06-10 - Phase 1: keys store v2 + migration

### Work

- 新增 `lib/keys/store/index.ts` — v2 envelope（`projectManager:keys:v2`）：
  - slices：`sheets` / `llmArenaResults` / `llmArenaHistory`（新增，v1 從未持久化）/ `vlmImageToImage`
  - 一次性 legacy migration：三座孤島 → `.bak` 備份 → 寫入 slice → 移除原 key
  - 損毀降級：corrupt v2 envelope 備份至 `*.corrupt.bak` 後從殘存 legacy keys 重建；
    corrupt slice 單獨退化（備份+記錄 `meta.recoveries`），不殺整包
  - quota-exceeded：in-memory 仍為權威、`getLastKeysCommitError()` 可觀測
  - `subscribeKeysSlice` per-slice 事件（keysStoreEvents 的第一階段）
- 接線：
  - `KeysContext` → `sheets` slice（sanitizer 不動；slice 內 payload 自帶 version:1）
  - `useArenaChat('llmArenaResults')`（簽名從 storageKey 改 slice name）
  - `VlmImageToImageEvaluation` → `vlmImageToImage` slice（singleton 保留，持久化換底）
  - `LlmArenaSheet` → history 持久化（修復「重整即丟」）+ seen-timestamp 種子
    防止 reload 重複 append history
- 測試：新增 `keys.store-v2-migration.test.ts`（Suite C，7 cases）；
  4 個 P0 測試檔改走 v2 路徑（legacy 種子 = migration 路徑覆蓋）；
  `keys.context-persistence` 更新至 v2 envelope 斷言

### Scope decision（與 feature-spec FR-1 的偏差）

`pm:keys-metadata` 與 `projectManager-llm-provider-order` **不併入** envelope：
兩者由 Settings / Scanner 共用，併入會把 blast radius 擴到 Keys 之外。
providerMetadata 維持「模型可用性唯一真相源」地位，事件統一延後到其訂閱收斂。

### Verification Log

- jsdom spy 教訓：`Storage.prototype` spy 攔不到 jsdom localStorage，
  repo 慣例是 spy `window.localStorage` 實例（dashboardClient.phaseTabs 同模式）
- `npm run typecheck` PASS；全套 vitest 166 檔 / 1112 tests PASS
- Browser smoke（F50-M01，preview @ /keys/llm-arena）：
  - 種三座 v1 孤島 → reload → v2 envelope 建立、`migratedAt` 寫入、
    recoveries=[]、`.bak` 齊、原 key 移除、prompt/codingRows/results 完整保留
  - 四 tab 循環切換 → activeTab 持久化、console 0 error/warn
- `npm run verify:baseline`：PASS（2026-06-10，Phase 1 出口達成）

## 2026-06-10 - Phase 2: arenaRunner + 前置檢核 gate

### Work

- 新增 `app/ui/views/Keys/arenaRunner.ts`（規劃時寫 lib/keys/，實際與 arena 模組同層
  以避免 lib → app/ui 的反向依賴；error 分類與 config 沿用 LlmArenaEvaluation）：
  - `preflightArenaRequests` — 節點 1 硬 gate：missing_key / metadata_stale(>7天) /
    image_unsupported_runtime / unknown_provider，附人話原因
  - `runArenaComparison` — worker-pool 併發（預設 config.maxParallelRuns=4）、
    AbortController 真取消 + abort barrier（transport 不理 signal 也會釋放 slot，
    Tauri bridge 的已知限制有註記）、429 指數退避 retry（≤2，回填真實 retryCount）、
    runId / trialIndex / taskBucket / tokenSource(measured|estimated)
  - transport 可注入：browser=/api/chat fetch(signal)、tauri=callSingleProvider
- `useArenaChat` 改為薄 UI 層：preflight → blocked 即時合成失敗列（0 token）→
  runnable 進 runner，onOutcome 流式更新 results；簽名加 options（測試注入 deps）
- `LlmArenaSheet.runSelectedRows` 改為「整批 × sampleCount 輪」：
  舊版 per-row fan-out 完全繞過 maxParallelRuns；新版 runner 統一管併發，
  輪與輪 sequential 保住 per-model history 的 trial 紀錄
- per-row prompt override 經 `models[].userPromptOverride` 傳入 batch

### Verification Log

- 新增 `keys.arena-runner.test.ts`（Suite D，9 cases：contract conformance /
  abort 實證 / 併發上限 / retry+retryCount / token provenance / trials 不覆寫 /
  preflight 四阻擋）— 9/9 PASS
- P0 arena-chat 測試更新至 Phase 2 語義（B7 真 abort、B8 走 gate）
- `npm run typecheck` PASS；全套 vitest 167 檔 / 1121 tests PASS
- Browser smoke（F50-M02，preview）：metadata ok 但無 key → Add Row → Run →
  列上即時顯示 `No API key saved for openai`、status Failed、評分 fail、
  `/api/chat` 請求數 0、console 0 error/warn
- `npm run verify:baseline`：PASS（2026-06-10，Phase 2 出口達成）

## 2026-06-10 - Phase 3: VLM 模型清單雙來源 + browser gate

### Work

- **比 gemini 特例更深的根因**：`VlmArenaSheet` 原本餵 `listLlmProviders()`（完整
  靜態註冊表），完全沒過驗證 — 改餵 KeysContext 的 `validatedLlmProviders`
- `imageToImageProvidersFrom` 重寫：移除 `provider === 'gemini' ||` 特例；
  雙來源 =（store 可編輯的 curated 種子）+（validated provider 的動態發現），
  僅對輸入清單中的 provider 生效
- curated 種子進 store：新 slice `vlmCuratedModels`（`loadVlmCuratedModels` /
  `saveVlmCuratedModels`，損毀回退內建種子）— 新模型上市不再需要改 code
- browser gate（E3）：`canRunVlmImageToImage()`（Tauri-only）
  - 引擎層：`runVlmImageRow` 在瀏覽器直接 fail row 附訊息、不發請求；
    `resumePersistedVlmImageTasks` 在瀏覽器不 resume（保留 running 列給桌面端）
  - UI 層：VLM sheet 頂部 amber 告示（i18n `keysArena.vlm.browserModeNotice` ×4 locale）

### Verification Log

- B9 測試翻轉為 E1–E3（`keys.p0-vlm-provider-sources`，7 cases）；
  `keys.vlm-image-to-image-evaluation` 補 2 個 E3 gate case（瀏覽器擋 run / 不 resume），
  既有 engine 測試以 `__TAURI_INTERNALS__` stub 模擬桌面
- `npm run typecheck` PASS；全套 vitest 167 檔 / 1128 tests PASS
- Browser smoke（F50-M04，preview @ /keys/vlm-arena）：
  - 只驗證 openai → 模型清單無 gemini、有 gpt-image 系列 ✓
  - 告示顯示「Image evaluation runs in the desktop app only…」✓
  - 種圖後按 Run → row failed 附「桌面 App」訊息、外部 provider 請求 0 ✓
  - console 0 error（Fast Refresh 警告為 dev server 熱更新噪音，乾淨載入無錯）
- `npm run verify:baseline`：PASS（Phase 3 出口達成）

## 2026-06-10 - Phase 4: promotion 管線 + Candidates suggested/stale + 壓測

### Work

- 新增 `lib/keys/promotionRules.ts`（純函式、server-safe）：
  `evaluatePromotion(trials, thresholds)` → master(≥0.95) / fallback(≥0.9) /
  rejected / insufficient_data（<minTrials=5）；門檻對齊 evaluation spec v1，
  以參數注入避免 lib → app/ui 反向依賴
- 新增 `app/ui/views/Keys/useArenaPromotionSuggestions.ts`：訂閱 `llmArenaHistory`
  slice，對「validated 且不在現有列、未被 dismiss」的 provider/model 算 promotion，
  只回 master/fallback；suggestion 為衍生值不落地（只持久化 accept 列與 dismiss 記錄）
- `codingCandidates.ts`：`CodingCandidateRow` 加 `origin` / `sourceRunId` /
  `scoreSnapshot`（全部 optional，pre-F50 列向下相容）；`CodingCandidateState` 加
  `dismissedSuggestions`；`listCodingAgentCandidates` selector 介面不變（新欄位
  conditionally spread，AI Assistant 不受影響）
- `CodingAgentCandidateSheet`：suggestions 面板（accept→provenance 列 / dismiss→
  記錄不復現）+ stale 警示（所有 provider 失效時）；所有 setCodingState 改為
  `...prev` 保留 dismissedSuggestions
- i18n：`keysArena.coding.{suggestionsTitle,suggestionAccept,suggestionDismiss,
  staleWarning}` ×4 locale + types

### Verification Log

- 新增 3 個測試檔：
  - `keys.promotion-rules.test.ts`（6 cases，純 tiering）
  - `keys.promotion-pipeline.test.tsx`（E4–E7 端到端：suggestion→accept→provenance
    列→selector 契約 / dismiss 不復現 / rejected 不建議 / stale 警示）
  - `keys.arena-runner-stress.test.ts`（P2：50×10=500 trials 併發 ≤4、trial 完整性、
    慢任務不餓死佇列；全 mock transport）
- `npm run typecheck` PASS；全套 vitest 170 檔 / 1139 tests PASS
- Browser smoke（F50-M05，preview @ /keys/coding-agent-candidate）：
  - 種 6 筆 pass history → suggestions 面板顯示「openai/gpt-4o — master · success
    100% · score 91」
  - Accept → 產生 `origin:accepted` + `sourceRunId` + `scoreSnapshot:91` 列、
    面板消失、表格顯示 gpt-4o
  - Dismiss → 寫入 dismissedSuggestions、面板消失、reload 後不復現、無新增列
  - console 0 error
- `npm run verify:baseline`：PASS（Phase 4 出口達成）

## 2026-06-10 - F50 完成總結

5 個 phase 全部落地、全程 verify:baseline 綠。核心成果：
1. **store v2** — 三孤島 → 單一 versioned envelope + migration + 損毀/quota 降級
2. **arenaRunner** — 真 abort / 併發上限 / retry+retryCount / 真 httpStatus /
   token provenance / trial-level contract
3. **前置檢核 gate** — missing_key / metadata_stale / image-in-browser 在選擇節點擋下
4. **VLM 雙來源** — validated-only + store 可編輯 curated + browser gate（修 gemini bug）
5. **promotion 管線** — Arena 達標 → Candidates suggested（含溯源）→ accept/dismiss/stale

遺留（非本 feature scope，已在 feature-spec Non-Goals / Open Decisions 記錄）：
- curated VLM 清單的編輯 UI（目前資料面可改、無專屬 UI）
- VLM promotion 門檻公式（目前僅 LLM 走 promotion）
- per-project key overrides（F22 遺留）
- `pm:keys-metadata` / provider-order 尚未併入 envelope（與 Settings/Scanner 共用）

## 2026-06-15 - Hotfix: API key validation regression（browser dev）

### 根因

1. **Browser dev 驗證路徑 TLS 失敗（主要）**  
   `app/api/keys/validate/route.ts` 使用 Node 全域 `fetch`（Undici）。在本機
   Node 26 + macOS 組合下，對外 HTTPS 會以 `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`
   失敗，API 只回 `{ ok:false, errorReason:"fetch failed" }`，導致**所有**
   provider 在 `npm run dev` / 非 Tauri 環境看起來全部驗證失敗。  
   對照：`curl` 與 Tauri Rust `reqwest` 路徑正常；`https.request` + `tls.rootCertificates`
   亦正常。

2. **Bundled key store 空物件阻斷 legacy 遷移（次要）**  
   `providerKeyStore` 若 localStorage 已有 `'{}'` bundle，會把空物件當成「已載入」
   而跳過 per-provider legacy key 遷移，Re-validate 可能讀不到舊 key。

### 修復

- 新增 `lib/server/outboundHttp.server.ts`：dev API route 專用 outbound HTTP（明確
  使用 `tls.rootCertificates`），validate route 全面改用此 helper。
- `providerKeyStore`：`hasStoredKeys()` 判斷；空 bundle 時仍嘗試 legacy 遷移；
  `getProviderKey` 回傳 trim 後字串；`revalidateStoredKey` 對空白 key 視為未配置。
- 測試：`keys.validateRoute`（含 401 非 fetch failed）、`keys.providerKeyStore`、
  `keys.validation` 空白 key case。

### Verification Log

- `npm test -- __tests__/keys.validateRoute.test.ts __tests__/keys.validation.test.ts __tests__/keys.providerKeyStore.test.ts` — 12/12 PASS
- Live probe `POST /api/keys/validate`（invalid keys）— 回傳 `Anthropic 401` / `GitHub 401`，不再 `fetch failed`
- `npm run verify:baseline` — PASS
