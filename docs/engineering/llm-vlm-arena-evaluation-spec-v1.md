# LLM/VLM Arena Evaluation Spec v1

> Status: Draft
> Last updated: 2026-05-22
> Owner: Project Manager AI Engineering
> Scope: LLM Arena, VLM Arena, master/fallback routing decisions

---

## English Version

## 1. Objective

Define a reproducible, implementation-ready evaluation standard for LLM/VLM model selection across three execution interfaces:

1. Raw API (`raw_api`)
2. Programmatic Wrapper (`wrapper`) for SDK and scriptable CLI pipelines
3. Interactive App (`interactive_app`) for copy-paste manual usage in coding/chat apps

The goal is to support stable `master + fallback` choices with measurable quality, stability, latency, and cost trade-offs.

## 2. Non-Goals

- This spec does not define vendor-specific prompts.
- This spec does not replace product-level acceptance tests.
- This spec does not require identical prompts across all interfaces when a platform has hard constraints; all deviations must be recorded.

## 3. Evaluation Dimensions

Every run must emit these dimensions:

- `quality_score`: task result quality (0-100)
- `stability_score`: variance-aware consistency score (0-100)
- `latency_score`: normalized latency score from p50/p95 (0-100)
- `cost_score`: normalized token or currency efficiency score (0-100)
- `compliance_score`: format and policy compliance (0-100)

Overall score:

```text
overall_score =
  0.45 * quality_score +
  0.20 * stability_score +
  0.15 * latency_score +
  0.15 * cost_score +
  0.05 * compliance_score
```

Default weights can be tuned by scenario profile (see Section 8).

## 4. Interface Buckets

### 4.1 `raw_api`

Direct HTTP calls to provider endpoint with full request control.

- Pros: maximum control, baseline capability measurement
- Risks: highest implementation burden, parser/retry mistakes can bias results

### 4.2 `wrapper`

SDK-based integration or CLI automation wrapped into reproducible scripts.

- Pros: production-relevant behavior with manageable complexity
- Risks: abstraction may hide provider-level details

### 4.3 `interactive_app`

Manual copy-paste into coding/chat app UI.

- Pros: closest to real human usage
- Risks: lowest reproducibility, hidden app-side prompt shaping, difficult telemetry

## 5. Task Taxonomy

Use separate pools for LLM and VLM and track by `task_bucket`.

- `llm_reasoning`: chain reasoning, constrained logic
- `llm_format`: JSON/schema-constrained output
- `llm_tool_use`: tool/function calling or structured action planning
- `llm_code`: generation, repair, refactor, test authoring
- `llm_long_context`: retrieval and multi-chunk synthesis
- `vlm_ocr`: text extraction from images
- `vlm_chart`: chart/table interpretation
- `vlm_ui`: UI screenshot reasoning or bug spotting
- `vlm_multi_image`: compare and summarize across multiple images

Each bucket must include:

- at least one machine-gradable task
- at least one human-review task

## 6. Canonical Run Protocol

For each `(model, interface, task_id)` combination:

1. Run `N` repeated trials (default `N=7`; recommended `N=10` for promotion decisions).
2. Keep all trial outputs; do not replace failed runs silently.
3. Record prompt/template/input hashes for reproducibility.
4. Record retries and timeout behavior explicitly.
5. Score per trial, then aggregate.

Required aggregate statistics:

- `mean`
- `stddev`
- `worst`
- `p50`
- `p95`
- `success_rate`

## 7. Data Contract (v1)

Use the following logical schema for result rows:

```json
{
  "run_id": "string",
  "arena": "llm|vlm",
  "task_id": "string",
  "task_bucket": "string",
  "model_id": "string",
  "provider": "string",
  "interface": "raw_api|wrapper|interactive_app",
  "trial_index": 1,
  "timestamp_utc": "2026-05-22T00:00:00Z",
  "prompt_template_version": "string",
  "system_prompt_hash": "string|null",
  "input_hash": "string",
  "output_hash": "string|null",
  "temperature": 0.2,
  "max_tokens": 2048,
  "retry_count": 0,
  "timeout_ms": 60000,
  "latency_ms": 1200,
  "prompt_tokens": 1234,
  "completion_tokens": 456,
  "total_tokens": 1690,
  "cost_usd": 0.0231,
  "quality_score": 84.0,
  "compliance_score": 100.0,
  "error_type": "none|timeout|rate_limit|schema_violation|tool_error|other",
  "error_message": "string|null",
  "human_review_required": false,
  "notes": "string|null"
}
```

Additional interface metadata:

