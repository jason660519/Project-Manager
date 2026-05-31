#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const timeoutMs = Number.parseInt(process.env.F34_TAURI_E2E_TIMEOUT_MS ?? '180000', 10);
const reportDir = path.join(repoRoot, '.project-manager', 'e2e-reports');
const reportPath = path.join(reportDir, `f34-select-element-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const routePath = `/e2e/tauri/f34-select-element?report=${encodeURIComponent(reportPath)}`;
const route = `http://localhost:43187${routePath}`;
const tauriCommand = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
const cargoBin = path.join(process.env.HOME ?? '', '.cargo', 'bin');
const runnerPath = [cargoBin, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter);
const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readReportIfReady() {
  if (!existsSync(reportPath)) return null;
  const text = await readFile(reportPath, 'utf8');
  if (!text.trim()) return null;
  return JSON.parse(text);
}

function stop(child) {
  if (child.exitCode !== null || child.signalCode) return;
  child.kill('SIGTERM');
  setTimeout(() => {
    if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
  }, 3000).unref();
}

await mkdir(reportDir, { recursive: true });
await writeFile(reportPath, '');

console.log(`[f34-tauri-e2e] route: ${route}`);
console.log(`[f34-tauri-e2e] report: ${reportPath}`);

const originalConfigText = await readFile(tauriConfigPath, 'utf8');
let child = null;

async function restoreConfig() {
  await writeFile(tauriConfigPath, originalConfigText);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (child) stop(child);
    void restoreConfig().finally(() => process.exit(130));
  });
}

try {
  const e2eConfig = JSON.parse(originalConfigText);
  e2eConfig.build = { ...e2eConfig.build, devUrl: route };
  e2eConfig.app = {
    ...e2eConfig.app,
    windows: (e2eConfig.app?.windows ?? []).map((windowConfig, index) => (
      index === 0 ? { ...windowConfig, url: route } : windowConfig
    )),
  };
  await writeFile(tauriConfigPath, `${JSON.stringify(e2eConfig, null, 2)}\n`);

  child = spawn(tauriCommand, ['dev'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: runnerPath,
      PM_DEV_PLAINTEXT_SECRETS: '1',
    },
    stdio: 'inherit',
  });

  let exited = false;
  child.on('exit', () => {
    exited = true;
  });

  child.on('error', (error) => {
    console.error(`[f34-tauri-e2e] failed to start tauri dev: ${error.message}`);
  });

  const started = Date.now();
  let report = null;
  while (Date.now() - started < timeoutMs) {
    report = await readReportIfReady();
    if (report?.status) break;
    if (exited) break;
    await sleep(500);
  }

  stop(child);

  if (!report) {
    console.error('[f34-tauri-e2e] no report was produced before timeout or Tauri exit.');
    console.error(`[f34-tauri-e2e] report path: ${reportPath}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'passed') process.exitCode = 1;
  }
} finally {
  await restoreConfig();
}
