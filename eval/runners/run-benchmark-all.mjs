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

function runCommand(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk.toString());
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function printUsageAndExit(code = 0) {
  console.log(`Usage:
  node eval/runners/run-benchmark-all.mjs \\
    --arena llm|vlm \\
    --dataset eval/datasets/llm-sample-tasks.v1.json \\
    --providers openai,anthropic,gemini \\
    --interfaces wrapper,raw_api \\
    --trials 3 \\
    --profile balanced_default

Required env vars by provider:
  openai    -> OPENAI_API_KEY
  anthropic -> ANTHROPIC_API_KEY
  gemini    -> GEMINI_API_KEY

Notes:
  - Missing API key providers are skipped.
  - Set --interfaces wrapper to only run adapters.
  - Set --interfaces raw_api to only run direct HTTP tests.
  - Set --dryRun true to print generated commands only.
  - Generates both JSON report and Markdown summary.
  - Auto-scores machine tasks by dataset rules unless --skipAutoScore true.
  - To judge human tasks, set --judgeHuman true and provide --judgeCommand.
  - Or set --judgeProvider openai|anthropic|gemini to use built-in judge adapters.
  - Judge prompts default to eval/prompts/judge-llm-v1.txt and judge-vlm-v1.txt.
`);
  process.exit(code);
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const cwd = process.cwd();
const arena = args.arena ?? "llm";
const defaultDataset =
  arena === "vlm" ? "eval/datasets/vlm-sample-tasks.v1.json" : "eval/datasets/llm-sample-tasks.v1.json";
const dataset = args.dataset ?? defaultDataset;
const providers = (args.providers ?? "openai,anthropic,gemini")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const interfaces = (args.interfaces ?? "wrapper,raw_api")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const trials = Number(args.trials ?? "3");
const profile = args.profile ?? "balanced_default";
const dryRun = args.dryRun === "true";
const skipAutoScore = args.skipAutoScore === "true";
const judgeHuman = args.judgeHuman === "true";
const judgeCommand = args.judgeCommand ?? null;
const judgeProvider = args.judgeProvider ?? null;
const judgeModel = args.judgeModel ?? null;
const judgePromptVersion = args.judgePromptVersion ?? "v1";
const judgePromptDir = args.judgePromptDir ?? "eval/prompts";
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const combinedPath = path.resolve(cwd, args.output ?? `eval/runs/benchmark-all-${stamp}.jsonl`);
const scoredPath = path.resolve(cwd, args.scoredOutput ?? `eval/runs/benchmark-all-${stamp}.scored.jsonl`);
const judgedPath = path.resolve(cwd, args.judgedOutput ?? `eval/runs/benchmark-all-${stamp}.judged.jsonl`);
const reportPath = path.resolve(cwd, args.report ?? `eval/reports/benchmark-all-${stamp}.json`);
const summaryPath = path.resolve(cwd, args.summary ?? `eval/reports/benchmark-all-${stamp}.md`);

const providerMap = {
  openai: {
    keyEnv: "OPENAI_API_KEY",
    model: args.openaiModel ?? "gpt-5.2",
    wrapperCommand:
      'node eval/runners/adapters/openai-responses-adapter.mjs --input "{{input}}" --model "{{model_id}}" --apiKeyEnv OPENAI_API_KEY',
    raw: {
      endpoint: "https://api.openai.com/v1/responses",
      template: "eval/templates/openai-responses-request-template.v1.json",
      authMode: "bearer",
      extraHeaders: null,
      outputPath: "output_text",
      qualityPath: "quality_score",
      compliancePath: "compliance_score",
      promptTokensPath: "usage.prompt_tokens",
      completionTokensPath: "usage.completion_tokens",
      costPath: "cost_usd"
    }
  },
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    model: args.anthropicModel ?? "claude-opus-4-1",
    wrapperCommand:
      'node eval/runners/adapters/anthropic-messages-adapter.mjs --input "{{input}}" --model "{{model_id}}" --apiKeyEnv ANTHROPIC_API_KEY',
    raw: {
      endpoint: "https://api.anthropic.com/v1/messages",
      template: "eval/templates/anthropic-messages-request-template.v1.json",
      authMode: "x-api-key",
      extraHeaders: '{"anthropic-version":"2023-06-01"}',
      outputPath: "content.0.text",
      qualityPath: "quality_score",
      compliancePath: "compliance_score",
      promptTokensPath: "usage.input_tokens",
      completionTokensPath: "usage.output_tokens",
      costPath: "cost_usd"
    }
  },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    model: args.geminiModel ?? "gemini-2.5-flash",
    wrapperCommand:
      'node eval/runners/adapters/gemini-generate-content-adapter.mjs --input "{{input}}" --model "{{model_id}}" --apiKeyEnv GEMINI_API_KEY',
    raw: {
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{{model_id}}:generateContent",
      template: "eval/templates/gemini-generate-content-request-template.v1.json",
      authMode: "x-goog-api-key",
      extraHeaders: null,
      outputPath: "candidates.0.content.parts.0.text",
      qualityPath: "quality_score",
      compliancePath: "compliance_score",
      promptTokensPath: "usageMetadata.promptTokenCount",
      completionTokensPath: "usageMetadata.candidatesTokenCount",
      costPath: "cost_usd"
    }
  }
};

