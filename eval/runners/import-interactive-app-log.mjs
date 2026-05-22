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

function toRow(line) {
  if (!line.trim()) return null;
  return JSON.parse(line);
}

function printUsageAndExit(code = 0) {
  console.log(`Usage:
  node eval/runners/import-interactive-app-log.mjs \\
    --input eval/interactive/interactive-app-log.sample.jsonl \\
    --output eval/runs/run-rows.jsonl \\
    --promptVersion v1

Input JSONL record shape:
  {
    "arena": "llm|vlm",
    "task_id": "string",
    "task_bucket": "string",
    "model_id": "string",
    "provider": "string",
    "app_name": "string",
    "app_version": "string",
    "operator_id": "string",
    "input_text": "string",
    "output_text": "string",
    "quality_score": 0-100,
    "compliance_score": 0-100,
    "latency_ms": 0,
    "cost_usd": 0,
    "error_type": "none|timeout|rate_limit|schema_violation|tool_error|other",
    "error_message": "string|null",
    "human_review_required": true|false
  }`);
  process.exit(code);
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const cwd = process.cwd();
const inputPath = path.resolve(cwd, args.input ?? "eval/interactive/interactive-app-log.sample.jsonl");
const outputPath = path.resolve(cwd, args.output ?? "eval/runs/run-rows.jsonl");
const promptTemplateVersion = args.promptVersion ?? "v1";
const temperature = Number(args.temperature ?? "0");
const maxTokens = Number(args.maxTokens ?? "0");

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const entries = fs
  .readFileSync(inputPath, "utf8")
  .split("\n")
  .map(toRow)
  .filter(Boolean);

if (entries.length === 0) {
  console.error("No interactive entries found.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

let index = 0;
for (const entry of entries) {
  index += 1;
  const inputText = entry.input_text ?? "";
  const outputText = entry.output_text ?? "";
  const promptTokens = Number(entry.prompt_tokens ?? 0);
  const completionTokens = Number(entry.completion_tokens ?? 0);
  const row = {
    run_id: `interactive-${entry.model_id}-${entry.task_id}-${index}-${Date.now()}`,
    arena: entry.arena,
    task_id: entry.task_id,
    task_bucket: entry.task_bucket,
    model_id: entry.model_id,
    provider: entry.provider,
    interface: "interactive_app",
    trial_index: Number(entry.trial_index ?? 1),
    timestamp_utc: new Date().toISOString(),
    prompt_template_version: promptTemplateVersion,
    system_prompt_hash: null,
    input_hash: hashText(inputText),
    output_hash: outputText ? hashText(outputText) : null,
    temperature,
    max_tokens: maxTokens,
    retry_count: Number(entry.retry_count ?? 0),
    timeout_ms: Number(entry.timeout_ms ?? 0),
    latency_ms: Number(entry.latency_ms ?? 0),
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    cost_usd: Number(entry.cost_usd ?? 0),
    quality_score: Number(entry.quality_score ?? 0),
    compliance_score: Number(entry.compliance_score ?? 0),
    error_type: entry.error_type ?? "none",
    error_message: entry.error_message ?? null,
    human_review_required: Boolean(entry.human_review_required),
    notes: entry.notes ?? null,
    output_text: outputText || null,
    app_name: entry.app_name ?? null,
    app_version: entry.app_version ?? null,
    operator_id: entry.operator_id ?? null,
    interaction_mode: entry.interaction_mode ?? "manual_copy_paste"
  };

  fs.appendFileSync(outputPath, `${JSON.stringify(row)}\n`, "utf8");
  console.log(`Imported interactive ${row.task_id} (${row.model_id})`);
}

console.log(`Finished. Output: ${outputPath}`);
