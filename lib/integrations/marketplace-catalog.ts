import type {
  AnyPlugin,
  CliPlugin,
  EditorPlugin,
  FrontendPlugin,
  McpPlugin,
  ProviderPlugin,
} from '../types/plugins';

export type MarketplaceCategory = 'ai' | 'dev' | 'vcs' | 'pm' | 'ci' | 'notify';
export type MarketplaceKind = 'provider' | 'cli' | 'editor' | 'mcp' | 'frontend';

type ProviderDefaults = Pick<ProviderPlugin, 'baseUrl' | 'defaultModel' | 'models'>;
type CliDefaults = Pick<CliPlugin, 'command' | 'argsTemplate' | 'providerId'>;
type EditorDefaults = Pick<EditorPlugin, 'command'>;
type McpDefaults = Pick<McpPlugin, 'transport' | 'command' | 'args' | 'env' | 'url' | 'headers'>;
type FrontendDefaults = Pick<FrontendPlugin, 'packageName' | 'implementationPath'>;

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  kind: MarketplaceKind;
  accentColor: string;
  initials: string;
  /**
   * macOS .app bundle name (without the `.app` suffix) used by
   * `resolve_install_path` to locate the installed application. Differs from
   * the launcher `command` (e.g. VS Code: command `code` / bundle "Visual
   * Studio Code"). Only meaningful for `kind: 'editor'`.
   */
  appBundleName?: string;
  defaultProvider?: ProviderDefaults;
  defaultCli?: CliDefaults;
  defaultEditor?: EditorDefaults;
  defaultMcp?: McpDefaults;
  defaultFrontend?: FrontendDefaults;
}

