/**
 * Project Scanner — analyses a project directory or GitHub repo
 * and generates a `.project-manager.json` config via AI.
 *
 * This module provides:
 *  - `buildProjectContext()` — collects directory tree + key file contents
 *  - `buildScanPrompt()` — constructs the LLM prompt
 *  - `parseScanResponse()` — validates & normalises the AI output
 *  - `scanProjectLocal()` — end-to-end scan for a local path (server-side)
 */

import type { ProjectManagerConfig } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectContext {
  /** Absolute path or GitHub URL */
  source: string;
  /** The detected project name */
  projectName: string;
  /** Directory tree (text representation, depth-limited) */
  directoryTree: string;
  /** Contents of key files (README, package.json, etc.) */
  keyFiles: Record<string, string>;
  /** Detected IDE markers */
  detectedIDEs: string[];
  /** Detected agent CLIs available */
  detectedAgents: string[];
}

export interface ScanResult {
  success: boolean;
  config?: ProjectManagerConfig;
  context?: ProjectContext;
  error?: string;
  /** Raw AI response for debugging */
  rawResponse?: string;
}

// ── Key files to read ────────────────────────────────────────────────────────

/** Files to read from the project root for AI context (relative paths). */
const KEY_FILES = [
  'README.md',
  'readme.md',
  'README.MD',
  'package.json',
  'Cargo.toml',
  'pyproject.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'composer.json',
  'tsconfig.json',
  '.project-manager.json',
];

/** IDE detection markers. */
const IDE_MARKERS: Record<string, string> = {
  '.vscode': 'VSCode',
  '.idea': 'IntelliJ',
  '.trae': 'Trae',
  '.cursor': 'Cursor',
  '.antigravity': 'Antigravity',
};

/** Agent CLI detection. */
const AGENT_MARKERS: Record<string, { id: string; name: string; command: string }> = {
  '.claude': { id: 'claude-code', name: 'Claude Code', command: 'claude' },
  'AGENTS.md': { id: 'codex', name: 'Codex CLI', command: 'codex' },
};

// ── Directories to skip during tree scan ─────────────────────────────────────

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

// ── Server-side helpers (Node.js fs) ─────────────────────────────────────────

import { readdir, readFile, stat } from 'fs/promises';
import type { Dirent } from 'fs';
import { join, basename } from 'path';

/**
 * Build a text-based directory tree for the given root, up to `maxDepth` levels.
 * Skips common build/cache folders.
 */
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

    // Sort: directories first, then files
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

  // Truncate to ~300 lines to stay within token limits
  if (lines.length > 300) {
    return lines.slice(0, 300).join('\n') + '\n... (truncated, total entries: ' + lines.length + ')';
  }
  return lines.join('\n');
}

/**
 * Read a file if it exists, returning its content or null.
 * Truncates to 4KB to avoid blowing up prompt size.
 */
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

/**
 * Build a ProjectContext by scanning the local filesystem.
 * This runs server-side only (Node.js).
 */
