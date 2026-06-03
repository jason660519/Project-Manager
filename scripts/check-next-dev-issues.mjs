#!/usr/bin/env node
import { chromium } from 'playwright';

const DEFAULT_BASE_URL = 'http://127.0.0.1:43187';
const DEFAULT_ROUTES = ['/'];

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.NEXT_DEV_ISSUES_BASE_URL || DEFAULT_BASE_URL,
    routes: process.env.NEXT_DEV_ISSUES_ROUTES
      ? splitRoutes(process.env.NEXT_DEV_ISSUES_ROUTES)
      : DEFAULT_ROUTES,
    timeoutMs: Number(process.env.NEXT_DEV_ISSUES_TIMEOUT_MS || 15000),
    allowMissingOverlay: process.env.NEXT_DEV_ISSUES_ALLOW_MISSING_OVERLAY === '1',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base-url') {
      options.baseUrl = requireValue(argv, index);
      index += 1;
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    if (arg === '--routes') {
      options.routes = splitRoutes(requireValue(argv, index));
      index += 1;
      continue;
    }
    if (arg.startsWith('--routes=')) {
      options.routes = splitRoutes(arg.slice('--routes='.length));
      continue;
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = Number(requireValue(argv, index));
      index += 1;
      continue;
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
      continue;
    }
    if (arg === '--allow-missing-overlay') {
      options.allowMissingOverlay = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }
  if (options.routes.length === 0) {
    throw new Error('--routes must include at least one route');
  }

  return options;
}

function requireValue(argv, index) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${argv[index]}`);
  }
  return value;
}

function splitRoutes(value) {
  return value
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith('/') ? route : `/${route}`));
}

function routeUrl(baseUrl, route) {
  return new URL(route, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

function printHelp() {
  console.log(`Check Next.js dev overlay Issues count.

Usage:
  npm run verify:dev-issues -- --routes /integrations-hub,/project-progress-dashboard

Options:
  --base-url <url>       Next dev server URL. Default: ${DEFAULT_BASE_URL}
  --routes <list>        Comma-separated changed routes. Default: /
  --timeout-ms <number>  Per-route timeout. Default: 15000
  --allow-missing-overlay
                         Do not fail when the Next dev overlay is absent.
`);
}

async function readNextDevIssueState(page) {
  return page.evaluate(() => {
    const portals = Array.from(document.querySelectorAll('nextjs-portal'));
    const portalStates = portals.map((portal) => {
      const root = portal.shadowRoot;
      const badge = root?.querySelector('[data-next-badge]') ?? null;
      const toast = root?.querySelector('[data-nextjs-toast]') ?? null;
      const text = [badge?.textContent, toast?.textContent, root?.textContent]
        .filter(Boolean)
        .join('\n')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        badgeError: badge?.getAttribute('data-error') ?? null,
        badgeStatus: badge?.getAttribute('data-status') ?? null,
        badgeText: badge?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        text,
      };
    });

    const text = portalStates.map((state) => state.text).join('\n');
    const issueCounts = Array.from(text.matchAll(/\b(\d+)\s+Issues?\b/gi)).map((match) =>
      Number(match[1]),
    );
    const issueCount = issueCounts.length > 0 ? Math.max(...issueCounts) : 0;
    const hasBadgeError = portalStates.some((state) => state.badgeError === 'true');

    return {
      hasOverlay: portals.length > 0,
      hasIssue: hasBadgeError || issueCount > 0,
      issueCount,
      portalStates,
    };
  });
}

function formatConsoleMessage(message) {
  return `${message.type()}: ${message.text()}`;
}

async function checkRoute(browser, options, route) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  const onConsole = (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(formatConsoleMessage(message));
    }
  };
  const onPageError = (error) => {
    pageErrors.push(error.stack || error.message);
  };

  try {
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    const url = routeUrl(options.baseUrl, route);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
    await page.waitForTimeout(1200);

    const state = await readNextDevIssueState(page);
    page.off('console', onConsole);
    page.off('pageerror', onPageError);

    const failures = [];
    if (!state.hasOverlay && !options.allowMissingOverlay) {
      failures.push('Next.js dev overlay was not found; run this against `npm run dev`.');
    }
    if (state.hasIssue) {
      failures.push(`Next.js dev Issues badge is non-zero (${state.issueCount || 'badge error'}).`);
    }
    if (consoleErrors.length > 0) {
      failures.push(`Console error(s): ${consoleErrors.join(' | ')}`);
    }
    if (pageErrors.length > 0) {
      failures.push(`Page error(s): ${pageErrors.join(' | ')}`);
    }

    return {
      route,
      url,
      state,
      failures,
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({ headless: true });

  try {
    const results = [];
    for (const route of options.routes) {
      results.push(await checkRoute(browser, options, route));
    }

    const failed = results.filter((result) => result.failures.length > 0);
    for (const result of results) {
      const status = result.failures.length > 0 ? 'FAIL' : 'PASS';
      const count = result.state.hasOverlay ? result.state.issueCount : 'overlay missing';
      console.log(`${status} ${result.route} (${result.url}) - Next dev Issues: ${count}`);
      for (const failure of result.failures) {
        console.log(`  - ${failure}`);
      }
    }

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
