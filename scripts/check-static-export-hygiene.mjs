#!/usr/bin/env node
/**
 * Static-export hygiene — catches client-bundle and SSR/hydration footguns
 * that unit tests miss (Node fs in client graph, localStorage in useState, etc.).
 *
 * Exit 0 = pass, 1 = blocking findings.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['app', 'components', 'lib'];

const NODE_IMPORT_RE =
  /from\s+['"](?:node:)?fs(?:\/promises)?['"]|require\s*\(\s*['"](?:node:)?fs['"]\s*\)/;
const USE_CLIENT_RE = /^['"]use client['"];?\s*$/m;
const USE_STATE_READ_STORED_RE = /useState\s*(?:<[^>]+>)?\s*\(\s*readStored\w*/;
const USE_STATE_LOCAL_STORAGE_INIT_RE =
  /useState\s*(?:<[^>]+>)?\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?localStorage/;

/** Modules allowed to import Node fs outside *.server.ts / app/api (legacy server-only). */
const FS_ALLOWLIST = new Set([
  'lib/chat/toolExecutor.ts',
  'lib/scanner/server.ts',
]);

const failures = [];

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'out' || name.startsWith('.')) {
      continue;
    }
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(path);
  }
  return acc;
}

function rel(path) {
  return relative(ROOT, path).replaceAll('\\', '/');
}

function isTestFile(path) {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function isServerOnlyPath(path) {
  const r = rel(path);
  return (
    r.endsWith('.server.ts') ||
    r.endsWith('.server.tsx') ||
    r.startsWith('app/api/') ||
    r.includes('/__tests__/')
  );
}

function isClientReachable(path, content) {
  const r = rel(path);
  if (USE_CLIENT_RE.test(content)) return true;
  if (r.startsWith('app/ui/') || r.startsWith('components/')) return true;
  if (r.startsWith('app/ai_assistants/') || r.startsWith('app/chat/')) return true;
  return false;
}

const files = SCAN_ROOTS.flatMap((dir) => walk(join(ROOT, dir)));

for (const file of files) {
  const r = rel(file);
  if (isTestFile(r)) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (!isServerOnlyPath(file) && !FS_ALLOWLIST.has(r) && NODE_IMPORT_RE.test(content)) {
    if (isClientReachable(file, content)) {
      failures.push(
        `${r}: Node "fs" import in a client-reachable module. Split to *.server.ts or route through app/api / Tauri bridge.`,
      );
    }
  }

  if (USE_CLIENT_RE.test(content)) {
    if (USE_STATE_READ_STORED_RE.test(content)) {
      failures.push(
        `${r}: readStored* passed to useState(). Hydrate from localStorage in useEffect after mount (SSR-safe).`,
      );
    }
    if (USE_STATE_LOCAL_STORAGE_INIT_RE.test(content)) {
      failures.push(
        `${r}: localStorage read inside useState(() => …). Hydrate in useEffect after mount to avoid hydration mismatch.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('== Static export hygiene: FAIL ==');
  for (const item of failures) {
    console.error(`[FAIL] ${item}`);
  }
  console.error(`\n${failures.length} blocking issue(s). See docs/engineering/verification-runbook.md §6.`);
  process.exit(1);
}

console.log('== Static export hygiene: PASS ==');
