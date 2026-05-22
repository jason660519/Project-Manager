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
  node eval/runners/adapters/gemini-generate-content-adapter.mjs \\
    --input "text prompt" \\
    --model gemini-2.5-flash \\
    --apiKeyEnv GEMINI_API_KEY
`);
  process.exit(code);
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const model = args.model;
const input = args.input ?? "";
const apiKeyEnv = args.apiKeyEnv ?? "GEMINI_API_KEY";
const baseEndpoint = args.endpoint ?? "https://generativelanguage.googleapis.com/v1beta/models";
const qualityScore = Number(args.qualityScore ?? "0");
const complianceScore = Number(args.complianceScore ?? "100");
const temperature = args.temperature ? Number(args.temperature) : undefined;
const maxTokens = args.maxTokens ? Number(args.maxTokens) : undefined;

if (!model) {
  console.error("Missing required flag: --model");
  process.exit(1);
}
if (!process.env[apiKeyEnv]) {
  console.error(`Missing API key env: ${apiKeyEnv}`);
  process.exit(1);
}

const body = {
  contents: [{ parts: [{ text: input }] }]
};
if (typeof temperature === "number" && Number.isFinite(temperature)) {
  body.generationConfig = body.generationConfig ?? {};
  body.generationConfig.temperature = temperature;
}
if (typeof maxTokens === "number" && Number.isFinite(maxTokens)) {
  body.generationConfig = body.generationConfig ?? {};
  body.generationConfig.maxOutputTokens = maxTokens;
}

let response;
let payload;
let errorType = "none";
let errorMessage = null;
try {
  const endpoint = `${baseEndpoint}/${encodeURIComponent(model)}:generateContent`;
  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env[apiKeyEnv],
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

const usage = payload?.usageMetadata ?? {};
const promptTokens = Number(usage.promptTokenCount ?? 0);
const completionTokens = Number(usage.candidatesTokenCount ?? 0);
const result = {
  output_text: extractText(payload),
  quality_score: qualityScore,
  compliance_score: complianceScore,
  prompt_tokens: promptTokens,
  completion_tokens: completionTokens,
  cost_usd: Number(args.costUsd ?? "0"),
  error_type: errorType,
  error_message: errorMessage,
  sdk_or_cli_version: "gemini-http-generate-content-v1",
  wrapper_commit_hash: "local-dev"
};

console.log(JSON.stringify(result));