// AI providers are managed exclusively from the Keys view (where keys are
// validated against the real API). They intentionally do not appear in the
// Plugins hub anymore.
export const MARKETPLACE: MarketplacePlugin[] = [
  {
    id: 'claude-code', name: 'Claude Code CLI', description: 'Anthropic agentic CLI for software engineering tasks. (Distinct from Claude Code Desktop.)',
    category: 'dev', kind: 'cli', accentColor: 'bg-[rgb(196_122_58)]', initials: 'CC',
    defaultCli: { command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'], providerId: 'anthropic' },
  },
  {
    id: 'codex', name: 'Codex CLI', description: 'OpenAI Codex command-line agent for code tasks.',
    category: 'dev', kind: 'cli', accentColor: 'bg-[rgb(16_163_127)]', initials: 'CX',
    defaultCli: { command: 'codex', argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'], providerId: 'openai' },
  },
  {
    id: 'monaco-editor', name: 'Monaco Editor Workbench', description: 'Project-scoped frontend editor plugin for editing feature specs, tests, logs, and implementation files inside Project Manager.',
    category: 'dev', kind: 'frontend', accentColor: 'bg-[rgb(0_122_204)]', initials: 'ME',
    defaultFrontend: { packageName: '@monaco-editor/react', implementationPath: 'app/ui/views/MonacoEditorWorkbench.tsx' },
  },
  {
    id: 'hermes-agent', name: 'Hermes Agent CLI', description: 'Project-scoped Hermes agent CLI with isolated memory, sessions, skills, and dashboard state.',
    category: 'dev', kind: 'cli', accentColor: 'bg-amber-700', initials: 'HA',
    defaultCli: { command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/hermes', argsTemplate: ['chat', '-q', '{prompt}'] },
  },
  {
    id: 'openclaw', name: 'OpenClaw CLI', description: 'Project-scoped OpenClaw agent CLI (with local gateway) — isolated state, workspace, updates, and rollback.',
    category: 'dev', kind: 'cli', accentColor: 'bg-rose-700', initials: 'OC',
    defaultCli: { command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/openclaw', argsTemplate: ['agent', '--message', '{prompt}'] },
  },
  {
    id: 'aider', name: 'Aider CLI', description: 'AI pair programmer that edits code in your terminal.',
    category: 'dev', kind: 'cli', accentColor: 'bg-violet-700', initials: 'AD',
    defaultCli: { command: 'aider', argsTemplate: ['--yes', '--message', '{prompt}'] },
  },
  {
    id: 'cursor', name: 'Cursor IDE App', description: 'AI-first code editor IDE built on VS Code (desktop application, not a CLI).',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(107_108_246)]', initials: 'CR',
    appBundleName: 'Cursor',
    defaultEditor: { command: 'cursor' },
  },
  {
    id: 'vscode', name: 'VS Code IDE App', description: 'Microsoft Visual Studio Code IDE (desktop application, not the `code` CLI shim).',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(0_122_204)]', initials: 'VS',
    appBundleName: 'Visual Studio Code',
    defaultEditor: { command: 'code' },
  },
  {
    id: 'zed', name: 'Zed IDE App', description: 'High-performance multiplayer code editor IDE (desktop application).',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(8_76_205)]', initials: 'ZD',
    appBundleName: 'Zed',
    defaultEditor: { command: 'zed' },
  },
  {
    id: 'trae', name: 'Trae IDE App', description: 'ByteDance AI-native code editor IDE (desktop application).',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(26_107_92)]', initials: 'TR',
    appBundleName: 'Trae',
    defaultEditor: { command: 'trae' },
  },
  {
    id: 'antigravity', name: 'Antigravity IDE App', description: 'Antigravity AI-native IDE (desktop application).',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(43_37_64)]', initials: 'AG',
    appBundleName: 'Antigravity',
    defaultEditor: { command: 'antigravity' },
  },
  {
    id: 'mcp-filesystem', name: 'Filesystem MCP Server', description: 'MCP server that reads and edits local files via the Model Context Protocol.',
    category: 'dev', kind: 'mcp', accentColor: 'bg-violet-700', initials: 'FS',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '{root}'] },
  },
  {
    id: 'mcp-chrome', name: 'Chrome MCP Server', description: 'MCP server that drives a Chrome browser so the AI can navigate, click, and read pages.',
    category: 'dev', kind: 'mcp', accentColor: 'bg-[rgb(66_133_244)]', initials: 'CM',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', 'chrome-mcp-server'] },
  },
  {
    id: 'mcp-slack', name: 'Slack MCP Server', description: 'MCP server that posts messages and reads channels via the Slack MCP integration.',
    category: 'notify', kind: 'mcp', accentColor: 'bg-[rgb(74_21_75)]', initials: 'SM',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], env: { SLACK_BOT_TOKEN: '' } },
  },
  {
    id: 'github', name: 'GitHub CLI', description: 'GitHub CLI (`gh`) — sync pull requests and issues to your projects. (Not GitHub Desktop.)',
    category: 'vcs', kind: 'cli', accentColor: 'bg-stone-700', initials: 'GH',
    defaultCli: { command: 'gh', argsTemplate: [] },
  },
  {
    id: 'linear', name: 'Linear CLI', description: 'Linear CLI — pull issues and cycles into Project Manager features. (Not the Linear Desktop/Web app.)',
    category: 'pm', kind: 'cli', accentColor: 'bg-[rgb(94_106_210)]', initials: 'LN',
    defaultCli: { command: 'linear', argsTemplate: [] },
  },
  {
    id: 'slack', name: 'Slack CLI', description: 'Slack CLI launcher (legacy — prefer the Slack MCP entry).',
    category: 'notify', kind: 'cli', accentColor: 'bg-[rgb(74_21_75)]', initials: 'SL',
    defaultCli: { command: 'slack', argsTemplate: [] },
  },
  {
    id: 'sentry', name: 'Sentry CLI', description: 'Sentry CLI — import recent errors as engineering tasks. (Not the Sentry web dashboard.)',
    category: 'ci', kind: 'cli', accentColor: 'bg-[rgb(251_66_38)]', initials: 'SE',
    defaultCli: { command: 'sentry', argsTemplate: [] },
  },
];

export function buildFromMarketplace(mp: MarketplacePlugin): AnyPlugin | null {
  const base = { id: mp.id, name: mp.name, enabled: true, installedAt: new Date().toISOString() };
  if (mp.kind === 'provider' && mp.defaultProvider) {
    return { ...base, kind: 'provider', ...mp.defaultProvider };
  }
  if (mp.kind === 'cli' && mp.defaultCli) {
    return { ...base, kind: 'cli', ...mp.defaultCli };
  }
  if (mp.kind === 'editor' && mp.defaultEditor) {
    return { ...base, kind: 'editor', ...mp.defaultEditor };
  }
  if (mp.kind === 'mcp' && mp.defaultMcp) {
    return { ...base, kind: 'mcp', ...mp.defaultMcp };
  }
  if (mp.kind === 'frontend' && mp.defaultFrontend) {
    return { ...base, kind: 'frontend', ...mp.defaultFrontend };
  }
  return null;
}
