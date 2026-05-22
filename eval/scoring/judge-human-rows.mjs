#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

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

function applyTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? "").toString());
}

function parseJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runCommand(command, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, env: process.env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
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
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
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
  node eval/scoring/judge-human-rows.mjs \\
    --input eval/runs/run-rows.scored.jsonl \\
    --dataset eval/datasets/llm-sample-tasks.v1.json \\
    --promptDir eval/prompts \\
    --promptVersion v1 \\
    --command 'node eval/runners/adapters/mock-judge-adapter.mjs --prompt "{{prompt}}"' \\
    --output eval/runs/run-rows.judged.jsonl

Judge command expected last line JSON:
  {
    "quality_score": 0-100,
    "compliance_score": 0-100,
    "judge_notes": "optional explanation"
  }`);
  process.exit(code);
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const cwd = process.cwd();
const inputPath = path.resolve(cwd, args.input ?? "eval/runs/run-rows.scored.jsonl");
const datasetPath = path.resolve(cwd, args.dataset ?? "eval/datasets/llm-sample-tasks.v1.json");
const promptTemplatePath = args.promptTemplate ? path.resolve(cwd, args.promptTemplate) : null;
const promptDir = path.resolve(cwd, args.promptDir ?? "eval/prompts");
const promptVersion = args.promptVersion ?? "v1";
const outputPath = path.resolve(cwd, args.output ?? "eval/runs/run-rows.judged.jsonl");
const commandTemplate = args.command;
const timeoutMs = Number(args.timeoutMs ?? "120000");

if (!commandTemplate) {
  console.error("Missing required --command for judge execution.");
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}
if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset file not found: ${datasetPath}`);
  process.exit(1);
}
if (promptTemplatePath && !fs.existsSync(promptTemplatePath)) {
  console.error(`Prompt template not found: ${promptTemplatePath}`);
  process.exit(1);
}
if (!promptTemplatePath && !fs.existsSync(promptDir)) {
  console.error(`Prompt directory not found: ${promptDir}`);
  process.exit(1);
}

const rows = parseJsonl(inputPath);
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
const promptTemplateOverride = promptTemplatePath ? fs.readFileSync(promptTemplatePath, "utf8") : null;
const promptCache = new Map();

function loadPromptForArena(arena) {
  if (promptTemplateOverride) return promptTemplateOverride;
  const key = arena === "vlm" ? `judge-vlm-${promptVersion}.txt` : `judge-llm-${promptVersion}.txt`;
  if (promptCache.has(key)) return promptCache.get(key);
  const filePath = path.resolve(promptDir, key);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  promptCache.set(key, content);
  return content;
}
const taskMap = new Map((dataset.tasks ?? []).map((task) => [task.task_id, task]));

const judgedRows = [];
for (const row of rows) {
  const task = taskMap.get(row.task_id);
  const isHumanTask = row.human_review_required || task?.grading_mode === "human";
  if (!isHumanTask) {
    judgedRows.push(row);
    continue;
  }

  let promptTemplate = "";
  try {
    promptTemplate = loadPromptForArena(row.arena);
  } catch (error) {
    judgedRows.push({
      ...row,
      quality_score: 0,
      compliance_score: 0,
      judge_prompt_version: promptVersion,
      notes: row.notes
        ? `${row.notes}; judge_prompt_missing=true`
        : "judge_prompt_missing=true"
    });
    continue;
  }
  const prompt = applyTemplate(promptTemplate, {
    task_id: row.task_id,
    task_bucket: row.task_bucket,
    task_input: task?.input ?? "",
    model_output: row.output_text ?? "",
    error_type: row.error_type ?? "none"
  });

  const command = applyTemplate(commandTemplate, {
    prompt,
    task_id: row.task_id,
    task_bucket: row.task_bucket
  });

  const result = await runCommand(command, timeoutMs);
  const parsed = extractLastJson(result.stdout);
  if (result.code !== 0 || !parsed) {
    judgedRows.push({
      ...row,
      quality_score: 0,
      compliance_score: 0,
      judge_prompt_version: promptVersion,
      notes: row.notes ? `${row.notes}; judge_failed=true` : "judge_failed=true"
    });
    continue;
  }

  judgedRows.push({
    ...row,
    quality_score: Number(parsed.quality_score ?? 0),
    compliance_score: Number(parsed.compliance_score ?? 0),
    judge_prompt_version: promptVersion,
    notes: row.notes
      ? `${row.notes}; judged=true; ${parsed.judge_notes ?? ""}`.trim()
      : `judged=true; ${parsed.judge_notes ?? ""}`.trim()
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, judgedRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
console.log(`Wrote judged rows: ${outputPath}`);
