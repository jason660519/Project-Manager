# LLM Arena Reference Flow Breakdown

> Date: 2026-05-29  
> Reference: `/Volumes/KLEVV-4T-1/Real Estate Management Projects/Owner-Property-Management-AI-SPA/apps/superadmin`  
> Page: `http://localhost:3001/superadmin/settings/api_key_and_model_setting#evaluations-global`

## Business Flow

The reference LLM capability evaluation is an adapter-driven global worksheet.

1. Input rows are imported from CLI Adapter and HTTP Adapter tables.
2. Each row carries provider, adapter id, requested model, prompt, optional file name, run status, raw output, rendered output, HTTP metrics, and history metadata.
3. Rows with no prior run are shown as pending. Rows with previous output are included only when `evaluateAdapterRun` returns `pass`, unless the row is currently `running` or `paused`.
4. A single-row run dispatches to the source adapter engine by `adapterChannel` and `adapterItemId`.
5. Bulk run starts all CLI adapters, waits until all settle, then starts all HTTP adapters and waits until all settle.
6. The active run endpoint keeps an in-memory per-user run map keyed by `userId:adapterId`, streams logs, records command preview, and exposes polling by cursor.
7. CLI mode spawns the configured CLI command and retries only through CLI fallback models.
8. HTTP mode calls provider endpoints directly and retries only through HTTP fallback models.
9. On completion, the run is evaluated, persisted to `adapter_evaluation_runs`, mirrored into LLM observability, and surfaced back to the global table through a summary API.
10. The final UI renders raw output, rendered output, evaluation level/message, TTFT, E2E, throughput, HTTP status, total run count, recent history, full server history, and Markdown export.

## Validation Rules

Reference validation is conservative:

- Missing adapter id/provider rejects the run.
- Concurrent run on the same user/adapter returns conflict.
- Strict preflight rejects unsupported Anthropic, Gemini, and OpenAI/Codex models when the validation cache has a closed model list.
- Empty output, explicit fallback failure text, missing API key messages, timeout/abort messages, and HTTP failure text cannot count as valid model output.
- Rendered output must have at least 8 meaningful non-space characters.
- Effective model must be available before final pass.
- Requested/effective model mismatch is a warning, not a silent pass.
- Raw output must contain meaningful non-meta content before final pass.
- Model self-introduction is parsed by known family aliases. Version mismatch fails, except the known MiniMax M2.5 to M2.1 OpenRouter route quirk is downgraded to warning.
- GPT-5 requests that self-report GPT-4 are warnings because provider display language may be stale.

## Metrics And Parameters

Project Manager maps the reference behavior into a local LLM Arena evaluation config:

| Parameter | Reference behavior | Project Manager mapping |
| --- | --- | --- |
| `promptTemplateVersion` | Prompt identity is tracked implicitly by adapter prompt text | `llm-identity-v1` |
| `sampleCount` | History counts repeated rounds; reference rows show 8-14 rounds | Configurable 1-10 trials |
| `timeoutMs` | HTTP: 25s default, 120s for GPT-5/Ollama | Configurable 5s-180s, default 120s |
| `maxTokens` | HTTP attempts use 320 or 2048 depending provider path | Configurable 64-8192, default 2048 |
| `temperature` | Adapter prompt tests are deterministic/low variance | Default 0.2 |
| `historyWindow` | Recent success window is 10 | 10 |
| `maxParallelRuns` | Bulk starts rows concurrently then waits for settlement | 4 configured; UI uses per-row running state |

The score dimensions follow the existing Project Manager evaluation spec and are produced for every run:

| Metric | Weight in `balanced_default` | Meaning |
| --- | ---: | --- |
| `quality_score` | 0.45 | Output quality and reference-rule level |
| `stability_score` | 0.20 | Recent success-rate consistency |
| `latency_score` | 0.15 | Normalized E2E latency versus timeout |
| `cost_score` | 0.15 | Token-efficiency proxy versus max token budget |
| `compliance_score` | 0.05 | Contract/model identity compliance |

Additional profiles:

- `quality_first`: 0.55 quality, 0.20 stability, 0.10 latency, 0.10 cost, 0.05 compliance.
- `cost_latency_first`: 0.30 quality, 0.20 stability, 0.25 latency, 0.20 cost, 0.05 compliance.

## Storage And Output Contract

The reference system stores completed runs in Supabase and exposes summaries through `/api/ai-settings/adapter-evaluation-runs`.

Project Manager is currently local-first in this Keys surface. The adapted LLM Arena stores the latest run results and capped history in browser local storage, then emits a reference-aligned logical row:

- identity: `run_id`, `arena`, `task_id`, `task_bucket`, `model_id`, `provider`, `interface`
- reproducibility: prompt version, prompt/input/output hashes, temperature, max tokens, timeout
- telemetry: latency, prompt/completion/total tokens, HTTP status, retry count
- scoring: five dimension scores plus overall score
- error fields: `error_type`, `error_message`
- review fields: `evaluation_level`, `evaluation_message`, `human_review_required`, `notes`
- output fields: `raw_output`, `rendered_output`

## Implementation Mapping

| Reference file | Project Manager target |
| --- | --- |
| `adapter-evaluation.ts` | `app/ui/views/Keys/LlmArenaEvaluation.ts` |
| `evaluations-global-columns.tsx` | `app/ui/views/Keys/LlmArenaMatrixTable.tsx` |
| `EvaluationsGlobalPanel.tsx` | `app/ui/views/Keys/LlmArenaSheet.tsx` + detail sheet |
| `adapter-runs/route.ts` | `useArenaChat` timeout/error/result normalization |
| `adapter_evaluation_runs` summary/export | local history + Markdown export |

