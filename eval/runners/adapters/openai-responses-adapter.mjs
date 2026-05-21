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
  node eval/runners/adapters/openai-responses-adapter.mjs \\
    --input "text prompt" \\
    --model gpt-5.2 \\
    --apiKeyEnv OPENAI_API_KEY

Outputs one JSON line:
  {
    output_text,
    quality_score,
    compliance_score,
    prompt_tokens,
    completion_tokens,
    cost_usd,
    error_type,
    sdk_or_cli_version,
    wrapper_commit_hash
  }`);
  process.exit(code);
}

function extractUsage(usage) {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const promptTokens = Number(
    usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? usage.prompt_token_count ?? 0
  );
  const completionTokens = Number(
    usage.completion_tokens ??
      usage.output_tokens ??
      usage.candidatesTokenCount ??
      usage.completion_token_count ??
      0
  );
  const totalTokens = Number(usage.total_tokens ?? usage.totalTokenCount ?? promptTokens + completionTokens);
  return { promptTokens, completionTokens, totalTokens };
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const model = args.model;
const input = args.input ?? "";
const apiKeyEnv = args.apiKeyEnv ?? "OPENAI_API_KEY";
const endpoint = args.endpoint ?? "https://api.openai.com/v1/responses";
const temperature = args.temperature ? Number(args.temperature) : undefined;
const maxTokens = args.maxTokens ? Number(args.maxTokens) : undefined;
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
  input
};
if (typeof temperature === "number" && Number.isFinite(temperature)) {
  body.temperature = temperature;
}
if (typeof maxTokens === "number" && Number.isFinite(maxTokens)) {
  body.max_output_tokens = maxTokens;
}

let response;
let payload;
let errorType = "none";
let errorMessage = null;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env[apiKeyEnv]}`,
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

const usage = extractUsage(payload?.usage);
const result = {
  output_text: payload?.output_text ?? "",
  quality_score: qualityScore,
  compliance_score: complianceScore,
  prompt_tokens: usage.promptTokens,
  completion_tokens: usage.completionTokens,
  cost_usd: Number(args.costUsd ?? "0"),
  error_type: errorType,
  error_message: errorMessage,
  sdk_or_cli_version: "openai-http-responses-v1",
  wrapper_commit_hash: "local-dev"
};

console.log(JSON.stringify(result));
