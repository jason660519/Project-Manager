# F50 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F50 exists with phase `development` |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, dev log 皆存在 |
| A3 | Dashboard notes | `feature.notes` 為短文字，非 artifact path |

## Suite B: P0 安全網（Phase 0 — 對現有行為，不改實作）

| Case | 行為 | Expected |
| --- | --- | --- |
| B1 | KeysContext 載入損毀 JSON（`projectManager:keys-state:v1`） | 回退預設 state，不 throw |
| B2 | KeysContext 載入 `version !== 1` | 回退預設 state |
| B3 | useArenaChat 載入損毀 `pm.arena.llm.results` | 回退空 results，不 throw |
| B4 | localStorage.setItem 丟 QuotaExceededError | 寫入靜默失敗，UI state 仍更新（現狀行為，釘住） |
| B5 | 四 tab 切換（api_key_validation ↔ llm ↔ vlm ↔ coding） | 各表 state 保留（display-toggle 掛載） |
| B6 | useArenaChat resultKey 覆寫 | 同 provider-model 第二次 run 覆寫第一次（現狀行為，釘住） |
| B7 | withTimeout 超時 | result 為 timeout error；errorType=timeout |
| B8 | 無 key 的 provider 執行 | errorType=missing_key 類錯誤，其他模型不受影響 |
| B9 | VLM `imageToImageProvidersFrom` | 釘住現狀：gemini curated models 即使不在 active providers 也出現（bug 將於 Phase 3 修正並更新此測試） |

## Suite C: store v2（Phase 1）

| Case | Input | Expected |
| --- | --- | --- |
| C1 | 5 個舊 key 齊全 | 合併遷移至 v2，內容等價，原始值備份至 `<key>.bak` |
| C2 | 部分舊 key 缺失 | 缺者用預設值，遷移不失敗 |
| C3 | 舊 key 含損毀 JSON | 該切片重建空 state，meta 記 recovery，其餘切片正常遷移 |
| C4 | v2 已存在 | 不重複遷移、不覆寫 |
| C5 | commit(patch) | 單點寫入；訂閱者收到一次 keysStoreEvents |
| C6 | quota exceeded on commit | 降級策略觸發，state 不損毀，錯誤可觀測 |

## Suite D: arenaRunner（Phase 2）

| Case | Input | Expected |
| --- | --- | --- |
| D1 | 任一輸出 row | 100% 滿足 `LlmArenaResultRow` schema（run_id/trial_index/真實 httpStatus） |
| D2 | timeoutMs 觸發 | AbortController.abort() 被呼叫（mock transport 驗證 signal） |
| D3 | 10 個 request、maxParallelRuns=4 | 同時 in-flight ≤ 4 |
| D4 | transport 回 429 | 指數退避 retry ≤ 2，retry_count 回填正確 |
| D5 | token 來源 | API 回傳→`measured`；估算→`estimated` 標注 |
| D6 | sampleCount=3 | 產生 trial_index 0..2 三筆，不互相覆寫 |
| D7 | 前置檢核 gate | 無 key/metadata 過期/capability 不符 → 進阻擋清單附原因，不發請求 |

## Suite E: VLM 雙來源 + promotion（Phase 3–4）

| Case | Input | Expected |
| --- | --- | --- |
| E1 | provider 無 validated key | 不出現在 VLM 模型清單（gemini bug 修正後釘住） |
| E2 | curated + dynamic 重疊 | 去重合併，curated label 優先 |
| E3 | browser mode + VLM Run | Run disabled + 明確訊息，不發請求 |
| E4 | history 達 passSuccessRate | promotion=master；產生 suggested candidate（sourceRunId+分數快照） |
| E5 | dismiss suggested | 同 provider-model 不重複建議 |
| E6 | candidate 的 provider key 失效 | 行上 stale 警示 |
| E7 | `listCodingAgentCandidates()` | 介面不變；accept 後含該列 |

## Suite F: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| F1 | focus regression | llmArenaPromptFocus / vlmArenaPromptFocus / codingCandidateNoteFocus 每 phase 全綠 |
| F2 | 表格 prefs localStorage key | 不因重構改變（tablePrefs.v1/v2 keys 不動） |
| F3 | AI Assistant coding picker | `listCodingAgentCandidates()` 既有測試（aiSdks.candidates）綠 |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F50-M01 | 遷移 smoke | 帶舊資料啟動桌面 App，開 Keys 四 tab | 舊評測結果/candidates 可見，console 無錯 |
| F50-M02 | LLM Arena run smoke | 選 2 模型（一個無 key）按 Run | 無 key 者在 gate 被擋並顯示原因；另一個正常完成 |
| F50-M03 | 取消 smoke | Run 中按取消/timeout | 請求中止，UI 回 idle，無殭屍更新 |
| F50-M04 | browser mode | `npm run dev` 開 Keys → VLM | Run gate 顯示「需在桌面 App 執行」 |
| F50-M05 | promotion 端到端 | mock 達標模型完成評測 | Candidates 出現 suggested 列，accept 後進清單 |

## Required Verification

- 每 phase：focused tests + `npm run typecheck`
- artifacts 變更：`npm run docs:check`
- phase 出口：`npm run verify:baseline` + 對應 Manual Verification 項目
