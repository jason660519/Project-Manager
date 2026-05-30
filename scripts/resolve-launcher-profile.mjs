#!/usr/bin/env node
/**
 * Resolve layered launcher profiles for start_project_manager.sh and tests.
 *
 * Merge order (later wins for scalar fields; auxiliary entries merge by id):
 *   1. config/samples/launcher.minimal.json
 *   2. config/samples/launcher.dev.json when PM_LAUNCHER_PROFILE=dev
 *   3. .project-manager/launcher.local.json
 *   4. ~/.project-manager/launcher.json
 *   5. Environment URL overrides (PROJECT_MANAGER_OLLAMA_URL, ...)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeAuxEntries(baseEntries, overrideEntries) {
  const byId = new Map();
  for (const entry of baseEntries ?? []) {
    if (entry?.id) byId.set(entry.id, { ...entry });
  }
  for (const entry of overrideEntries ?? []) {
    if (!entry?.id) continue;
    byId.set(entry.id, { ...(byId.get(entry.id) ?? {}), ...entry });
  }
  return [...byId.values()];
}

function deepMerge(base, override) {
  if (!isObject(base) || !isObject(override)) return override ?? base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (key === 'auxiliaryPages' && isObject(value) && isObject(base.auxiliaryPages)) {
      out.auxiliaryPages = {
        ...base.auxiliaryPages,
        ...value,
        entries: mergeAuxEntries(base.auxiliaryPages.entries, value.entries),
      };
      continue;
    }
    if (isObject(value) && isObject(base[key])) {
      out[key] = deepMerge(base[key], value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function envAuxOverrides() {
  const mapping = [
    ['PROJECT_MANAGER_OLLAMA_URL', 'ollama-api', 'Ollama API'],
    ['PROJECT_MANAGER_OPENWEBUI_URL', 'open-webui', 'Open WebUI'],
    ['PROJECT_MANAGER_COMFYUI_URL', 'comfyui', 'ComfyUI'],
  ];
  const entries = [];
  for (const [envKey, id, label] of mapping) {
    const url = process.env[envKey]?.trim();
    if (!url) continue;
    entries.push({
      id,
      label,
      url,
      scope: 'intranet',
      enabled: true,
      openWhen: 'reachable',
    });
  }
  return entries.length ? { auxiliaryPages: { entries } } : null;
}

export function resolveLauncherProfile(options = {}) {
  const root = options.root ?? ROOT;
  const profileName = options.profile ?? process.env.PM_LAUNCHER_PROFILE ?? 'dev';

  let merged =
    readJson(path.join(root, 'config/samples/launcher.minimal.json')) ?? {
      schemaVersion: 1,
      profileId: 'minimal',
      pm: { port: 43187, startupWaitSeconds: 120, healthPath: '/project-progress-dashboard' },
      auxiliaryPages: { policy: 'respect-open-when', entries: [] },
      menu: {},
    };

  if (profileName === 'dev') {
    const dev = readJson(path.join(root, 'config/samples/launcher.dev.json'));
    if (dev) merged = deepMerge(merged, dev);
  }

  const local = readJson(path.join(root, '.project-manager/launcher.local.json'));
  if (local) merged = deepMerge(merged, local);

  const user = readJson(path.join(os.homedir(), '.project-manager/launcher.json'));
  if (user) merged = deepMerge(merged, user);

  const envLayer = envAuxOverrides();
  if (envLayer) merged = deepMerge(merged, envLayer);

  merged.profileId = merged.profileId ?? profileName;
  merged.auxiliaryPages.entries = (merged.auxiliaryPages?.entries ?? []).filter((e) => e.enabled !== false);
  return merged;
}

function parseArgs(argv) {
  const args = { format: 'json', profile: process.env.PM_LAUNCHER_PROFILE ?? 'dev', root: ROOT };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--print' || arg === '--format' && argv[i + 1] === 'json') {
      args.format = 'json';
      if (argv[i + 1] === 'json') i += 1;
      continue;
    }
    if (arg === '--aux-tsv') {
      args.format = 'tsv';
      continue;
    }
    if (arg === '--profile' && argv[i + 1]) {
      args.profile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--root' && argv[i + 1]) {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--query' && argv[i + 1]) {
      args.query = argv[i + 1];
      i += 1;
      continue;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const profile = resolveLauncherProfile({ root: args.root, profile: args.profile });

  if (args.query === 'pm.startupWaitSeconds') {
    process.stdout.write(String(profile.pm?.startupWaitSeconds ?? 120));
    return;
  }
  if (args.query === 'pm.healthPath') {
    process.stdout.write(String(profile.pm?.healthPath ?? '/project-progress-dashboard'));
    return;
  }
  if (args.query === 'menu.all') {
    process.stdout.write(String(profile.menu?.all ?? ''));
    return;
  }
  if (args.query === 'menu.core') {
    process.stdout.write(String(profile.menu?.core ?? ''));
    return;
  }

  if (args.format === 'tsv') {
    for (const entry of profile.auxiliaryPages?.entries ?? []) {
      const cols = [
        entry.id ?? '',
        entry.label ?? '',
        entry.url ?? '',
        entry.openWhen ?? 'reachable',
        entry.scope ?? '',
      ];
      process.stdout.write(`${cols.join('\t')}\n`);
    }
    return;
  }

  process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
