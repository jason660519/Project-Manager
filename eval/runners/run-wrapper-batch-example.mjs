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
    const child = spawn(command, {
      shell: true,
      env: process.env
    });

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
        latencyMs: Date.now() - startedAt,
        timedOut
      });
    });
  });
}

function toJsonSafeResult(stdout) {
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

const args = parseArgs(process.argv);
const cwd = process.cwd();

const datasetPath = path.resolve(cwd, args.dataset ?? "eval/datasets/llm-sample-tasks.v1.json");
const outputPath = path.resolve(cwd, args.output ?? "eval/runs/run-rows.jsonl");
const commandTemplate =
  args.command ??
  "node eval/runners/mock-wrapper-adapter.mjs --input \"{{input}}\" --model \"{{model_id}}\"";
const modelId = args.model ?? "example-model";
const provider = args.provider ?? "example-provider";
const trials = Number(args.trials ?? "3");
const timeoutMs = Number(args.timeoutMs ?? "60000");
const promptTemplateVersion = args.promptVersion ?? "v1";
const temperature = Number(args.temperature ?? "0.2");
const maxTokens = Number(args.maxTokens ?? "2048");

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
    const adapterResult = toJsonSafeResult(commandResult.stdout);

    const outputText = adapterResult?.output_text ?? commandResult.stdout.trim();
    const errorType = commandResult.timedOut
      ? "timeout"
      : commandResult.code === 0
        ? adapterResult?.error_type ?? "none"
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
      prompt_tokens: Number(adapterResult?.prompt_tokens ?? 0),
      completion_tokens: Number(adapterResult?.completion_tokens ?? 0),
      total_tokens: Number(adapterResult?.prompt_tokens ?? 0) + Number(adapterResult?.completion_tokens ?? 0),
      cost_usd: Number(adapterResult?.cost_usd ?? 0),
      quality_score: Number(adapterResult?.quality_score ?? 0),
      compliance_score: Number(adapterResult?.compliance_score ?? 0),
      error_type: errorType,
      error_message: commandResult.code === 0 ? null : commandResult.stderr.trim() || "wrapper command failed",
      human_review_required: task.grading_mode === "human",
      notes: null,
      output_text: outputText || null,
      sdk_or_cli_version: adapterResult?.sdk_or_cli_version ?? null,
      wrapper_commit_hash: adapterResult?.wrapper_commit_hash ?? null
    };

    fs.appendFileSync(outputPath, `${JSON.stringify(row)}\n`, "utf8");
    console.log(
      `Recorded ${task.task_id} trial ${trialIndex}/${trials} -> ${row.error_type} (${row.latency_ms} ms)`
    );
  }
}

console.log(`Finished. Output: ${outputPath}`);
