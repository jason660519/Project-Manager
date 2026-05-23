/**
 * Client-safe scanner utilities — prompt assembly and response parsing (ADR-003).
 * No Node.js `fs` imports; safe to import from React client components.
 */

import type { ProjectManagerConfig } from '../types';

export interface ProjectContext {
  source: string;
  projectName: string;
  directoryTree: string;
  keyFiles: Record<string, string>;
  detectedIDEs: string[];
  detectedAgents: string[];
}

export interface ScanResult {
  success: boolean;
  config?: ProjectManagerConfig;
  context?: ProjectContext;
  error?: string;
  rawResponse?: string;
}

export const KEY_FILES = [
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
  '.project-manager/config.json',
];

export const IDE_MARKERS: Record<string, string> = {
  '.vscode': 'VSCode',
  '.idea': 'IntelliJ',
  '.trae': 'Trae',
  '.cursor': 'Cursor',
  '.antigravity': 'Antigravity',
};

export const AGENT_MARKERS: Record<string, { id: string; name: string; command: string }> = {
  '.claude': { id: 'claude-code', name: 'Claude Code', command: 'claude' },
  'AGENTS.md': { id: 'codex', name: 'Codex CLI', command: 'codex' },
};

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
      "locatedSection": "<optional: route/module/area where this feature lives>",
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
   - Populate "locatedSection" whenever possible. It can be a route, module, workflow area, or subsystem label (not only pages).
   - Prefer deriving "locatedSection" from implementation paths first, then spec/test paths when implementation is absent.
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

export function parseScanResponse(raw: string): ProjectManagerConfig {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const config = JSON.parse(cleaned) as ProjectManagerConfig;

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
