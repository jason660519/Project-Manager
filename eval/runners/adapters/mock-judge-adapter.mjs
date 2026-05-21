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
const prompt = args.prompt ?? "";
const lower = prompt.toLowerCase();
const hasOutputSection = lower.includes("model output:");
const looksEmptyOutput = /model output:\s*execution error type:/is.test(prompt);

let quality = 80;
let compliance = 85;
if (!hasOutputSection || looksEmptyOutput) {
  quality = 0;
  compliance = 0;
}

const result = {
  quality_score: quality,
  compliance_score: compliance,
  judge_notes: "mock_judge_applied"
};

console.log(JSON.stringify(result));
