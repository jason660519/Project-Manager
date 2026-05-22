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

function printUsageAndExit(code = 0) {
  console.log(`Usage:
  node eval/scoring/report-to-markdown.mjs \\
    --input eval/reports/arena-report.v1.json \\
    --output eval/reports/arena-report.v1.md
`);
  process.exit(code);
}

const args = parseArgs(process.argv);
if (args.help === "true") {
  printUsageAndExit(0);
}

const cwd = process.cwd();
const inputPath = path.resolve(cwd, args.input ?? "eval/reports/arena-report.v1.json");
const outputPath = path.resolve(cwd, args.output ?? "eval/reports/arena-report.v1.md");
const topN = Number(args.topN ?? "3");

if (!fs.existsSync(inputPath)) {
  console.error(`Input report not found: ${inputPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const lines = [];

lines.push("# Arena Benchmark Summary");
lines.push("");
lines.push(`- Generated: ${report.generated_at_utc ?? "unknown"}`);
lines.push(`- Profile: ${report.profile ?? "unknown"}`);
lines.push(`- Input rows: ${report.input_rows ?? 0}`);
lines.push(`- Policy: ${report.policy_version ?? "unknown"}`);
lines.push("");

for (const bucket of report.bucket_reports ?? []) {
  lines.push(`## ${bucket.bucket_key}`);
  const master = bucket.master
    ? `\`${bucket.master.model_id}\` via \`${bucket.master.interface}\` (score: ${bucket.master.overall_score})`
    : "None";
  const fallback = bucket.fallback
    ? `\`${bucket.fallback.model_id}\` via \`${bucket.fallback.interface}\` (score: ${bucket.fallback.overall_score})`
    : "None";
  lines.push(`- Master: ${master}`);
  lines.push(`- Fallback: ${fallback}`);
  const judgeVersions = Array.from(
    new Set(
      (bucket.candidates ?? [])
        .flatMap((candidate) =>
          Array.isArray(candidate.judge_prompt_versions) ? candidate.judge_prompt_versions : []
        )
        .filter(Boolean)
    )
  );
  lines.push(`- Judge Prompt Versions: ${judgeVersions.length > 0 ? judgeVersions.join(", ") : "none"}`);
  lines.push("");
  lines.push(
    "| Rank | Model | Interface | Judge Prompt Version | Overall | Success | Quality | Compliance | p95 Latency | Mean Cost |"
  );
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  (bucket.candidates ?? []).slice(0, topN).forEach((candidate, index) => {
    const candidateJudgeVersions =
      Array.isArray(candidate.judge_prompt_versions) && candidate.judge_prompt_versions.length > 0
        ? candidate.judge_prompt_versions.join(", ")
        : "none";
    lines.push(
      `| ${index + 1} | ${candidate.model_id} | ${candidate.interface} | ${candidateJudgeVersions} | ${candidate.overall_score} | ${candidate.success_rate} | ${candidate.quality_score_mean} | ${candidate.compliance_score_mean} | ${candidate.latency_p95_ms} | ${candidate.cost_mean_usd} |`
    );
  });
  lines.push("");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote markdown summary: ${outputPath}`);
