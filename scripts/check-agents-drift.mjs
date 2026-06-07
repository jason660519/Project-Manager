#!/usr/bin/env node
/**
 * check-agents-drift.mjs
 *
 * Enforces the Tier-1/2/3 multi-AI configuration model documented in
 * docs/engineering/multi-ai-config.md:
 *
 *   1. AGENTS.md is the Single Source of Truth (SSOT). It must exist and
 *      contain the canonical sections (Stack, Iron Rules, Verification Gate).
 *   2. Every brand shell (CLAUDE.md, GEMINI.md, .cursor/rules/_agents-pointer.mdc)
 *      must reference AGENTS.md by name — otherwise the reader skips the SSOT.
 *   3. Brand shells must NOT redefine SSOT section headings (## Stack,
 *      ## Iron Rules) — that is how drift creeps back in.
 *
 * Exit non-zero on any violation. Wired into `npm run verify:baseline`.
 */

import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SSOT_PATH = 'AGENTS.md';
const SSOT_REQUIRED_HEADINGS = [
  '## 2. Stack',
  '## 4. Iron Rules',
  '## 6. Verification Gate',
];

/**
 * Each shell must contain `referenceMustContain` (proves it points at SSOT)
 * and must NOT contain any of `forbiddenHeadings` (proves it has not re-grown
 * a duplicated SSOT section).
 */
const SHELLS = [
  {
    path: 'CLAUDE.md',
    referenceMustContain: ['AGENTS.md'],
    forbiddenHeadings: ['## Stack', '## Iron Rules', '## Directory Map', '## Common Commands'],
  },
  {
    path: 'GEMINI.md',
    referenceMustContain: ['AGENTS.md'],
    forbiddenHeadings: ['## Stack', '## Iron Rules', '## Directory Map', '## Common Commands'],
  },
  {
    path: '.cursor/rules/_agents-pointer.mdc',
    referenceMustContain: ['AGENTS.md'],
    forbiddenHeadings: ['## Stack', '## Iron Rules'],
  },
];

const failures = [];

async function exists(rel) {
  try {
    await stat(resolve(root, rel));
    return true;
  } catch {
    return false;
  }
}

async function read(rel) {
  return readFile(resolve(root, rel), 'utf8');
}

async function checkSsot() {
  if (!(await exists(SSOT_PATH))) {
    failures.push(`SSOT missing: ${SSOT_PATH}`);
    return;
  }
  const body = await read(SSOT_PATH);
  for (const heading of SSOT_REQUIRED_HEADINGS) {
    if (!body.includes(heading)) {
      failures.push(`SSOT ${SSOT_PATH} missing canonical heading: \`${heading}\``);
    }
  }
}

async function checkShell({ path, referenceMustContain, forbiddenHeadings }) {
  if (!(await exists(path))) {
    failures.push(`Shell missing: ${path}`);
    return;
  }
  const body = await read(path);
  for (const needle of referenceMustContain) {
    if (!body.includes(needle)) {
      failures.push(`${path} does not reference \`${needle}\` — readers will skip the SSOT.`);
    }
  }
  for (const forbidden of forbiddenHeadings) {
    // anchor to start-of-line so we don't match `## Stack overflow` inside prose
    const lineRegex = new RegExp(`^${forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
    if (lineRegex.test(body)) {
      failures.push(
        `${path} redefines SSOT section \`${forbidden}\` — move content into ${SSOT_PATH} instead.`,
      );
    }
  }
}

async function main() {
  await checkSsot();
  for (const shell of SHELLS) {
    await checkShell(shell);
  }

  if (failures.length === 0) {
    console.log('agents:check — OK');
    console.log(`  SSOT:    ${SSOT_PATH}`);
    console.log(`  Shells:  ${SHELLS.map((s) => s.path).join(', ')}`);
    return;
  }

  console.error('agents:check — FAIL');
  for (const f of failures) {
    console.error(`  • ${f}`);
  }
  console.error('');
  console.error('Fix: keep team-shared facts in AGENTS.md only. Brand shells should');
  console.error('contain a pointer line ("see AGENTS.md") plus brand-specific extras.');
  console.error('Details: docs/engineering/multi-ai-config.md');
  process.exit(1);
}

main().catch((err) => {
  console.error('agents:check — INTERNAL ERROR');
  console.error(err);
  process.exit(2);
});
