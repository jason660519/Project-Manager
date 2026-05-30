#!/usr/bin/env node
/**
 * Seed `.project-manager/plugins.json` with disabled sidecar defaults when missing.
 * Used by start_project_manager.sh before reading plugin autostart state.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIRROR_PATH = path.join(ROOT, '.project-manager', 'plugins.json');

const DEFAULT_MIRROR = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  plugins: {
    'hermes-agent': { enabled: false, autostart: false, kind: 'cli' },
    openclaw: { enabled: false, autostart: false, kind: 'cli' },
    'claude-code': { enabled: true, autostart: false, kind: 'cli' },
    codex: { enabled: true, autostart: false, kind: 'cli' },
  },
};

async function main() {
  try {
    await readFile(MIRROR_PATH, 'utf8');
    return;
  } catch {
    /* create below */
  }

  await mkdir(path.dirname(MIRROR_PATH), { recursive: true });
  await writeFile(MIRROR_PATH, `${JSON.stringify(DEFAULT_MIRROR, null, 2)}\n`, 'utf8');
  console.log(`Created default plugin catalog mirror: ${MIRROR_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
