import type {
  AnyPlugin,
  CliPlugin,
  EditorPlugin,
  McpPlugin,
  ProviderPlugin,
} from '../types/plugins';

export type MarketplaceCategory = 'ai' | 'dev' | 'vcs' | 'pm' | 'ci' | 'notify';
export type MarketplaceKind = 'provider' | 'cli' | 'editor' | 'mcp';

type ProviderDefaults = Pick<ProviderPlugin, 'baseUrl' | 'defaultModel' | 'models'>;
type CliDefaults = Pick<CliPlugin, 'command' | 'argsTemplate' | 'providerId'>;
type EditorDefaults = Pick<EditorPlugin, 'command'>;
type McpDefaults = Pick<McpPlugin, 'transport' | 'command' | 'args' | 'env' | 'url' | 'headers'>;

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  kind: MarketplaceKind;
  accentColor: string;
  initials: string;
  defaultProvider?: ProviderDefaults;
  defaultCli?: CliDefaults;
  defaultEditor?: EditorDefaults;
  defaultMcp?: McpDefaults;
}

export const MARKETPLACE: MarketplacePlugin[] = [
  {
    id: 'anthropic', name: 'Anthropic', description: 'Access Claude models including Opus, Sonnet, and Haiku.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[rgb(196_122_58)]', initials: 'AN',
    defaultProvider: { baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6', models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
  },
  {
    id: 'openai', name: 'OpenAI', description: 'GPT-4o, o1, o3-mini and other OpenAI models.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[rgb(16_163_127)]', initials: 'OA',
    defaultProvider: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'] },
  },
  {
    id: 'google', name: 'Google Gemini', description: 'Gemini 2.5 Pro, Flash and Gemini 1.5 models.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[rgb(66_133_244)]', initials: 'GG',
    defaultProvider: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash', models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'] },
  },
  {
    id: 'ollama', name: 'Ollama', description: 'Run Llama, Mistral, and other models locally on your machine.',
    category: 'ai', kind: 'provider', accentColor: 'bg-stone-600', initials: 'OL',
    defaultProvider: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3', models: ['llama3', 'llama3:70b', 'mistral', 'codellama'] },
  },
  {
    id: 'claude-code', name: 'Claude Code', description: 'Agentic CLI for software engineering tasks.',
    category: 'dev', kind: 'cli', accentColor: 'bg-[rgb(196_122_58)]', initials: 'CC',
    defaultCli: { command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'], providerId: 'anthropic' },
  },
  {
    id: 'codex', name: 'Codex CLI', description: 'OpenAI Codex command-line agent for code tasks.',
    category: 'dev', kind: 'cli', accentColor: 'bg-[rgb(16_163_127)]', initials: 'CX',
    defaultCli: { command: 'codex', argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'], providerId: 'openai' },
  },
  {
    id: 'hermes-agent', name: 'Hermes Agent', description: 'Project-scoped Hermes CLI with isolated memory, sessions, skills, and dashboard state.',
    category: 'dev', kind: 'cli', accentColor: 'bg-amber-700', initials: 'HA',
    defaultCli: { command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/hermes', argsTemplate: ['chat', '-q', '{prompt}'] },
  },
  {
    id: 'openclaw', name: 'OpenClaw', description: 'Project-scoped OpenClaw gateway and agent CLI with isolated state, workspace, updates, and rollback.',
    category: 'dev', kind: 'cli', accentColor: 'bg-rose-700', initials: 'OC',
    defaultCli: { command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/openclaw', argsTemplate: ['agent', '--message', '{prompt}'] },
  },
  {
    id: 'aider', name: 'Aider', description: 'AI pair programmer that edits code in your terminal.',
    category: 'dev', kind: 'cli', accentColor: 'bg-violet-700', initials: 'AD',
    defaultCli: { command: 'aider', argsTemplate: ['--yes', '--message', '{prompt}'] },
  },
  {
    id: 'cursor', name: 'Cursor', description: 'AI-first code editor built on VS Code.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(107_108_246)]', initials: 'CR',
    defaultEditor: { command: 'cursor' },
  },
  {
    id: 'vscode', name: 'VS Code', description: 'Microsoft Visual Studio Code editor.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(0_122_204)]', initials: 'VS',
    defaultEditor: { command: 'code' },
  },
  {
    id: 'zed', name: 'Zed', description: 'High-performance multiplayer code editor.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(8_76_205)]', initials: 'ZD',
    defaultEditor: { command: 'zed' },
  },
  {
    id: 'trae', name: 'Trae', description: 'ByteDance AI-native code editor.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(26_107_92)]', initials: 'TR',
    defaultEditor: { command: 'trae' },
  },
  {
    id: 'antigravity', name: 'Antigravity', description: 'Antigravity AI-native IDE.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[rgb(43_37_64)]', initials: 'AG',
    defaultEditor: { command: 'antigravity' },
  },
  {
    id: 'mcp-filesystem', name: 'Filesystem MCP', description: 'Read and edit local files via the Model Context Protocol.',
    category: 'dev', kind: 'mcp', accentColor: 'bg-violet-700', initials: 'FS',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '{root}'] },
  },
  {
    id: 'mcp-chrome', name: 'Chrome MCP', description: 'Drive a Chrome browser so the AI can navigate, click, and read pages.',
    category: 'dev', kind: 'mcp', accentColor: 'bg-[rgb(66_133_244)]', initials: 'CM',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', 'chrome-mcp-server'] },
  },
  {
    id: 'mcp-slack', name: 'Slack MCP', description: 'Post messages and read channels via the Slack MCP server.',
    category: 'notify', kind: 'mcp', accentColor: 'bg-[rgb(74_21_75)]', initials: 'SM',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], env: { SLACK_BOT_TOKEN: '' } },
  },
  {
    id: 'github', name: 'GitHub', description: 'Sync pull requests and issues to your projects.',
    category: 'vcs', kind: 'cli', accentColor: 'bg-stone-700', initials: 'GH',
    defaultCli: { command: 'gh', argsTemplate: [] },
  },
  {
    id: 'linear', name: 'Linear', description: 'Pull issues and cycles into Project Manager features.',
    category: 'pm', kind: 'cli', accentColor: 'bg-[rgb(94_106_210)]', initials: 'LN',
    defaultCli: { command: 'linear', argsTemplate: [] },
  },
  {
    id: 'slack', name: 'Slack (CLI)', description: 'Slack CLI launcher (legacy — prefer the Slack MCP entry).',
    category: 'notify', kind: 'cli', accentColor: 'bg-[rgb(74_21_75)]', initials: 'SL',
    defaultCli: { command: 'slack', argsTemplate: [] },
  },
  {
    id: 'sentry', name: 'Sentry', description: 'Import recent errors as engineering tasks.',
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
  return null;
}
