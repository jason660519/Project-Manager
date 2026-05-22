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
  node eval/runners/adapters/gemini-judge-adapter.mjs \\
    --prompt "judge prompt text" \\
    --model gemini-2.5-flash \\
    --apiKeyEnv GEMINI_API_KEY
`);
  process.exit(code);
}

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function parseJudgeJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
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

const prompt = args.prompt ?? "";
const model = args.model ?? "gemini-2.5-flash";
const apiKeyEnv = args.apiKeyEnv ?? "GEMINI_API_KEY";
const baseEndpoint = args.endpoint ?? "https://generativelanguage.googleapis.com/v1beta/models";

if (!process.env[apiKeyEnv]) {
  console.error(`Missing API key env: ${apiKeyEnv}`);
  process.exit(1);
}

let payload = null;
let errorMessage = null;
try {
  const endpoint = `${baseEndpoint}/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env[apiKeyEnv],
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${prompt}\n\nReturn only JSON with quality_score, compliance_score, judge_notes.`
            }
          ]
        }
      ]
    })
  });
  payload = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
} catch (error) {
  errorMessage = error instanceof Error ? error.message : String(error);
}

if (errorMessage) {
  console.log(
    JSON.stringify({
      quality_score: 0,
      compliance_score: 0,
      judge_notes: `gemini_judge_error: ${errorMessage}`
    })
  );
  process.exit(0);
}

const parsed = parseJudgeJson(extractText(payload));
console.log(
  JSON.stringify({
    quality_score: clampScore(parsed?.quality_score),
    compliance_score: clampScore(parsed?.compliance_score),
    judge_notes: parsed?.judge_notes ?? "gemini_judge_applied"
  })
);
