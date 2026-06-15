# F50 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F50-S01 | 升級 App 後開啟 Keys 頁 | v1→v2 遷移吃掉既有評測資料 | Suite C（`keys.store-v2-migration`，7 cases） | F50-M01 遷移 smoke ✓ | Done (P1, 2026-06-10) | Kickoff |
| F50-S02 | 四 tab 之間切換 | 任一表 state 遺失 / 互相污染 | Suite B5（`keys.p0-tab-state-retention`） | 手動四 tab smoke | P0 done (2026-06-10) | Kickoff |
| F50-S03 | 選含無 key 模型的清單按 Run | 跑到一半才爆錯、已成功呼叫的 token 浪費 | Suite D7（`keys.arena-runner` gate）、B8 | F50-M02 ✓ | Done (P2, 2026-06-10) | Kickoff |
| F50-S04 | Run 中 timeout / 取消 | 請求背景照跑照燒 token | Suite D2（abort 實證） | F50-M03 | Done (P2, 2026-06-10) | Kickoff |
| F50-S05 | 同 provider 多模型同時 Run | rate limit 連環失敗且無 retry | Suite D3/D4 + `keys.arena-runner-stress` | mock 壓測（50×10 trials）✓ | Done (P2/P4, 2026-06-10) | Kickoff |
| F50-S06 | 多次取樣（sampleCount>1） | trial 互相覆寫，只剩最後一筆 | Suite D6（`keys.arena-runner`，trial-level 不覆寫） | — | Done (P2, 2026-06-10) | Kickoff |
| F50-S07 | browser mode 開 VLM Arena | 帶圖請求落入 Tauri-only 路徑，失敗不可解 | Suite E3（gate，引擎+UI） | F50-M04 ✓ | Done (P3, 2026-06-10) | Kickoff |
| F50-S08 | VLM 選模型（部分 provider 未驗證） | 選得到沒 key 的模型（gemini 永遠出現 bug） | Suite E1（`keys.p0-vlm-provider-sources`，bug 已修） | — | Done (P3, 2026-06-10) | Kickoff |
| F50-S09 | Arena 跑出達標模型 | 評測結果無下游，需手抄到 Candidates | Suite E4/E5（`keys.promotion-pipeline`） | F50-M05 ✓ | Done (P4, 2026-06-10) | Kickoff |
| F50-S10 | candidate 引用的 key 後來失效 | AI Assistant 拿到不可用模型 | Suite E6（`keys.promotion-pipeline` stale 警示） | 手動 stale smoke | Done (P4, 2026-06-10) | Kickoff |
| F50-S11 | localStorage 損毀 / quota 滿 | 整頁白屏或資料靜默消失 | Suite B1–B4 + C3/C6（store 損毀/quota 降級） | — | Done (P1, 2026-06-10) | Kickoff |
| F50-S12 | 長期使用 history 累積 | quota 邊界行為未定義 | C6（commit quota 降級）+ history window 上限(10) | — | Done (P4, 2026-06-10) | Kickoff |

## Unit Test Backlog

- Phase 0：`__tests__/keys.p0-persistence-safety.test.ts(x)`（B1–B4, B6–B9）、`__tests__/keys.p0-tab-state-retention.test.tsx`（B5）
- Phase 1：`__tests__/keys.store-v2-migration.test.ts`（Suite C）
- Phase 2：`__tests__/keys.arena-runner.test.ts`（Suite D）+ contract conformance
- Phase 3：`__tests__/keys.vlm-model-sources.test.ts`（E1–E3）
- Phase 4：`__tests__/keys.promotion-pipeline.test.ts`（E4–E7）

## E2E Candidate Backlog

- tauri-pilot smoke 擴充：Keys 頁載入 + mock provider 一次 arena run（Phase 2 末）
- browser-mode smoke：VLM gate 訊息（Phase 3 末）

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
