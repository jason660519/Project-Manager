#!/usr/bin/env node

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

function printUsageAndExit(code = 0) {
  console.log(`Usage:
  node eval/runners/adapters/anthropic-messages-adapter.mjs \\
    --input "text prompt" \\
    --model claude-sonnet-4-5 \\
    --apiKeyEnv ANTHROPIC_API_KEY
`);
  process.exit(code);
}

function extractText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item && item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const model = args.model;
const input = args.input ?? "";
const apiKeyEnv = args.apiKeyEnv ?? "ANTHROPIC_API_KEY";
const endpoint = args.endpoint ?? "https://api.anthropic.com/v1/messages";
const maxTokens = Number(args.maxTokens ?? "1024");
const temperature = args.temperature ? Number(args.temperature) : undefined;
const qualityScore = Number(args.qualityScore ?? "0");
const complianceScore = Number(args.complianceScore ?? "100");

if (!model) {
  console.error("Missing required flag: --model");
  process.exit(1);
}
if (!process.env[apiKeyEnv]) {
  console.error(`Missing API key env: ${apiKeyEnv}`);
  process.exit(1);
}

const body = {
  model,
  max_tokens: maxTokens,
  messages: [{ role: "user", content: input }]
};
if (typeof temperature === "number" && Number.isFinite(temperature)) {
  body.temperature = temperature;
}

let response;
let payload;
let errorType = "none";
let errorMessage = null;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-api-key": process.env[apiKeyEnv],
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  payload = await response.json();
  if (!response.ok) {
    errorType = response.status === 429 ? "rate_limit" : "other";
    errorMessage = `HTTP ${response.status}`;
  }
} catch (error) {
  errorType = "other";
  errorMessage = error instanceof Error ? error.message : String(error);
}

const usage = payload?.usage ?? {};
const promptTokens = Number(usage.input_tokens ?? 0);
const completionTokens = Number(usage.output_tokens ?? 0);
const result = {
  output_text: extractText(payload?.content),
  quality_score: qualityScore,
  compliance_score: complianceScore,
  prompt_tokens: promptTokens,
  completion_tokens: completionTokens,
  cost_usd: Number(args.costUsd ?? "0"),
  error_type: errorType,
  error_message: errorMessage,
  sdk_or_cli_version: "anthropic-http-messages-v1",
  wrapper_commit_hash: "local-dev"
};

console.log(JSON.stringify(result));
