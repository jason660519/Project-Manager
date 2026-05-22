# LLM/VLM Arena Eval Workspace

This folder hosts the operational artifacts for the v1 arena evaluation flow.

## Structure

```text
eval/
  config/
    routing-policy.v1.json
    scenario-profiles.v1.json
  schemas/
    eval-run-row.schema.json
  datasets/
    llm-sample-tasks.v1.json
    vlm-sample-tasks.v1.json
  scoring/
    aggregate-runs.mjs
    auto-score-rows.mjs
    judge-human-rows.mjs
    report-to-markdown.mjs
  runners/
    run-benchmark-all.mjs
    run-wrapper-batch.mjs
    run-wrapper-batch-example.mjs
    run-raw-api-batch.mjs
    import-interactive-app-log.mjs
    mock-wrapper-adapter.mjs
    adapters/
      openai-responses-adapter.mjs
      anthropic-messages-adapter.mjs
      gemini-generate-content-adapter.mjs
      openai-judge-adapter.mjs
      anthropic-judge-adapter.mjs
      gemini-judge-adapter.mjs
      mock-judge-adapter.mjs
  templates/
    raw-api-request-template.v1.json
    openai-responses-request-template.v1.json
    anthropic-messages-request-template.v1.json
    gemini-generate-content-request-template.v1.json
  interactive/
    interactive-app-log.sample.jsonl
  prompts/
    judge-llm-v1.txt
    judge-llm-v2.txt
    judge-vlm-v1.txt
    judge-vlm-v2.txt
  runs/
    .gitkeep
  reports/
    .gitkeep
```

## Quick Start

1. Define tasks in `datasets/` and version them by hash.
2. Execute repeated runs per `(model, interface, task_id)`.
3. Write each trial as a JSON row matching `schemas/eval-run-row.schema.json`.
4. Aggregate runs into `reports/` and apply `config/routing-policy.v1.json`.
5. Promote `master` and `fallback` per bucket only when gate conditions pass.

### Example commands