export async function buildProjectContext(root: string): Promise<ProjectContext> {
  const directoryTree = await buildTree(root, 3);

  // Read key files
  const keyFiles: Record<string, string> = {};
  for (const file of KEY_FILES) {
    const content = await safeReadFile(join(root, file));
    if (content) {
      keyFiles[file] = content;
    }
  }

  // Also check for docs/ directory listing
  const docsContent = await safeReadFile(join(root, 'docs'));
  if (docsContent === null) {
    try {
      const docsEntries = await readdir(join(root, 'docs'));
      if (docsEntries.length > 0) {
        keyFiles['docs/'] = docsEntries.join('\n');
      }
    } catch {
      // docs/ doesn't exist, that's fine
    }
  }

  // Detect IDEs
  const detectedIDEs: string[] = [];
  for (const [marker, ide] of Object.entries(IDE_MARKERS)) {
    try {
      const s = await stat(join(root, marker));
      if (s.isDirectory()) detectedIDEs.push(ide);
    } catch {
      // marker not found
    }
  }

  // Detect agents
  const detectedAgents: string[] = [];
  for (const marker of Object.keys(AGENT_MARKERS)) {
    try {
      await stat(join(root, marker));
      detectedAgents.push(AGENT_MARKERS[marker].id);
    } catch {
      // marker not found
    }
  }

  // Infer project name
  let projectName = basename(root);
  if (keyFiles['package.json']) {
    try {
      const pkg = JSON.parse(keyFiles['package.json']);
      if (pkg.name) projectName = pkg.name;
    } catch { /* ignore parse errors */ }
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

// ── Prompt construction ──────────────────────────────────────────────────────

/**
 * Build the LLM prompt for project scanning.
 */
export function buildScanPrompt(context: ProjectContext): string {
  const keyFilesBlock = Object.entries(context.keyFiles)
    .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  return `You are a project analyst for Project Manager, a developer productivity tool.
Analyse the following project structure and generate a Project Manager configuration file.

## OUTPUT FORMAT
Return ONLY a valid JSON object (no markdown fences, no commentary). The JSON must strictly follow this schema:

{
  "schemaVersion": 1,
  "project": {
    "name": "<string>",
    "root": "${context.source}",
    "defaultIDE": "<Cursor|VSCode|Trae|Antigravity>"
  },
  "features": [
    {
      "id": "<short unique id, e.g. F01>",
      "name": "<descriptive feature name>",
      "category": "<e.g. Frontend/UI, Backend/API, Core/Auth, DevOps/CI>",
      "status": "<todo|in_progress|done|on_hold>",
      "progress": <0-100>,
      "paths": {
        "spec": "<optional: relative path to spec doc>",
        "tdd": "<optional: relative path to TDD doc>",
        "test": "<optional: relative path to tests>",
        "implementation": "<optional: relative path to implementation>"
      },
      "notes": "<optional: brief description or context>"
    }
  ],
  "adapters": {
    "ides": [
      { "id": "<string>", "name": "<string>", "type": "ide", "command": "<CLI command>" }
    ],
    "agents": [
      { "id": "<string>", "name": "<string>", "type": "agent", "command": "<CLI command>", "argsTemplate": ["--cwd", "{root}", "{prompt}"] }
    ]
  }
}

## ANALYSIS RULES
1. **project.name**: Infer from package.json name, Cargo.toml name, or directory name.
2. **project.root**: Use exactly "${context.source}".
3. **project.defaultIDE**: Detected IDEs: ${context.detectedIDEs.length > 0 ? context.detectedIDEs.join(', ') : 'none detected, default to "Cursor"'}. Pick the first detected, or "Cursor" as fallback.
4. **features**: Identify 3–15 features from the directory structure, README, and docs. Each feature should correspond to a real functional area of the project.
   - Map paths to actual files/directories that exist in the tree.
   - Set status to "todo" by default unless there is clear evidence of completion or progress.
   - Only use paths that actually appear in the directory tree.
5. **adapters.ides**: Include entries for detected IDEs. Always include at least one.
6. **adapters.agents**: Detected agents: ${context.detectedAgents.length > 0 ? context.detectedAgents.join(', ') : 'none detected'}. Include Claude Code as default if .claude/ or similar markers are present.

## PROJECT DATA

### Directory Tree
\`\`\`
${context.directoryTree}
\`\`\`

### Detected IDEs
${context.detectedIDEs.length > 0 ? context.detectedIDEs.join(', ') : 'None detected'}

### Detected Agent CLIs
${context.detectedAgents.length > 0 ? context.detectedAgents.join(', ') : 'None detected'}

### Key Files
${keyFilesBlock || '(no key files found)'}

## IMPORTANT
- Return ONLY the JSON object, no explanation or markdown fences.
- All "paths" values must be relative to the project root.
- Feature IDs should be short, unique identifiers (F01, F02, etc.).
- Generate features in the language that matches the project's documentation language.
`;
}

// ── Response parsing ─────────────────────────────────────────────────────────

/**
 * Parse and validate the AI response into a ProjectManagerConfig.
 */
export function parseScanResponse(raw: string): ProjectManagerConfig {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const config = JSON.parse(cleaned) as ProjectManagerConfig;

  // Basic validation
  if (typeof config.schemaVersion !== 'number') {
    throw new Error('Missing or invalid schemaVersion');
  }
  if (!config.project?.name || !config.project?.root) {
    throw new Error('Missing project.name or project.root');
  }
  if (!Array.isArray(config.features)) {
    throw new Error('features must be an array');
  }
  if (!config.adapters?.ides || !config.adapters?.agents) {
    throw new Error('Missing adapters.ides or adapters.agents');
  }

  // Normalize feature statuses
  const validStatuses = new Set(['todo', 'in_progress', 'done', 'on_hold']);
  for (const feature of config.features) {
    if (!validStatuses.has(feature.status)) {
      feature.status = 'todo';
    }
    if (typeof feature.progress !== 'number' || feature.progress < 0 || feature.progress > 100) {
      feature.progress = feature.status === 'done' ? 100 : 0;
    }
    if (!feature.paths) {
      feature.paths = {};
    }
  }

  return config;
}

// ── End-to-end local scan (for API route) ────────────────────────────────────

/**
 * Full scan pipeline for a local project path.
 * Calls OpenAI by default; caller can override the AI call function.
 */
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
