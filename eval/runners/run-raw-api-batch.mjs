#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[key] = value;
  }
  return args;
}

function hashText(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function applyTemplate(input, vars) {
  if (typeof input === "string") {
    return input.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? "").toString());
  }
  if (Array.isArray(input)) {
    return input.map((v) => applyTemplate(v, vars));
  }
  if (input && typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) out[k] = applyTemplate(v, vars);
    return out;
  }
  return input;
}

async function withTimeout(promise, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await promise(controller.signal);
    clearTimeout(timer);
    return result;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

function printUsageAndExit(code = 0) {
  console.log(`Usage:
  node eval/runners/run-raw-api-batch.mjs \\
    --dataset <path> \\
    --output <path> \\
    --endpoint <https://...> \\
    --model <model_id> \\
    --provider <provider> \\
    --requestTemplate <json file> \\
    --apiKeyEnv <ENV_NAME> \\
    --authMode bearer|x-api-key|x-goog-api-key|none

Request template supports placeholders:
  {{input}} {{task_id}} {{model_id}} {{provider}}

Expected response value paths:
  --outputPath (default: output_text)
  --qualityPath (default: quality_score)
  --compliancePath (default: compliance_score)
  --promptTokensPath (default: prompt_tokens)
  --completionTokensPath (default: completion_tokens)
  --costPath (default: cost_usd)

Optional auth/header controls:
  --apiKeyQueryParam key
  --extraHeaders '{"anthropic-version":"2023-06-01"}'
`);
  process.exit(code);
}

function getPathValue(obj, pathValue) {
  if (!pathValue) return null;
  return pathValue.split(".").reduce((acc, key) => (acc && key in acc ? acc[key] : null), obj);
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const cwd = process.cwd();
const datasetPath = path.resolve(cwd, args.dataset ?? "eval/datasets/llm-sample-tasks.v1.json");
const outputPath = path.resolve(cwd, args.output ?? "eval/runs/run-rows.jsonl");
const templatePath = path.resolve(cwd, args.requestTemplate ?? "eval/templates/raw-api-request-template.v1.json");
const endpoint = args.endpoint;
const modelId = args.model;
const provider = args.provider;
const apiKeyEnv = args.apiKeyEnv;
const method = (args.method ?? "POST").toUpperCase();
const authMode = args.authMode ?? "bearer";
const timeoutMs = Number(args.timeoutMs ?? "60000");
const trials = Number(args.trials ?? "7");
const temperature = Number(args.temperature ?? "0.2");
const maxTokens = Number(args.maxTokens ?? "2048");
const promptTemplateVersion = args.promptVersion ?? "v1";
const outputPathExpr = args.outputPath ?? "output_text";
const qualityPathExpr = args.qualityPath ?? "quality_score";
const compliancePathExpr = args.compliancePath ?? "compliance_score";
const promptTokensPathExpr = args.promptTokensPath ?? "prompt_tokens";
const completionTokensPathExpr = args.completionTokensPath ?? "completion_tokens";
const costPathExpr = args.costPath ?? "cost_usd";
const apiKeyQueryParam = args.apiKeyQueryParam ?? null;
let extraHeaders = {};
if (args.extraHeaders) {
  try {
    extraHeaders = JSON.parse(args.extraHeaders);
  } catch {
    console.error("Invalid --extraHeaders JSON.");
    process.exit(1);
  }
}

if (!endpoint || !modelId || !provider || !apiKeyEnv) {
  console.error("Missing required flags: --endpoint, --model, --provider, --apiKeyEnv");
  printUsageAndExit(1);
}

if (!process.env[apiKeyEnv]) {
  console.error(`Missing API key in env var: ${apiKeyEnv}`);
  process.exit(1);
}

if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset not found: ${datasetPath}`);
  process.exit(1);
}
if (!fs.existsSync(templatePath)) {
  console.error(`Request template not found: ${templatePath}`);
  process.exit(1);
}

const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
const requestTemplate = JSON.parse(fs.readFileSync(templatePath, "utf8"));
if (!Array.isArray(dataset.tasks)) {
  console.error("Dataset format invalid: expected tasks array.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

for (const task of dataset.tasks) {
  for (let trialIndex = 1; trialIndex <= trials; trialIndex += 1) {
    const requestBody = applyTemplate(requestTemplate, {
      input: task.input,
      task_id: task.task_id,
      model_id: modelId,
      provider
    });

    const startedAt = Date.now();
    let response = null;
    let payload = null;
    let errorType = "none";
    let errorMessage = null;

    try {
      const headers = {
        "Content-Type": "application/json",
        ...extraHeaders
      };
      if (authMode === "bearer") {
        headers.Authorization = `Bearer ${process.env[apiKeyEnv]}`;
      } else if (authMode === "x-api-key") {
        headers["x-api-key"] = process.env[apiKeyEnv];
      } else if (authMode === "x-goog-api-key") {
        headers["x-goog-api-key"] = process.env[apiKeyEnv];
      } else if (authMode !== "none") {
        throw new Error(`Unsupported authMode: ${authMode}`);
      }

      let requestUrl = endpoint;
      if (apiKeyQueryParam) {
        const url = new URL(endpoint);
        url.searchParams.set(apiKeyQueryParam, process.env[apiKeyEnv]);
        requestUrl = url.toString();
      }

      response = await withTimeout(
        (signal) =>
          fetch(requestUrl, {
            method,
            signal,
            headers,
            body: JSON.stringify(requestBody)
          }),
        timeoutMs
      );

      payload = await response.json();
      if (!response.ok) {
        errorType = response.status === 429 ? "rate_limit" : "other";
        errorMessage = `HTTP ${response.status}`;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        errorType = "timeout";
      } else {
        errorType = "other";
      }
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const latencyMs = Date.now() - startedAt;
    const outputText = payload ? getPathValue(payload, outputPathExpr) : null;
    const qualityScore = Number(getPathValue(payload, qualityPathExpr) ?? 0);
    const complianceScore = Number(getPathValue(payload, compliancePathExpr) ?? 0);
    const promptTokens = Number(getPathValue(payload, promptTokensPathExpr) ?? 0);
    const completionTokens = Number(getPathValue(payload, completionTokensPathExpr) ?? 0);
    const costUsd = Number(getPathValue(payload, costPathExpr) ?? 0);

    const row = {
      run_id: `${dataset.dataset_id}-${modelId}-${task.task_id}-${trialIndex}-${Date.now()}`,
      arena: dataset.arena,
      task_id: task.task_id,
      task_bucket: task.task_bucket,
      model_id: modelId,
      provider,
      interface: "raw_api",
      trial_index: trialIndex,
      timestamp_utc: new Date().toISOString(),
      prompt_template_version: promptTemplateVersion,
      system_prompt_hash: null,
      input_hash: hashText(task.input),
      output_hash: outputText ? hashText(String(outputText)) : null,
      temperature,
      max_tokens: maxTokens,
      retry_count: 0,
      timeout_ms: timeoutMs,
      latency_ms: latencyMs,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost_usd: costUsd,
      quality_score: qualityScore,
      compliance_score: complianceScore,
      error_type: errorType,
      error_message: errorMessage,
      human_review_required: task.grading_mode === "human",
      notes: null,
      output_text: outputText ? String(outputText) : null,
      http_status: response?.status ?? null,
      endpoint,
      stream_mode: "unknown"
    };

    fs.appendFileSync(outputPath, `${JSON.stringify(row)}\n`, "utf8");
    console.log(`Recorded raw_api ${task.task_id} trial ${trialIndex}/${trials} -> ${row.error_type}`);
  }
}

console.log(`Finished. Output: ${outputPath}`);
