#!/usr/bin/env node
/**
 * xmux performance matrix runner.
 *
 * Runs the Tauri PTY benchmark across multiple payload sizes and reports
 * median throughput for regression-friendly comparisons.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_PAYLOADS = [8192, 65536, 262144];
const DEFAULT_RUNS = 3;
const DEFAULT_TIMEOUT_MS = 180000;
const DEFAULT_PTY_TIMEOUT_MS = 10000;
const DEFAULT_OUTPUT_DIR = '.project-manager/e2e-reports/xmux-perf';

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function numberArg(name, fallback) {
  const parsed = Number.parseInt(argValue(name), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePayloads(value) {
  if (!value) return DEFAULT_PAYLOADS;
  const payloads = value
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part > 0);
  return payloads.length > 0 ? payloads : DEFAULT_PAYLOADS;
}

function printHelp() {
  console.log(`xmux performance matrix

Usage:
  npm run xmux:perf:matrix -- --json
  node scripts/xmux-perf-matrix.mjs --payloads 8192,65536,262144 --runs 3 --json

Options:
  --payloads <list>      Comma-separated byte sizes. Defaults to ${DEFAULT_PAYLOADS.join(',')}
  --runs <n>             Runs per payload. Defaults to ${DEFAULT_RUNS}
  --url <url>            Target xmux route passed to xmux:perf:tauri.
  --timeout <ms>         Overall timeout passed to xmux:perf:tauri.
  --pty-timeout <ms>     PTY timeout passed to xmux:perf:tauri.
  --output-dir <path>    Directory for report JSON. Defaults to ${DEFAULT_OUTPUT_DIR}
  --json                 Print machine-readable JSON only.
  --sample               Print/write a sample report without launching Tauri.
  --help                 Show this help.

Live mode shells out to npm run xmux:perf:tauri for each measurement.
`);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function summarizeRows(rows) {
  const ranked = rows
    .filter((row) => row.runs.every((run) => run.status === 'passed'))
    .sort((a, b) => b.medianThroughputBytesPerSecond - a.medianThroughputBytesPerSecond);
  return {
    fastestBytes: ranked[0]?.bytes ?? 0,
    slowestBytes: ranked.at(-1)?.bytes ?? 0,
  };
}

function runCli(command, args, { cwd, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code, signal) => resolve({ code: code ?? 0, signal, stdout, stderr }));
    child.on('error', (error) => resolve({ code: 1, signal: null, stdout: '', stderr: error.message }));
  });
}

function parseJsonOutput(output) {
  const trimmed = output.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error(`No JSON object found in command output: ${trimmed}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function sampleRun(bytes, index) {
  const throughput = Math.max(1, Math.round(bytes * (8 + index) * 1.3));
  return {
    status: 'passed',
    bytesRequested: bytes,
    bytesRead: bytes + 567,
    elapsedMs: Math.max(1, Math.round(((bytes + 567) / throughput) * 1000)),
    throughputBytesPerSecond: throughput,
    sentinelSeen: true,
  };
}

function buildMatrixRow(bytes, runs) {
  const throughputs = runs
    .filter((run) => run.status === 'passed')
    .map((run) => run.throughputBytesPerSecond);
  return {
    bytes,
    runs,
    medianThroughputBytesPerSecond: throughputs.length ? median(throughputs) : 0,
    minThroughputBytesPerSecond: throughputs.length ? Math.min(...throughputs) : 0,
    maxThroughputBytesPerSecond: throughputs.length ? Math.max(...throughputs) : 0,
  };
}

async function writeReport(report, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(
    outputDir,
    `xmux-perf-matrix-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  report.reportPath = reportPath;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function sampleReport(payloadBytes, runsPerPayload, outputDir) {
  const matrix = payloadBytes.map((bytes) =>
    buildMatrixRow(
      bytes,
      Array.from({ length: runsPerPayload }, (_, index) => sampleRun(bytes, index)),
    ),
  );
  return writeReport(
    {
      status: 'sample',
      startedAt: new Date(0).toISOString(),
      completedAt: new Date(0).toISOString(),
      payloadBytes,
      runsPerPayload,
      matrix,
      summary: summarizeRows(matrix),
      reportPath: '',
    },
    outputDir,
  );
}

async function liveReport(payloadBytes, runsPerPayload, outputDir) {
  const startedAt = new Date().toISOString();
  const timeoutMs = numberArg('--timeout', DEFAULT_TIMEOUT_MS);
  const ptyTimeoutMs = numberArg('--pty-timeout', DEFAULT_PTY_TIMEOUT_MS);
  const url = argValue('--url');
  const matrix = [];

  for (const bytes of payloadBytes) {
    const runs = [];
    for (let index = 0; index < runsPerPayload; index += 1) {
      const args = [
        'run',
        'xmux:perf:tauri',
        '--',
        '--json',
        '--bytes',
        String(bytes),
        '--timeout',
        String(timeoutMs),
        '--pty-timeout',
        String(ptyTimeoutMs),
      ];
      if (url) args.push('--url', url);
      const res = await runCli('npm', args, { cwd: process.cwd(), env: process.env });
      if (res.code !== 0) {
        runs.push({
          status: 'failed',
          bytesRequested: bytes,
          bytesRead: 0,
          elapsedMs: 0,
          throughputBytesPerSecond: 0,
          sentinelSeen: false,
          error: res.stderr || res.stdout,
        });
        continue;
      }
      const report = parseJsonOutput(res.stdout);
      runs.push({
        status: report.status,
        bytesRequested: bytes,
        bytesRead: report.terminal.bytesRead,
        elapsedMs: report.terminal.elapsedMs,
        throughputBytesPerSecond: report.terminal.throughputBytesPerSecond,
        sentinelSeen: report.terminal.sentinelSeen,
      });
    }
    matrix.push(buildMatrixRow(bytes, runs));
  }

  return writeReport(
    {
      status: matrix.every((row) => row.runs.every((run) => run.status === 'passed'))
        ? 'passed'
        : 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      payloadBytes,
      runsPerPayload,
      matrix,
      summary: summarizeRows(matrix),
      reportPath: '',
    },
    outputDir,
  );
}

async function main() {
  if (hasFlag('--help')) {
    printHelp();
    return;
  }

  const payloadBytes = parsePayloads(argValue('--payloads'));
  const runsPerPayload = numberArg('--runs', DEFAULT_RUNS);
  const outputDir = argValue('--output-dir', DEFAULT_OUTPUT_DIR);
  const report = hasFlag('--sample')
    ? await sampleReport(payloadBytes, runsPerPayload, outputDir)
    : await liveReport(payloadBytes, runsPerPayload, outputDir);
  const output = `${JSON.stringify(report, null, 2)}\n`;

  if (hasFlag('--json')) {
    await new Promise((resolve) => process.stdout.write(output, resolve));
  } else {
    console.log('xmux performance matrix');
    console.log('-----------------------');
    console.log(`Status:          ${report.status}`);
    console.log(`Payloads:        ${report.payloadBytes.join(', ')}`);
    console.log(`Runs/payload:    ${report.runsPerPayload}`);
    console.log(`Report:          ${report.reportPath}`);
    for (const row of report.matrix) {
      console.log(
        `${row.bytes} bytes median: ${row.medianThroughputBytesPerSecond} bytes/s`,
      );
    }
  }

  process.exit(report.status === 'failed' ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