```bash
# 1) Produce sample wrapper rows (mock adapter demo)
node eval/runners/run-wrapper-batch-example.mjs \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --output eval/runs/run-rows.jsonl \
  --model demo-model \
  --provider demo-provider \
  --trials 3

# 1b) Run real wrapper adapter (replace command with your SDK/CLI wrapper)
node eval/runners/run-wrapper-batch.mjs \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --output eval/runs/run-rows.jsonl \
  --model your-model \
  --provider your-provider \
  --command "node your-adapter.mjs --input \"{{input}}\" --model \"{{model_id}}\""

# 1c) Run raw API directly
node eval/runners/run-raw-api-batch.mjs \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --output eval/runs/run-rows.jsonl \
  --endpoint https://api.your-provider.com/v1/responses \
  --requestTemplate eval/templates/raw-api-request-template.v1.json \
  --model your-model \
  --provider your-provider \
  --apiKeyEnv YOUR_PROVIDER_API_KEY \
  --trials 3

# OpenAI adapter + wrapper runner
node eval/runners/run-wrapper-batch.mjs \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --output eval/runs/run-rows.jsonl \
  --model gpt-5.2 \
  --provider openai \
  --command "node eval/runners/adapters/openai-responses-adapter.mjs --input \"{{input}}\" --model \"{{model_id}}\" --apiKeyEnv OPENAI_API_KEY"

# Anthropic adapter + wrapper runner
node eval/runners/run-wrapper-batch.mjs \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --output eval/runs/run-rows.jsonl \
  --model claude-opus-4-1 \
  --provider anthropic \
  --command "node eval/runners/adapters/anthropic-messages-adapter.mjs --input \"{{input}}\" --model \"{{model_id}}\" --apiKeyEnv ANTHROPIC_API_KEY"

# Gemini adapter + wrapper runner
node eval/runners/run-wrapper-batch.mjs \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --output eval/runs/run-rows.jsonl \
  --model gemini-2.5-flash \
  --provider gemini \
  --command "node eval/runners/adapters/gemini-generate-content-adapter.mjs --input \"{{input}}\" --model \"{{model_id}}\" --apiKeyEnv GEMINI_API_KEY"

# 1d) Import manual interactive app runs
node eval/runners/import-interactive-app-log.mjs \
  --input eval/interactive/interactive-app-log.sample.jsonl \
  --output eval/runs/run-rows.jsonl

# 2) Aggregate and produce routing suggestion report
node eval/scoring/aggregate-runs.mjs \
  --input eval/runs/run-rows.jsonl \
  --output eval/reports/arena-report.v1.json \
  --profile balanced_default

# 2b) Auto-score machine-gradable rows from dataset rules
node eval/scoring/auto-score-rows.mjs \
  --input eval/runs/run-rows.jsonl \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --output eval/runs/run-rows.scored.jsonl

# 2c) Judge human-review rows (replace mock judge with real model command)
node eval/scoring/judge-human-rows.mjs \
  --input eval/runs/run-rows.scored.jsonl \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --promptDir eval/prompts \
  --promptVersion v1 \
  --command 'node eval/runners/adapters/mock-judge-adapter.mjs --prompt "{{prompt}}"' \
  --output eval/runs/run-rows.judged.jsonl

# 3) One-command benchmark across providers/interfaces
node eval/runners/run-benchmark-all.mjs \
  --arena llm \
  --dataset eval/datasets/llm-sample-tasks.v1.json \
  --providers openai,anthropic,gemini \
  --interfaces wrapper,raw_api \
  --trials 3 \
  --profile balanced_default \
  --judgeHuman true \
  --judgeProvider openai \
  --judgePromptVersion v1

# 3b) A/B compare judge prompt versions
node eval/runners/run-benchmark-all.mjs \
  --arena llm \
  --providers openai \
  --interfaces wrapper \
  --trials 3 \
  --judgeHuman true \
  --judgeProvider openai \
  --judgePromptVersion v1

node eval/runners/run-benchmark-all.mjs \
  --arena llm \
  --providers openai \
  --interfaces wrapper \
  --trials 3 \
  --judgeHuman true \
  --judgeProvider openai \
  --judgePromptVersion v2

# 4) One-command VLM benchmark (uses VLM sample dataset by default)
node eval/runners/run-benchmark-all.mjs \
  --arena vlm \
  --providers openai,anthropic,gemini \
  --interfaces wrapper,raw_api \
  --trials 3 \
  --profile balanced_default

# 5) Convert report JSON to Markdown summary
node eval/scoring/report-to-markdown.mjs \
  --input eval/reports/arena-report.v1.json \
  --output eval/reports/arena-report.v1.md
```

## Notes

- `interactive_app` runs must include operator and app metadata.
- Do not silently drop failed trials; keep `error_type` and `error_message`.
- Store profile used for aggregation in report metadata.
- Replace `mock-wrapper-adapter.mjs` with your real SDK/CLI adapter command for production use.
- `run-wrapper-batch.mjs` is the production runner contract for SDK/CLI wrappers.
- `run-raw-api-batch.mjs` lets you benchmark direct HTTP behavior with templated request bodies, custom auth headers, and optional API key query params.
- `import-interactive-app-log.mjs` unifies manual copy-paste app tests into the same JSONL contract.
- Provider adapters in `eval/runners/adapters/` are thin HTTP wrappers that normalize OpenAI, Anthropic, and Gemini into one output contract.
- `run-benchmark-all.mjs` runs cross-provider benchmarks and auto-generates a merged report.
- `run-benchmark-all.mjs` also auto-scores machine tasks by default before aggregation.
- `auto-score-rows.mjs` applies dataset-defined validators to compute quality/compliance for machine tasks.
- `judge-human-rows.mjs` applies a judge command to human-review tasks and writes judged scores back to rows.
- `report-to-markdown.mjs` converts aggregate JSON report into a readable master/fallback summary markdown and includes judge prompt versions.
- Built-in judge adapters are available for OpenAI, Anthropic, and Gemini, or you can pass any custom `--judgeCommand`.
