#!/usr/bin/env node
/**
 * Static xmux performance guardrail report.
 *
 * This is intentionally not a CPU/RSS benchmark. It reports source-level P0
 * signals that should remain true before deeper Tauri runtime profiling:
 * WebGL renderer wiring, PTY output batching, layout persistence debounce, and
 * native browser console polling payload size.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function extractRawStringAfter(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Marker not found: ${marker}`);
  }
  const start = source.indexOf('r#"', markerIndex);
  if (start === -1) {
    throw new Error(`Raw string start not found after marker: ${marker}`);
  }
  const bodyStart = start + 3;
  const end = source.indexOf('"#', bodyStart);
  if (end === -1) {
    throw new Error(`Raw string end not found after marker: ${marker}`);
  }
  return source.slice(bodyStart, end);
}

function extractNumberConst(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`));
  if (!match) {
    throw new Error(`Const not found: ${name}`);
  }
  return Number(match[1]);
}

const terminalRegistry = read('components/terminal/TerminalRegistry.ts');
const xmuxView = read('app/ui/views/XmuxView.tsx');
const xmuxWebview = read('src-tauri/src/xmux_webview.rs');
const nativePtyBenchmark = read('lib/xmux/nativePtyBenchmark.ts');
const runtimeBenchmark = read('scripts/xmux-perf-runtime.mjs');
const tauriBenchmark = read('scripts/xmux-perf-tauri.mjs');
const matrixBenchmark = read('scripts/xmux-perf-matrix.mjs');
const packageJson = read('package.json');

const captureInstaller = extractRawStringAfter(xmuxWebview, 'fn console_capture_script');
const entriesPoll = extractRawStringAfter(xmuxWebview, 'fn console_entries_script');
const clearPoll = extractRawStringAfter(xmuxWebview, 'fn console_clear_script');

const report = {
  terminal: {
    webglAddonLoaded:
      terminalRegistry.includes("from '@xterm/addon-webgl'") &&
      terminalRegistry.includes('new WebglAddon()') &&
      terminalRegistry.includes('term.loadAddon(new WebglAddon())'),
    ptyOutputBatched:
      terminalRegistry.includes('requestAnimationFrame') &&
      terminalRegistry.includes('pendingOutputChunks') &&
      terminalRegistry.includes('mergeOutputChunks') &&
      terminalRegistry.includes('scheduleTerminalOutput(session, chunk)'),
    ptyExitHandled:
      terminalRegistry.includes('onExit') &&
      terminalRegistry.includes('handlePtyExit') &&
      terminalRegistry.includes('MAX_UNEXPECTED_RESTARTS') &&
      terminalRegistry.includes('Restarting shell'),
    nativePtyBenchmarkHook:
      nativePtyBenchmark.includes('runNativePtyBenchmark') &&
      nativePtyBenchmark.includes("from 'tauri-pty'") &&
      nativePtyBenchmark.includes('__XMUX_PTY_BENCH_DONE__') &&
      xmuxView.includes('__xmuxRunNativePtyBenchmark') &&
      runtimeBenchmark.includes('__xmuxRunNativePtyBenchmark'),
    tauriPerfRunner:
      packageJson.includes('"xmux:perf:tauri"') &&
      tauriBenchmark.includes('tauri-pilot') &&
      tauriBenchmark.includes('__xmuxRunNativePtyBenchmark') &&
      tauriBenchmark.includes('nativePtyAvailable'),
    matrixPerfRunner:
      packageJson.includes('"xmux:perf:matrix"') &&
      matrixBenchmark.includes('xmux:perf:tauri') &&
      matrixBenchmark.includes('medianThroughputBytesPerSecond') &&
      matrixBenchmark.includes('.project-manager/e2e-reports/xmux-perf'),
  },
  layout: {
    persistDebounceMs: extractNumberConst(xmuxView, 'XMUX_LAYOUT_PERSIST_DEBOUNCE_MS'),
  },
  nativeBrowserConsole: {
    captureInstallerBytes: Buffer.byteLength(captureInstaller, 'utf8'),
    entriesPollBytes: Buffer.byteLength(entriesPoll, 'utf8'),
    clearPollBytes: Buffer.byteLength(clearPoll, 'utf8'),
    entriesPollToInstallerRatio:
      Buffer.byteLength(entriesPoll, 'utf8') / Buffer.byteLength(captureInstaller, 'utf8'),
  },
  nativeBrowserCreate: {
    reusesExistingChild:
      xmuxWebview.includes('if let Ok(webview) = get_child(&app, &label)') &&
      xmuxWebview.includes('webview.navigate(target.clone())') &&
      xmuxWebview.includes('xmux_webview_destroy(app.clone(), state.clone(), label.clone()).await'),
  },
};

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('xmux static performance guardrails');
  console.log('----------------------------------');
  console.log(`Terminal WebGL addon loaded: ${report.terminal.webglAddonLoaded ? 'yes' : 'no'}`);
  console.log(`PTY output batched:          ${report.terminal.ptyOutputBatched ? 'yes' : 'no'}`);
  console.log(`PTY exit handled:            ${report.terminal.ptyExitHandled ? 'yes' : 'no'}`);
  console.log(`PTY benchmark hook:          ${report.terminal.nativePtyBenchmarkHook ? 'yes' : 'no'}`);
  console.log(`Tauri perf runner:           ${report.terminal.tauriPerfRunner ? 'yes' : 'no'}`);
  console.log(`Matrix perf runner:          ${report.terminal.matrixPerfRunner ? 'yes' : 'no'}`);
  console.log(`Layout debounce:             ${report.layout.persistDebounceMs}ms`);
  console.log(`Console installer bytes:     ${report.nativeBrowserConsole.captureInstallerBytes}`);
  console.log(`Console entries poll bytes:  ${report.nativeBrowserConsole.entriesPollBytes}`);
  console.log(`Console clear poll bytes:    ${report.nativeBrowserConsole.clearPollBytes}`);
  console.log(
    `Entries/install ratio:       ${report.nativeBrowserConsole.entriesPollToInstallerRatio.toFixed(3)}`,
  );
  console.log(`Create reuses child:         ${report.nativeBrowserCreate.reusesExistingChild ? 'yes' : 'no'}`);
}
