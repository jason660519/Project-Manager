#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const suite = (() => {
  const index = process.argv.indexOf('--suite');
  if (index === -1) return 'all';
  return process.argv[index + 1] ?? 'all';
})();

const timeoutMs = Number.parseInt(process.env.PM_TAURI_PILOT_E2E_TIMEOUT_MS ?? '240000', 10);
const reportsDir = path.join(repoRoot, '.project-manager', 'e2e-reports', 'tauri-pilot');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(reportsDir, runId);
const summaryPath = path.join(runDir, 'summary.json');
const testsDir = path.join(repoRoot, 'e2e', 'tauri-pilot');

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

async function listTestFiles() {
  let entries = [];
  try {
    entries = await readdir(testsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sh'))
    .map((entry) => path.join(testsDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  if (suite === 'smoke') {
    return files.filter((file) => path.basename(file).startsWith('smoke.'));
  }
  return files;
}

function resolveRunnerPath() {
  const cargoBin = path.join(process.env.HOME ?? '', '.cargo', 'bin');
  return [cargoBin, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter);
}

function runCli(command, args, { env, cwd } = {}) {
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

async function waitForPilotOk(env) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await runCli('tauri-pilot', ['ping'], { env, cwd: repoRoot });
    if (res.code === 0) return;
    await sleep(600);
  }
  throw new Error(`tauri-pilot ping timed out after ${timeoutMs}ms`);
}

const env = {
  ...process.env,
  PATH: resolveRunnerPath(),
  PM_DEV_PLAINTEXT_SECRETS: '1',
};

await mkdir(runDir, { recursive: true });
await writeFile(summaryPath, '');

const tauriCommand = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
let tauriChild = null;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop(tauriChild);
    process.exit(130);
  });
}

const summary = {
  suite,
  startedAt: new Date().toISOString(),
  completedAt: '',
  status: 'failed',
  tests: [],
};

try {
  const testFiles = await listTestFiles();
  if (testFiles.length === 0) {
    throw new Error(`No tauri-pilot E2E tests found under ${path.relative(repoRoot, testsDir)}`);
  }

  tauriChild = spawn(tauriCommand, ['dev'], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: false,
  });

  await waitForPilotOk(env);

  let failed = false;
  for (const testFile of testFiles) {
    const name = path.basename(testFile);
    const resultPath = path.join(runDir, `${name}.json`);
    const res = await runCli('bash', [testFile], { env, cwd: repoRoot });
    const record = {
      name,
      path: path.relative(repoRoot, testFile),
      status: res.code === 0 ? 'passed' : 'failed',
      exitCode: res.code,
      stdout: res.stdout,
      stderr: res.stderr,
    };
    summary.tests.push({ name, status: record.status, path: record.path });
    await writeFile(resultPath, `${JSON.stringify(record, null, 2)}\n`);
    if (res.code !== 0) {
      summary.completedAt = new Date().toISOString();
      summary.status = 'failed';
      await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
      process.exitCode = 1;
      failed = true;
      break;
    }
  }

  if (!failed) {
    summary.completedAt = new Date().toISOString();
    summary.status = 'passed';
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
} catch (error) {
  summary.completedAt = new Date().toISOString();
  summary.status = 'failed';
  summary.error = error instanceof Error ? error.message : String(error);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  stop(tauriChild);
}
