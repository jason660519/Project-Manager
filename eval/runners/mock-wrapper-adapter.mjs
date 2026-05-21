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

const args = parseArgs(process.argv);
const input = args.input ?? "";
const model = args.model ?? "mock-model";

const estimatedPromptTokens = Math.max(1, Math.ceil(input.length / 4));
const completionTokens = 120;
const randomPenalty = Math.floor(Math.random() * 8);
const qualityScore = Math.max(0, 92 - randomPenalty);
const complianceScore = Math.max(0, 98 - Math.floor(Math.random() * 3));

const result = {
  output_text: `Mock response from ${model} for input: ${input.slice(0, 80)}`,
  quality_score: qualityScore,
  compliance_score: complianceScore,
  prompt_tokens: estimatedPromptTokens,
  completion_tokens: completionTokens,
  cost_usd: Number(((estimatedPromptTokens + completionTokens) * 0.000002).toFixed(6)),
  error_type: "none",
  sdk_or_cli_version: "mock-cli/0.1.0",
  wrapper_commit_hash: "local-dev"
};

console.log(JSON.stringify(result));
