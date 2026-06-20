#!/usr/bin/env node
/**
 * xmux runtime performance benchmark.
 *
 * Run against an already-started dev or Tauri web target:
 *   npm run dev
 *   node scripts/xmux-perf-runtime.mjs --url http://127.0.0.1:43187/xmux --json
 *
 * This harness measures browser-observable xmux runtime behavior. Native PTY
 * throughput is measured when the target route runs inside Tauri and exposes
 * the xmux native PTY benchmark hook.
 */
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

const DEFAULT_URL = 'http://127.0.0.1:43187/xmux';
const LAYOUT_STORAGE_KEY = 'pm.xmux.layout.snapshots';
const PTY_BENCH_BYTES = 64 * 1024;
const PTY_BENCH_TIMEOUT_MS = 5000;

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printHelp() {
  console.log(`xmux runtime performance benchmark

Usage:
  node scripts/xmux-perf-runtime.mjs --url http://127.0.0.1:43187/xmux --json

Options:
  --url <url>       Target xmux route. Defaults to ${DEFAULT_URL}
  --output <path>   Write the JSON report to a file.
  --json            Print machine-readable JSON only.
  --sample          Print a sample report without launching a browser.
  --headed          Run Playwright with a visible browser window.
  --help            Show this help.

Notes:
  - Start the app first with npm run dev or npm run tauri:dev.
  - Browser mode validates route/render/layout persistence timing.
  - Native PTY throughput is measured in Tauri via the xmux native PTY benchmark hook.
`);
}

function unavailableNativePtyReport(note) {
  return {
    nativePtyAvailable: false,
    bytesRequested: PTY_BENCH_BYTES,
    bytesRead: 0,
    elapsedMs: 0,
    throughputBytesPerSecond: 0,
    sentinelSeen: false,
    notes: [note],
  };
}

function sampleReport() {
  return {
    status: 'sample',
    targetUrl: DEFAULT_URL,
    startedAt: new Date(0).toISOString(),
    completedAt: new Date(0).toISOString(),
    route: {
      domContentLoadedMs: 1,
      xmuxReadyMs: 1,
    },
    layoutPersistence: {
      storageWritesDuringResize: 1,
      flushLatencyMs: 200,
    },
    terminal: {
      ...unavailableNativePtyReport('Native PTY throughput requires running inside Tauri.'),
    },
    consoleErrors: [],
  };
}

async function withBrowser(fn) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !hasFlag('--headed') });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function waitForXmuxReady(page) {
  await page.waitForSelector('text=XMUX', { timeout: 15000 });
  await page.waitForSelector('input[aria-label="Browser URL"], button[aria-label="Close pane"]', {
    timeout: 15000,
  });
}

async function measureLayoutPersistence(page) {
  await page.evaluate((storageKey) => {
    window.__xmuxPerf = {
      storageKey,
      writes: [],
      firstResizeAt: 0,
      flushedAt: 0,
    };
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = (key, value) => {
      if (key === storageKey) {
        window.__xmuxPerf.writes.push({
          key,
          length: String(value).length,
          at: performance.now(),
        });
        window.__xmuxPerf.flushedAt = performance.now();
      }
      return originalSetItem(key, value);
    };
  }, LAYOUT_STORAGE_KEY);

  const separator = page.locator('[role="separator"][aria-label="Resize split"]').first();
  const box = await separator.boundingBox();
  if (!box) {
    throw new Error('Resize split separator was not visible.');
  }

  await page.evaluate(() => {
    window.__xmuxPerf.firstResizeAt = performance.now();
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2 + 130, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(350);

  return page.evaluate(() => {
    const perf = window.__xmuxPerf;
    return {
      storageWritesDuringResize: perf.writes.length,
      flushLatencyMs: Math.max(0, Math.round(perf.flushedAt - perf.firstResizeAt)),
      writePayloadBytes: perf.writes.map((write) => write.length),
    };
  });
}

async function measureNativePty(page) {
  return page.evaluate(
    async ({ bytes, timeoutMs }) => {
      const hook = window.__xmuxRunNativePtyBenchmark;
      if (typeof hook !== 'function') {
        return {
          nativePtyAvailable: false,
          bytesRequested: bytes,
          bytesRead: 0,
          elapsedMs: 0,
          throughputBytesPerSecond: 0,
          sentinelSeen: false,
          notes: ['xmux native PTY benchmark hook is not available in this runtime.'],
        };
      }
      return hook({ bytes, timeoutMs });
    },
    { bytes: PTY_BENCH_BYTES, timeoutMs: PTY_BENCH_TIMEOUT_MS },
  );
}

async function runLiveBenchmark(targetUrl) {
  const startedAt = new Date().toISOString();
  const consoleErrors = [];
  const routeStarted = Date.now();

  return withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const domContentLoadedMs = Date.now() - routeStarted;
    await waitForXmuxReady(page);
    const xmuxReadyMs = Date.now() - routeStarted;
    const layoutPersistence = await measureLayoutPersistence(page);
    const terminal = await measureNativePty(page);

    return {
      status: consoleErrors.length === 0 ? 'passed' : 'passed_with_console_errors',
      targetUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      route: {
        domContentLoadedMs,
        xmuxReadyMs,
      },
      layoutPersistence,
      terminal,
      consoleErrors,
    };
  });
}

async function main() {
  if (hasFlag('--help')) {
    printHelp();
    return;
  }

  const report = hasFlag('--sample')
    ? sampleReport()
    : await runLiveBenchmark(argValue('--url', DEFAULT_URL));

  const output = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = argValue('--output');
  if (outputPath) {
    await writeFile(outputPath, output);
  }

  if (hasFlag('--json') || outputPath) {
    process.stdout.write(output);
  } else {
    console.log('xmux runtime performance benchmark');
    console.log('----------------------------------');
    console.log(`Status:                 ${report.status}`);
    console.log(`Target:                 ${report.targetUrl}`);
    console.log(`DOM content loaded:     ${report.route.domContentLoadedMs}ms`);
    console.log(`xmux ready:             ${report.route.xmuxReadyMs}ms`);
    console.log(`Layout writes:          ${report.layoutPersistence.storageWritesDuringResize}`);
    console.log(`Layout flush latency:   ${report.layoutPersistence.flushLatencyMs}ms`);
    console.log(`Console errors:         ${report.consoleErrors.length}`);
    console.log(`Native PTY measured:    ${report.terminal.nativePtyAvailable ? 'yes' : 'no'}`);
    console.log(`PTY bytes read:         ${report.terminal.bytesRead}/${report.terminal.bytesRequested}`);
    console.log(`PTY throughput:         ${report.terminal.throughputBytesPerSecond} bytes/s`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