- `raw_api`: include HTTP status, endpoint, stream mode
- `wrapper`: include SDK version or CLI version, wrapper commit hash
- `interactive_app`: include app name/version, manual operator id, interaction mode

## 8. Scenario Profiles

Define profile-specific weights and SLO guards.

### 8.1 `quality_first`

- Weights: quality 0.55, stability 0.20, latency 0.10, cost 0.10, compliance 0.05
- Use for high-risk reasoning/coding tasks

### 8.2 `balanced_default`

- Weights: quality 0.45, stability 0.20, latency 0.15, cost 0.15, compliance 0.05
- Use for general assistant workloads

### 8.3 `cost_latency_first`

- Weights: quality 0.30, stability 0.20, latency 0.25, cost 0.20, compliance 0.05
- Use for high-volume workflows

## 9. Master/Fallback Selection Rules (v1)

### 9.1 Candidate selection

For each `task_bucket`, rank candidates by profile-specific `overall_score`.

### 9.2 Promotion gate for master

A candidate can be master only if:

- `success_rate >= 0.95`
- `compliance_score_mean >= 98`
- `quality_score_mean` is top 1 or within 2 points of top 1
- `latency_p95` and `cost_mean` both meet profile budget

### 9.3 Fallback gate

A candidate can be fallback only if:

- `success_rate >= 0.90`
- `compliance_score_mean >= 95`
- lower or equal cost than master, or materially better p95 latency

### 9.4 Runtime fallback triggers

Trigger fallback when any condition is true:

- response timeout
- schema/format validation failed
- tool call failed irrecoverably
- estimated run cost exceeds bucket budget
- runtime policy/safety checker rejected output

## 10. Fairness and Reproducibility Controls

- Fix test dataset versions by hash.
- Version prompts and scoring scripts.
- Store pre/post-processing strategy explicitly.
- For VLM, store image preprocessing settings.
- Separate provider outage events from model quality failures.

## 11. Suggested Folder and Artifact Layout

This spec recommends (but does not require) the following layout:

```text
eval/
  datasets/
    llm/
    vlm/
  prompts/
  scoring/
  runs/
  reports/
```

If integrated into Project Manager feature artifacts, mirror this under `.project-manager/features/<ID>/`.

## 12. Minimum Acceptance Criteria For v1 Rollout

Before using this spec for production routing:

1. At least 3 models evaluated per arena.
2. At least 5 task buckets covered per arena.
3. At least 7 repeated trials per `(model, interface, task_id)`.
4. Manual QA completed for all human-review tasks.
5. A documented master and fallback for every active bucket.

## 13. Verification Checklist

For docs-only adoption:

```bash
npm run docs:check
npm run standards:check
```

For implementation rollout:

```bash
npm run typecheck
npm run test
npm run build
```

## 14. Next v2 Extensions

- Confidence-calibrated routing score
- Judge-model and pairwise arena ranking integration
- Drift detection alerts for master regression
- A/B runtime traffic split with automatic rollback

---

## 中文版本

## 1. 目標

本規格定義一套可重現、可直接實作的 LLM/VLM 評測標準，針對三種執行介面進行比較：

1. Raw API（`raw_api`）
2. Programmatic Wrapper（`wrapper`，涵蓋 SDK 與可腳本化 CLI）
3. Interactive App（`interactive_app`，人工 copy-paste 到對話 UI）

目的是支援穩定的 `master + fallback` 模型決策，並能量化品質、穩定性、延遲與成本的取捨。

## 2. 非目標

- 不定義供應商專屬 prompt 細節。
- 不取代產品端的 acceptance test。
- 若平台限制導致 prompt 無法完全一致，允許差異，但必須紀錄。

## 3. 評測維度

每次 run 都必須輸出以下維度：

- `quality_score`：任務品質（0-100）
- `stability_score`：穩定性（方差導向，0-100）
- `latency_score`：延遲分數（依 p50/p95 正規化，0-100）
- `cost_score`：成本效率分數（0-100）
- `compliance_score`：格式與政策遵循度（0-100）

總分預設公式：

```text
overall_score =
  0.45 * quality_score +
  0.20 * stability_score +
  0.15 * latency_score +
  0.15 * cost_score +
  0.05 * compliance_score
```

可依情境 profile 調整權重（見第 8 節）。

## 4. 介面分層

### 4.1 `raw_api`

直接打 HTTP API，完整控制 request/transport。

- 優點：控制力最高、可作能力基準
- 風險：實作負擔高，重試或解析錯誤會污染結果

### 4.2 `wrapper`

用 SDK 或 CLI 腳本封裝後執行。

- 優點：接近真實工程整合，複雜度可控
- 風險：封裝層可能掩蓋底層差異

