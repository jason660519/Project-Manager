#!/usr/bin/env node

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

function parseJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function scoreContainsAll(text, expectedList) {
  const normalized = (text || "").toLowerCase();
  const found = expectedList.filter((item) => normalized.includes(item.toLowerCase())).length;
  const ratio = expectedList.length === 0 ? 0 : found / expectedList.length;
  return Math.round(ratio * 100);
}

function scoreContainsAny(text, expectedList) {
  const normalized = (text || "").toLowerCase();
  const matched = expectedList.some((item) => normalized.includes(item.toLowerCase()));
  return matched ? 100 : 0;
}

function scoreJsonKeys(text, requiredKeys) {
  try {
    const parsed = JSON.parse(text);
    const present = requiredKeys.filter((key) => Object.prototype.hasOwnProperty.call(parsed, key)).length;
    const ratio = requiredKeys.length === 0 ? 0 : present / requiredKeys.length;
    return Math.round(ratio * 100);
  } catch {
    return 0;
  }
}

function evaluateRow(row, taskConfig) {
  if (!taskConfig?.evaluation || row.human_review_required) {
    return row;
  }
  const outputText = row.output_text ?? "";
  const validator = taskConfig.evaluation.validator;
  let qualityScore = row.quality_score;
  let complianceScore = row.compliance_score;

  if (validator === "contains_all") {
    qualityScore = scoreContainsAll(outputText, taskConfig.evaluation.expected ?? []);
  } else if (validator === "contains_any") {
    qualityScore = scoreContainsAny(outputText, taskConfig.evaluation.expected ?? []);
  } else if (validator === "json_keys") {
    qualityScore = scoreJsonKeys(outputText, taskConfig.evaluation.required_keys ?? []);
  }

  if (validator === "json_keys") {
    complianceScore = qualityScore;
  } else if (row.error_type !== "none") {
    complianceScore = 0;
  } else {
    complianceScore = Math.max(0, Math.min(100, Number(complianceScore ?? 100)));
  }

  return {
    ...row,
    quality_score: Number(qualityScore ?? 0),
    compliance_score: Number(complianceScore ?? 0),
    notes: row.notes ? `${row.notes}; auto_scored=true` : "auto_scored=true"
  };
}

function printUsageAndExit(code = 0) {
  console.log(`Usage:
  node eval/scoring/auto-score-rows.mjs \\
    --input eval/runs/run-rows.jsonl \\
    --dataset eval/datasets/llm-sample-tasks.v1.json \\
    --output eval/runs/run-rows.scored.jsonl
`);
  process.exit(code);
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const cwd = process.cwd();
const inputPath = path.resolve(cwd, args.input ?? "eval/runs/run-rows.jsonl");
const datasetPath = path.resolve(cwd, args.dataset ?? "eval/datasets/llm-sample-tasks.v1.json");
const outputPath = path.resolve(cwd, args.output ?? "eval/runs/run-rows.scored.jsonl");

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}
if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset file not found: ${datasetPath}`);
  process.exit(1);
}

const rows = parseJsonl(inputPath);
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
const taskMap = new Map((dataset.tasks ?? []).map((task) => [task.task_id, task]));

const scoredRows = rows.map((row) => evaluateRow(row, taskMap.get(row.task_id)));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, scoredRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
console.log(`Wrote scored rows: ${outputPath}`);
