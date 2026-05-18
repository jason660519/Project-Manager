/**
 * Server-only project scanner — uses Node.js fs. Import only from API routes.
 */

import { readdir, readFile, stat } from 'fs/promises';
import type { Dirent } from 'fs';
import { join, basename } from 'path';
import {
  AGENT_MARKERS,
  IDE_MARKERS,
  KEY_FILES,
  buildScanPrompt,
  parseScanResponse,
  type ProjectContext,
  type ScanResult,
} from './shared';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'target',
  'dist',
  'build',
  'out',
  '.turbo',
  '.cache',
  '__pycache__',
  '.pytest_cache',
  'vendor',
  '.idea',
  '.DS_Store',
  'coverage',
  '.vercel',
  '.netlify',
  'venv',
  '.venv',
  'env',
]);

function joinExternalRoot(root: string, ...segments: string[]): string {
  return join(/*turbopackIgnore: true*/ root, ...segments);
}

async function buildTree(root: string, maxDepth = 3): Promise<string> {
  const lines: string[] = [];

  async function walk(dir: string, prefix: string, depth: number) {
    if (depth > maxDepth) return;

    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (SKIP_DIRS.has(entry.name)) continue;

      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      if (entry.isDirectory()) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        await walk(join(dir, entry.name), prefix + childPrefix, depth + 1);
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
      }
    }
  }

  lines.push(`${basename(root)}/`);
  await walk(root, '', 0);

  if (lines.length > 300) {
    return lines.slice(0, 300).join('\n') + '\n... (truncated, total entries: ' + lines.length + ')';
  }
  return lines.join('\n');
}

async function safeReadFile(path: string, maxBytes = 4096): Promise<string | null> {
  try {
    const s = await stat(path);
    if (!s.isFile()) return null;
    const content = await readFile(path, 'utf-8');
    return content.length > maxBytes ? content.slice(0, maxBytes) + '\n... (truncated)' : content;
  } catch {
    return null;
  }
}

export async function buildProjectContext(root: string): Promise<ProjectContext> {
  const directoryTree = await buildTree(root, 3);

  const keyFiles: Record<string, string> = {};
  for (const file of KEY_FILES) {
    const content = await safeReadFile(joinExternalRoot(root, file));
    if (content) {
      keyFiles[file] = content;
    }
  }

  const docsContent = await safeReadFile(joinExternalRoot(root, 'docs'));
  if (docsContent === null) {
    try {
      const docsEntries = await readdir(joinExternalRoot(root, 'docs'));
      if (docsEntries.length > 0) {
        keyFiles['docs/'] = docsEntries.join('\n');
      }
    } catch {
      /* docs/ missing */
    }
  }

  const detectedIDEs: string[] = [];
  for (const [marker, ide] of Object.entries(IDE_MARKERS)) {
    try {
      const s = await stat(joinExternalRoot(root, marker));
      if (s.isDirectory()) detectedIDEs.push(ide);
    } catch {
      /* marker not found */
    }
  }

  const detectedAgents: string[] = [];
  for (const marker of Object.keys(AGENT_MARKERS)) {
    try {
      await stat(joinExternalRoot(root, marker));
      detectedAgents.push(AGENT_MARKERS[marker].id);
    } catch {
      /* marker not found */
    }
  }

  let projectName = basename(root);
  if (keyFiles['package.json']) {
    try {
      const pkg = JSON.parse(keyFiles['package.json']);
      if (pkg.name) projectName = pkg.name;
    } catch {
      /* ignore */
    }
  } else if (keyFiles['Cargo.toml']) {
    const nameMatch = keyFiles['Cargo.toml'].match(/^name\s*=\s*"(.+)"/m);
    if (nameMatch) projectName = nameMatch[1];
  }

  return {
    source: root,
    projectName,
    directoryTree,
    keyFiles,
    detectedIDEs,
    detectedAgents,
  };
}

export async function scanProjectLocal(
  root: string,
  callAI: (prompt: string) => Promise<string>,
): Promise<ScanResult> {
  try {
    const context = await buildProjectContext(root);
    const prompt = buildScanPrompt(context);
    const rawResponse = await callAI(prompt);
    const config = parseScanResponse(rawResponse);

    return { success: true, config, context, rawResponse };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
