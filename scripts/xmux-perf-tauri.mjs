#!/usr/bin/env node
/**
 * xmux Tauri performance benchmark.
 *
 * Starts (or connects to) a Tauri dev app, navigates to /xmux through
 * tauri-pilot, and measures native PTY throughput via the xmux renderer hook.
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_URL = 'http://localhost:43187/xmux';
const DEFAULT_TIMEOUT_MS = 240000;
const DEFAULT_BYTES = 64 * 1024;
const DEFAULT_PTY_TIMEOUT_MS = 5000;

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function numberArg(name, fallback) {
  const parsed = Number.parseInt(argValue(name), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printHelp() {
  console.log(`xmux Tauri performance benchmark

Usage:
  npm run xmux:perf:tauri -- --json
  node scripts/xmux-perf-tauri.mjs --url http://localhost:43187/xmux --json

Options:
  --url <url>          Target xmux route. Defaults to ${DEFAULT_URL}
  --bytes <n>          Native PTY payload bytes. Defaults to ${DEFAULT_BYTES}
  --pty-timeout <ms>   Native PTY benchmark timeout. Defaults to ${DEFAULT_PTY_TIMEOUT_MS}
  --timeout <ms>       Overall Tauri/pilot timeout. Defaults to ${DEFAULT_TIMEOUT_MS}
  --output <path>      Write the JSON report to a file.
  --json               Print machine-readable JSON only.
  --sample             Print a sample report without launching Tauri.
  --no-start           Connect to an already-running Tauri app.
  --help               Show this help.

Requirements:
  - tauri-pilot must be installed and reachable on PATH.
  - Without --no-start, this script runs tauri dev with PM_DEV_PLAINTEXT_SECRETS=1.
`);
}

function nowIso() {
  return new Date().toISOString();
}

function sampleReport() {
  return {
    status: 'sample',
    targetUrl: DEFAULT_URL,
    startedAt: new Date(0).toISOString(),
    completedAt: new Date(0).toISOString(),
    route: {
      ready: true,
      url: DEFAULT_URL,
      title: 'Project Manager',
    },
    terminal: {
      nativePtyAvailable: true,
      bytesRequested: DEFAULT_BYTES,
      bytesRead: DEFAULT_BYTES + 24,
      elapsedMs: 100,
      throughputBytesPerSecond: Math.round(((DEFAULT_BYTES + 24) / 100) * 1000),
      sentinelSeen: true,
      notes: [],
    },
    consoleErrors: [],
  };
}

function resolveRunnerPath() {
  const cargoBin = path.join(process.env.HOME ?? '', '.cargo', 'bin');
  return [cargoBin, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter);
}

function runCli(command, args, { env, cwd, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
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
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stop(child) {
  if (!child) return;
  if (child.exitCode !== null || child.signalCode) return;
  child.kill('SIGTERM');
  setTimeout(() => {
    if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
  }, 3000).unref();
}

async function stopDebugApp(env, cwd) {
  const res = await runCli('ps', ['-ax', '-o', 'pid=,command='], { env, cwd });
  if (res.code !== 0) return;
  const pids = res.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /\btarget\/debug\/project-manager\b/.test(line))
    .map((line) => Number.parseInt(line.split(/\s+/, 1)[0] ?? '', 10))
    .filter((pid) => Number.isFinite(pid) && pid > 0 && pid !== process.pid);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function parseJsonFromOutput(output) {
  const trimmed = output.trim();
  if (!trimmed) throw new Error('tauri-pilot returned empty output');
  const normalize = (value) => {
    if (typeof value === 'string') {
      const nested = value.trim();
      if (nested.startsWith('{') || nested.startsWith('[')) return JSON.parse(nested);
    }
    return value;
  };
  try {
    return normalize(JSON.parse(trimmed));
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return normalize(JSON.parse(trimmed.slice(start, end + 1)));
    }
    throw new Error(`Could not parse tauri-pilot JSON output: ${trimmed}`);
  }
}

async function waitForPilotOk(env, timeoutMs, cwd) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await runCli('tauri-pilot', ['ping'], { env, cwd });
    if (res.code === 0) {
      const state = await runCli('tauri-pilot', ['state', '--json'], { env, cwd });
      if (state.code === 0) {
        const parsed = parseJsonFromOutput(state.stdout);
        if (parsed?.url && parsed?.readyState) return;
      }
    }
    await sleep(600);
  }
  throw new Error(`tauri-pilot webview readiness timed out after ${timeoutMs}ms`);
}

async function pilotEvalJson(script, env, cwd) {
  const res = await runCli('tauri-pilot', ['eval', '-'], { env, cwd, input: script });
  if (res.code !== 0) {
    throw new Error(`tauri-pilot eval failed: ${res.stderr || res.stdout}`);
  }
  return parseJsonFromOutput(res.stdout);
}

async function waitForXmuxHook(env, cwd, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await pilotEvalJson(
      `JSON.stringify({
        url: location.href,
        title: document.title,
        textReady: document.body?.innerText?.includes('XMUX') ?? false,
        hookReady: typeof window.__xmuxRunNativePtyBenchmark === 'function',
      })`,
      env,
      cwd,
    ).catch(() => null);
    if (state?.textReady && state?.hookReady) return state;
    await sleep(500);
  }
  throw new Error(`xmux native PTY benchmark hook timed out after ${timeoutMs}ms`);
}

async function measureNativePty(env, cwd, bytes, ptyTimeoutMs) {
  return pilotEvalJson(
    `JSON.stringify(await window.__xmuxRunNativePtyBenchmark({
      bytes: ${JSON.stringify(bytes)},
      timeoutMs: ${JSON.stringify(ptyTimeoutMs)},
    }))`,
    env,
    cwd,
  );
}

async function readConsoleErrors(env, cwd) {
  const res = await runCli('tauri-pilot', ['logs', '--level', 'error', '--last', '50', '--json'], {
    env,
    cwd,
  });
  if (res.code !== 0) return [];
  try {
    const parsed = parseJsonFromOutput(res.stdout);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.logs)) return parsed.logs;
    return [];
  } catch {
    return [];
  }
}

async function runLiveBenchmark() {
  const repoRoot = process.cwd();
  const targetUrl = argValue('--url', DEFAULT_URL);
  const timeoutMs = numberArg('--timeout', DEFAULT_TIMEOUT_MS);
  const bytes = numberArg('--bytes', DEFAULT_BYTES);
  const ptyTimeoutMs = numberArg('--pty-timeout', DEFAULT_PTY_TIMEOUT_MS);
  const env = {
    ...process.env,
    PATH: resolveRunnerPath(),
    PM_DEV_PLAINTEXT_SECRETS: '1',
  };
  const startedAt = nowIso();
  let tauriChild = null;

  if (!hasFlag('--no-start')) {
    const tauriCommand = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
    tauriChild = spawn(tauriCommand, ['dev'], {
      cwd: repoRoot,
      env,
      stdio: hasFlag('--json') ? ['ignore', 'ignore', 'pipe'] : 'inherit',
      shell: false,
    });
    tauriChild.on('error', (error) => {
      throw error;
    });
  }

  try {
    await waitForPilotOk(env, timeoutMs, repoRoot);
    const nav = await runCli('tauri-pilot', ['navigate', targetUrl], { env, cwd: repoRoot });
    if (nav.code !== 0) throw new Error(`tauri-pilot navigate failed: ${nav.stderr || nav.stdout}`);
    const route = await waitForXmuxHook(env, repoRoot, timeoutMs);
    const terminal = await measureNativePty(env, repoRoot, bytes, ptyTimeoutMs);
    const consoleErrors = await readConsoleErrors(env, repoRoot);

    return {
      status:
        terminal.nativePtyAvailable && terminal.sentinelSeen && consoleErrors.length === 0
          ? 'passed'
          : 'failed',
      targetUrl,
      startedAt,
      completedAt: nowIso(),
      route: {
        ready: Boolean(route.textReady && route.hookReady),
        url: route.url,
        title: route.title,
      },
      terminal,
      consoleErrors,
    };
  } finally {
    stop(tauriChild);
    if (tauriChild) await stopDebugApp(env, repoRoot);
  }
}

async function main() {
  if (hasFlag('--help')) {
    printHelp();
    return;
  }

  const report = hasFlag('--sample') ? sampleReport() : await runLiveBenchmark();
  const output = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = argValue('--output');
  if (outputPath) await writeFile(outputPath, output);

  if (hasFlag('--json') || outputPath) {
    await new Promise((resolve) => process.stdout.write(output, resolve));
  } else {
    console.log('xmux Tauri performance benchmark');
    console.log('--------------------------------');
    console.log(`Status:             ${report.status}`);
    console.log(`Target:             ${report.targetUrl}`);
    console.log(`Route ready:        ${report.route.ready ? 'yes' : 'no'}`);
    console.log(`Native PTY:         ${report.terminal.nativePtyAvailable ? 'yes' : 'no'}`);
    console.log(`PTY bytes read:     ${report.terminal.bytesRead}/${report.terminal.bytesRequested}`);
    console.log(`PTY elapsed:        ${report.terminal.elapsedMs}ms`);
    console.log(`PTY throughput:     ${report.terminal.throughputBytesPerSecond} bytes/s`);
    console.log(`Console errors:     ${report.consoleErrors.length}`);
  }

  process.exit(report.status === 'failed' ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