### 4.3 `interactive_app`

人工貼到 coding/chat app 對話框執行。

- 優點：最接近真實使用者體驗
- 風險：重現性最低，且常有隱含系統提示或前處理

## 5. 任務分類

LLM 與 VLM 分開建 task pool，並記錄 `task_bucket`：

- `llm_reasoning`
- `llm_format`
- `llm_tool_use`
- `llm_code`
- `llm_long_context`
- `vlm_ocr`
- `vlm_chart`
- `vlm_ui`
- `vlm_multi_image`

每個 bucket 至少包含：

- 1 題可機器判分
- 1 題需人工複核

## 6. 標準執行流程

對每個 `(model, interface, task_id)`：

1. 重複執行 `N` 次（預設 `N=7`；升版決策建議 `N=10`）
2. 保留所有 trial（不得靜默覆蓋失敗）
3. 記錄 prompt/template/input hash
4. 明確記錄 retry 與 timeout 行為
5. 先做 trial 級評分，再做聚合

必備聚合統計：

- `mean`
- `stddev`
- `worst`
- `p50`
- `p95`
- `success_rate`

## 7. 資料契約（v1）

結果列應符合以下邏輯 schema（欄位定義見英文版 JSON）：

- 基本識別：`run_id`, `arena`, `task_id`, `task_bucket`, `model_id`, `provider`, `interface`
- 可重現欄位：`prompt_template_version`, `system_prompt_hash`, `input_hash`, `output_hash`
- 執行參數：`temperature`, `max_tokens`, `retry_count`, `timeout_ms`
- 成本延遲：`latency_ms`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd`
- 評分與錯誤：`quality_score`, `compliance_score`, `error_type`, `error_message`

介面附加 metadata：

- `raw_api`：HTTP status、endpoint、stream mode
- `wrapper`：SDK/CLI 版本、wrapper commit hash
- `interactive_app`：app 名稱/版本、操作者 ID、互動模式

## 8. 情境權重 Profile

### 8.1 `quality_first`

- 權重：quality 0.55, stability 0.20, latency 0.10, cost 0.10, compliance 0.05
- 適用：高風險推理、程式任務

### 8.2 `balanced_default`

- 權重：quality 0.45, stability 0.20, latency 0.15, cost 0.15, compliance 0.05
- 適用：一般助理任務

### 8.3 `cost_latency_first`

- 權重：quality 0.30, stability 0.20, latency 0.25, cost 0.20, compliance 0.05
- 適用：高流量、成本敏感任務

## 9. Master/Fallback 選擇規則（v1）

### 9.1 候選排序

每個 `task_bucket` 依 profile 的 `overall_score` 排序。

### 9.2 Master 升級門檻

需同時滿足：

- `success_rate >= 0.95`
- `compliance_score_mean >= 98`
- `quality_score_mean` 為第一名，或距第一名不超過 2 分
- `latency_p95` 與 `cost_mean` 符合該 profile budget

### 9.3 Fallback 門檻

需同時滿足：

- `success_rate >= 0.90`
- `compliance_score_mean >= 95`
- 成本不高於 master，或 p95 延遲顯著更低

### 9.4 線上 fallback 觸發條件

任一條件成立即觸發：

- timeout
- schema/format 驗證失敗
- tool call 不可恢復失敗
- 預估成本超過 bucket 預算
- runtime safety/policy 驗證失敗

## 10. 公平性與可重現控制

- 以 hash 固定 dataset 版本
- prompt 與 scoring script 版本化
- 顯式記錄 pre/post-processing 策略
- VLM 額外記錄 image preprocessing 設定
- 供應商 outage 需與模型品質失敗分開統計

## 11. 建議目錄與產物

建議（非強制）：

```text
eval/
  datasets/
    llm/
    vlm/
  prompts/
  scoring/
  runs/
  reports/
```

若要納入 Project Manager feature artifacts，可映射到 `.project-manager/features/<ID>/` 下。

## 12. v1 上線最低驗收條件

1. 每個 arena 至少評估 3 個模型
2. 每個 arena 至少覆蓋 5 個 task bucket
3. 每個 `(model, interface, task_id)` 至少 7 次 trial
4. 所有人審題目均完成人工 QA
5. 每個活躍 bucket 皆有 master 與 fallback 記錄

## 13. 驗證清單

文件導入：

```bash
npm run docs:check
npm run standards:check
```

實作上線：

```bash
npm run typecheck
npm run test
npm run build
```

## 14. v2 可擴充方向

- 以信心校準分數做 routing
- 加入 judge-model 與 pairwise arena 排名
- master 漂移監控與警報
- 線上 A/B 分流與自動回滾