const tempFiles = [];
for (const provider of providers) {
  const config = providerMap[provider];
  if (!config) {
    console.warn(`Skip unknown provider: ${provider}`);
    continue;
  }
  if (!dryRun && !process.env[config.keyEnv]) {
    console.warn(`Skip ${provider}: missing env ${config.keyEnv}`);
    continue;
  }

  if (interfaces.includes("wrapper")) {
    const out = `eval/runs/benchmark-${provider}-wrapper-${stamp}.jsonl`;
    tempFiles.push(path.resolve(cwd, out));
    const cmd =
      `node eval/runners/run-wrapper-batch.mjs --dataset "${dataset}" --output "${out}" ` +
      `--model "${config.model}" --provider "${provider}" --trials ${trials} ` +
      `--command "${config.wrapperCommand.replaceAll('"', '\\"')}"`;
    if (dryRun) {
      console.log(`[dry-run] ${cmd}`);
    }
    const result = dryRun ? { code: 0 } : await runCommand(cmd, cwd);
    if (result.code !== 0) {
      console.error(`Wrapper benchmark failed for ${provider}`);
      process.exit(result.code ?? 1);
    }
  }

  if (interfaces.includes("raw_api")) {
    const out = `eval/runs/benchmark-${provider}-raw-${stamp}.jsonl`;
    tempFiles.push(path.resolve(cwd, out));
    const endpoint = config.raw.endpoint.replace("{{model_id}}", encodeURIComponent(config.model));
    let cmd =
      `node eval/runners/run-raw-api-batch.mjs --dataset "${dataset}" --output "${out}" ` +
      `--endpoint "${endpoint}" --requestTemplate "${config.raw.template}" ` +
      `--model "${config.model}" --provider "${provider}" --apiKeyEnv ${config.keyEnv} ` +
      `--authMode ${config.raw.authMode} --trials ${trials} ` +
      `--outputPath "${config.raw.outputPath}" --qualityPath "${config.raw.qualityPath}" ` +
      `--compliancePath "${config.raw.compliancePath}" --promptTokensPath "${config.raw.promptTokensPath}" ` +
      `--completionTokensPath "${config.raw.completionTokensPath}" --costPath "${config.raw.costPath}"`;
    if (config.raw.extraHeaders) {
      cmd += ` --extraHeaders '${config.raw.extraHeaders}'`;
    }
    if (dryRun) {
      console.log(`[dry-run] ${cmd}`);
    }
    const result = dryRun ? { code: 0 } : await runCommand(cmd, cwd);
    if (result.code !== 0) {
      console.error(`Raw API benchmark failed for ${provider}`);
      process.exit(result.code ?? 1);
    }
  }
}

