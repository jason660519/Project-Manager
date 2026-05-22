#!/usr/bin/env node

import { spawn } from "node:child_process";
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

function applyTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? "").toString());
}

function runCommand(command, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, { shell: true, env: process.env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        code,
        stdout,
        stderr,
        timedOut,
        latencyMs: Date.now() - startedAt
      });
    });
  });
}

function extractLastJson(stdout) {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.at(-1);
  if (!lastLine) return null;
  try {
    return JSON.parse(lastLine);
  } catch {
    return null;
  }
}

function printUsageAndExit(code = 0) {
  console.log(`Usage:
  node eval/runners/run-wrapper-batch.mjs \\
    --dataset <path> \\
    --output <path> \\
    --model <model_id> \\
    --provider <provider> \\
    --command "<shell template>"

Template variables:
  {{input}} {{task_id}} {{model_id}} {{provider}}

Expected adapter output (last stdout line as JSON):
  {
    "output_text": "...",
    "quality_score": 0-100,
    "compliance_score": 0-100,
    "prompt_tokens": number,
    "completion_tokens": number,
    "cost_usd": number,
    "error_type": "none|timeout|rate_limit|schema_violation|tool_error|other",
    "sdk_or_cli_version": "string",
    "wrapper_commit_hash": "string"
  }`);
  process.exit(code);
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const cwd = process.cwd();
const datasetPath = path.resolve(cwd, args.dataset ?? "eval/datasets/llm-sample-tasks.v1.json");
const outputPath = path.resolve(cwd, args.output ?? "eval/runs/run-rows.jsonl");
const commandTemplate = args.command;
const modelId = args.model;
const provider = args.provider;
const trials = Number(args.trials ?? "7");
const timeoutMs = Number(args.timeoutMs ?? "60000");
const promptTemplateVersion = args.promptVersion ?? "v1";
const temperature = Number(args.temperature ?? "0.2");
const maxTokens = Number(args.maxTokens ?? "2048");

if (!commandTemplate || !modelId || !provider) {
  console.error("Missing required flags: --command, --model, --provider");
  printUsageAndExit(1);
}

if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset not found: ${datasetPath}`);
  process.exit(1);
}

const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
if (!Array.isArray(dataset.tasks)) {
  console.error("Dataset format invalid: expected tasks array.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

for (const task of dataset.tasks) {
  for (let trialIndex = 1; trialIndex <= trials; trialIndex += 1) {
    const renderedCommand = applyTemplate(commandTemplate, {
      input: task.input,
      task_id: task.task_id,
      model_id: modelId,
      provider
    });

    const commandResult = await runCommand(renderedCommand, timeoutMs);
    const adapter = extractLastJson(commandResult.stdout);
    const outputText = adapter?.output_text ?? commandResult.stdout.trim();
    const errorType = commandResult.timedOut
      ? "timeout"
      : commandResult.code === 0
        ? adapter?.error_type ?? "none"
        : "other";

    const row = {
      run_id: `${dataset.dataset_id}-${modelId}-${task.task_id}-${trialIndex}-${Date.now()}`,
      arena: dataset.arena,
      task_id: task.task_id,
      task_bucket: task.task_bucket,
      model_id: modelId,
      provider,
      interface: "wrapper",
      trial_index: trialIndex,
      timestamp_utc: new Date().toISOString(),
      prompt_template_version: promptTemplateVersion,
      system_prompt_hash: null,
      input_hash: hashText(task.input),
      output_hash: outputText ? hashText(outputText) : null,
      temperature,
      max_tokens: maxTokens,
      retry_count: 0,
      timeout_ms: timeoutMs,
      latency_ms: commandResult.latencyMs,
      prompt_tokens: Number(adapter?.prompt_tokens ?? 0),
      completion_tokens: Number(adapter?.completion_tokens ?? 0),
      total_tokens: Number(adapter?.prompt_tokens ?? 0) + Number(adapter?.completion_tokens ?? 0),
      cost_usd: Number(adapter?.cost_usd ?? 0),
      quality_score: Number(adapter?.quality_score ?? 0),
      compliance_score: Number(adapter?.compliance_score ?? 0),
      error_type: errorType,
      error_message: commandResult.code === 0 ? null : commandResult.stderr.trim() || "wrapper command failed",
      human_review_required: task.grading_mode === "human",
      notes: null,
      output_text: outputText || null,
      sdk_or_cli_version: adapter?.sdk_or_cli_version ?? null,
      wrapper_commit_hash: adapter?.wrapper_commit_hash ?? null
    };

    fs.appendFileSync(outputPath, `${JSON.stringify(row)}\n`, "utf8");
    console.log(
      `Recorded wrapper ${task.task_id} trial ${trialIndex}/${trials} -> ${row.error_type} (${row.latency_ms} ms)`
    );
  }
}

console.log(`Finished. Output: ${outputPath}`);
