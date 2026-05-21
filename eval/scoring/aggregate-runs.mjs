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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values) {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeInverse(value, minValue, maxValue) {
  if (maxValue === minValue) return 100;
  return clamp(((maxValue - value) / (maxValue - minValue)) * 100);
}

function toRow(line) {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid JSONL row: ${line.slice(0, 120)}...`);
  }
}

const args = parseArgs(process.argv);
const cwd = process.cwd();

const inputPath = path.resolve(cwd, args.input ?? "eval/runs/run-rows.jsonl");
const profilesPath = path.resolve(cwd, args.profiles ?? "eval/config/scenario-profiles.v1.json");
const policyPath = path.resolve(cwd, args.policy ?? "eval/config/routing-policy.v1.json");
const outputPath = path.resolve(cwd, args.output ?? "eval/reports/arena-report.v1.json");
const profileNameArg = args.profile;

if (!fs.existsSync(inputPath)) {
  console.error(`Input JSONL file not found: ${inputPath}`);
  process.exit(1);
}

const profilesDoc = readJson(profilesPath);
const policyDoc = readJson(policyPath);
const profileName = profileNameArg ?? profilesDoc.default_profile;
const profile = profilesDoc.profiles[profileName];

if (!profile) {
  console.error(`Unknown profile '${profileName}'.`);
  process.exit(1);
}

const rows = fs
  .readFileSync(inputPath, "utf8")
  .split("\n")
  .map(toRow)
  .filter(Boolean);

if (rows.length === 0) {
  console.error("No rows found in input JSONL.");
  process.exit(1);
}

const groups = new Map();
for (const row of rows) {
  const key = `${row.arena}|${row.task_bucket}|${row.model_id}|${row.interface}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}

const candidateStats = [];
for (const [key, groupRows] of groups.entries()) {
  const [arena, taskBucket, modelId, iface] = key.split("|");
  const quality = groupRows.map((r) => Number(r.quality_score ?? 0));
  const compliance = groupRows.map((r) => Number(r.compliance_score ?? 0));
  const latency = groupRows.map((r) => Number(r.latency_ms ?? 0));
  const cost = groupRows.map((r) => Number(r.cost_usd ?? 0));
  const successes = groupRows.map((r) => r.error_type === "none");
  const judgePromptVersions = Array.from(
    new Set(
      groupRows
        .map((r) => r.judge_prompt_version)
        .filter((value) => typeof value === "string" && value.length > 0)
    )
  ).sort();

  const successRate = successes.filter(Boolean).length / groupRows.length;
  const qualityMean = mean(quality);
  const qualityStddev = stddev(quality);
  const qualityWorst = Math.min(...quality);
  const complianceMean = mean(compliance);
  const latencyP50 = percentile(latency, 0.5);
  const latencyP95 = percentile(latency, 0.95);
  const costMean = mean(cost);
  const stabilityScore = clamp(100 - qualityStddev * 4);

  candidateStats.push({
    arena,
    task_bucket: taskBucket,
    model_id: modelId,
    interface: iface,
    trials: groupRows.length,
    success_rate: Number(successRate.toFixed(4)),
    quality_score_mean: Number(qualityMean.toFixed(4)),
    quality_score_stddev: Number(qualityStddev.toFixed(4)),
    quality_score_worst: Number(qualityWorst.toFixed(4)),
    compliance_score_mean: Number(complianceMean.toFixed(4)),
    latency_p50_ms: Number(latencyP50.toFixed(2)),
    latency_p95_ms: Number(latencyP95.toFixed(2)),
    cost_mean_usd: Number(costMean.toFixed(6)),
    stability_score: Number(stabilityScore.toFixed(4)),
    judge_prompt_versions: judgePromptVersions
  });
}

const bucketGroups = new Map();
for (const item of candidateStats) {
  const key = `${item.arena}|${item.task_bucket}`;
  if (!bucketGroups.has(key)) bucketGroups.set(key, []);
  bucketGroups.get(key).push(item);
}

const weights = profile.weights;
const bucketReports = [];

for (const [bucketKey, candidates] of bucketGroups.entries()) {
  const qualityTop = Math.max(...candidates.map((c) => c.quality_score_mean));
  const latencyValues = candidates.map((c) => c.latency_p95_ms);
  const costValues = candidates.map((c) => c.cost_mean_usd);
  const latencyMin = Math.min(...latencyValues);
  const latencyMax = Math.max(...latencyValues);
  const costMin = Math.min(...costValues);
  const costMax = Math.max(...costValues);

  const scored = candidates.map((candidate) => {
    const latencyScore = normalizeInverse(candidate.latency_p95_ms, latencyMin, latencyMax);
    const costScore = normalizeInverse(candidate.cost_mean_usd, costMin, costMax);
    const overall =
      weights.quality_score * candidate.quality_score_mean +
      weights.stability_score * candidate.stability_score +
      weights.latency_score * latencyScore +
      weights.cost_score * costScore +
      weights.compliance_score * candidate.compliance_score_mean;

    return {
      ...candidate,
      latency_score: Number(latencyScore.toFixed(4)),
      cost_score: Number(costScore.toFixed(4)),
      overall_score: Number(overall.toFixed(4)),
      master_gate_pass: false,
      fallback_gate_pass: false
    };
  });

  scored.sort((a, b) => b.overall_score - a.overall_score);
  const masterGate = policyDoc.selection.master_gate;
  const fallbackGate = policyDoc.selection.fallback_gate;

  for (const candidate of scored) {
    candidate.master_gate_pass =
      candidate.success_rate >= masterGate.min_success_rate &&
      candidate.compliance_score_mean >= masterGate.min_compliance_score_mean &&
      qualityTop - candidate.quality_score_mean <= masterGate.quality_within_top_points;

    candidate.fallback_gate_pass =
      candidate.success_rate >= fallbackGate.min_success_rate &&
      candidate.compliance_score_mean >= fallbackGate.min_compliance_score_mean;
  }

  const master = scored.find((c) => c.master_gate_pass) ?? null;
  let fallbackPool = scored.filter((c) => c.fallback_gate_pass && c !== master);
  if (master && fallbackGate.require_not_more_expensive_than_master) {
    const cheaperOrEqual = fallbackPool.filter((c) => c.cost_mean_usd <= master.cost_mean_usd);
    if (cheaperOrEqual.length > 0) {
      fallbackPool = cheaperOrEqual;
    }
  }
  const fallback = fallbackPool[0] ?? null;

  bucketReports.push({
    bucket_key: bucketKey,
    master: master
      ? { model_id: master.model_id, interface: master.interface, overall_score: master.overall_score }
      : null,
    fallback: fallback
      ? {
          model_id: fallback.model_id,
          interface: fallback.interface,
          overall_score: fallback.overall_score
        }
      : null,
    candidates: scored
  });
}

const report = {
  version: "v1",
  generated_at_utc: new Date().toISOString(),
  input_rows: rows.length,
  profile: profileName,
  policy_version: policyDoc.version,
  bucket_reports: bucketReports.sort((a, b) => a.bucket_key.localeCompare(b.bucket_key))
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Wrote arena report: ${outputPath}`);