if (tempFiles.length === 0) {
  console.error("No benchmark files generated. Check providers, interfaces, and API keys.");
  process.exit(1);
}

if (dryRun) {
  console.log("Dry run complete.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(combinedPath), { recursive: true });
fs.writeFileSync(combinedPath, "", "utf8");
for (const filePath of tempFiles) {
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, "utf8");
  fs.appendFileSync(combinedPath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

let aggregateInput = skipAutoScore ? combinedPath : scoredPath;
if (!skipAutoScore) {
  const autoScoreCmd =
    `node eval/scoring/auto-score-rows.mjs --input "${combinedPath}" --dataset "${dataset}" --output "${scoredPath}"`;
  const autoScoreResult = await runCommand(autoScoreCmd, cwd);
  if (autoScoreResult.code !== 0) {
    console.error("Auto scoring failed.");
    process.exit(autoScoreResult.code ?? 1);
  }
}

if (judgeHuman) {
  let resolvedJudgeCommand = judgeCommand;
  if (!resolvedJudgeCommand && judgeProvider) {
    if (judgeProvider === "openai") {
      const model = judgeModel ?? "gpt-5.2";
      resolvedJudgeCommand =
        `node eval/runners/adapters/openai-judge-adapter.mjs --prompt "{{prompt}}" ` +
        `--model "${model}" --apiKeyEnv OPENAI_API_KEY`;
    } else if (judgeProvider === "anthropic") {
      const model = judgeModel ?? "claude-opus-4-1";
      resolvedJudgeCommand =
        `node eval/runners/adapters/anthropic-judge-adapter.mjs --prompt "{{prompt}}" ` +
        `--model "${model}" --apiKeyEnv ANTHROPIC_API_KEY`;
    } else if (judgeProvider === "gemini") {
      const model = judgeModel ?? "gemini-2.5-flash";
      resolvedJudgeCommand =
        `node eval/runners/adapters/gemini-judge-adapter.mjs --prompt "{{prompt}}" ` +
        `--model "${model}" --apiKeyEnv GEMINI_API_KEY`;
    } else {
      console.error(`Unsupported --judgeProvider: ${judgeProvider}`);
      process.exit(1);
    }
  }
  if (!resolvedJudgeCommand) {
    console.error("Missing judge configuration. Provide --judgeCommand or --judgeProvider.");
    process.exit(1);
  }
  const judgeCmd =
    `node eval/scoring/judge-human-rows.mjs --input "${aggregateInput}" --dataset "${dataset}" ` +
    `--promptDir "${judgePromptDir}" --promptVersion "${judgePromptVersion}" ` +
    `--command "${resolvedJudgeCommand.replaceAll('"', '\\"')}" ` +
    `--output "${judgedPath}"`;
  const judgeResult = await runCommand(judgeCmd, cwd);
  if (judgeResult.code !== 0) {
    console.error("Judge scoring failed.");
    process.exit(judgeResult.code ?? 1);
  }
  aggregateInput = judgedPath;
}

const aggregateCmd =
  `node eval/scoring/aggregate-runs.mjs --input "${aggregateInput}" --output "${reportPath}" --profile ${profile}`;
const aggregateResult = await runCommand(aggregateCmd, cwd);
if (aggregateResult.code !== 0) {
  console.error("Aggregation failed.");
  process.exit(aggregateResult.code ?? 1);
}

const markdownCmd =
  `node eval/scoring/report-to-markdown.mjs --input "${reportPath}" --output "${summaryPath}" --topN 3`;
const markdownResult = await runCommand(markdownCmd, cwd);
if (markdownResult.code !== 0) {
  console.error("Markdown summary generation failed.");
  process.exit(markdownResult.code ?? 1);
}

console.log(`Combined rows: ${combinedPath}`);
if (!skipAutoScore) {
  console.log(`Scored rows: ${scoredPath}`);
}
if (judgeHuman) {
  console.log(`Judged rows: ${judgedPath}`);
}
console.log(`Report: ${reportPath}`);
console.log(`Summary: ${summaryPath}`);
