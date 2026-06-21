#!/usr/bin/env node

/**
 * Copies local Supabase connection values from docker/supabase/.env into the app
 * `.env.local` (NEXT_PUBLIC_* only — safe for the Next.js renderer).
 *
 * Usage:
 *   node scripts/sync-local-supabase-env.mjs
 *   npm run supabase:sync-env
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const dockerEnvPath = resolve(repoRoot, 'docker/supabase/.env');
const appEnvLocalPath = resolve(repoRoot, '.env.local');

function parseEnv(content) {
  const values = new Map();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function upsertEnvLines(existingContent, entries) {
  const lines = existingContent.length > 0 ? existingContent.split('\n') : [];
  const seen = new Set();

  const nextLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      return line;
    }
    const key = trimmed.slice(0, trimmed.indexOf('=')).trim();
    if (!entries.has(key)) return line;
    seen.add(key);
    return `${key}=${entries.get(key)}`;
  });

  for (const [key, value] of entries.entries()) {
    if (seen.has(key)) continue;
    nextLines.push(`${key}=${value}`);
  }

  return `${nextLines.join('\n').replace(/\n+$/, '')}\n`;
}

if (!existsSync(dockerEnvPath)) {
  console.error(`Missing ${dockerEnvPath}. Run: cd docker/supabase && cp .env.example .env`);
  process.exit(1);
}

const dockerEnv = parseEnv(readFileSync(dockerEnvPath, 'utf8'));
const supabaseUrl = dockerEnv.get('SUPABASE_PUBLIC_URL');
const anonKey = dockerEnv.get('ANON_KEY');

if (!supabaseUrl || !anonKey) {
  console.error('docker/supabase/.env must define SUPABASE_PUBLIC_URL and ANON_KEY.');
  process.exit(1);
}

const entries = new Map([
  ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey],
  ['PM_BACKEND_MODE', 'local-docker-supabase'],
  ['PM_BACKEND_SUPABASE_URL', supabaseUrl],
  ['PM_BACKEND_SUPABASE_ANON_KEY', anonKey],
]);

const existing = existsSync(appEnvLocalPath) ? readFileSync(appEnvLocalPath, 'utf8') : '';
writeFileSync(appEnvLocalPath, upsertEnvLines(existing, entries), 'utf8');

console.log(`Updated ${appEnvLocalPath}`);
console.log(`  NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`);
