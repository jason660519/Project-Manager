/**
 * Static enrichment for integration inventory rows (company, license, scope hints).
 * Auto-detected fields from catalog/runtime still override at mapper time when fresher.
 */

export interface IntegrationRegistryEntry {
  company?: string;
  category1?: string;
  category2?: string;
  license?: string;
  scope?: 'user' | 'project' | 'network' | 'intranet';
  port?: string;
  installPathHint?: string;
  githubUrl?: string;
}

export const INTEGRATION_REGISTRY: Record<string, IntegrationRegistryEntry> = {
  anthropic: { company: 'Anthropic', category1: 'AI Provider', category2: 'API', license: 'Commercial', scope: 'project', installPathHint: '.env' },
  openai: { company: 'OpenAI', category1: 'AI Provider', category2: 'API', license: 'Commercial', scope: 'project', installPathHint: '.env' },
  google: { company: 'Google', category1: 'AI Provider', category2: 'API', license: 'Commercial', scope: 'project', installPathHint: '.env' },
  ollama: { company: 'Ollama', category1: 'AI Provider', category2: 'Local', license: 'MIT', scope: 'user', port: '11434', installPathHint: 'http://localhost:11434' },

  'claude-code': { company: 'Anthropic', category1: 'Coding Editor/Orchestrator', category2: 'CLI', scope: 'user' },
  codex: { company: 'OpenAI', category1: 'Coding Editor/Orchestrator', category2: 'CLI', scope: 'user' },
  'hermes-agent': {
    company: 'Nous Research',
    category1: 'Coding Editor/Orchestrator',
    category2: 'Agent CLI',
    license: 'MIT',
    scope: 'project',
    port: '9119',
    installPathHint: '.project-manager/bin/hermes',
  },
  openclaw: {
    company: 'OpenAI',
    category1: 'Coding Editor/Orchestrator',
    category2: 'Gateway',
    license: 'MIT',
    scope: 'project',
    port: '18789',
    installPathHint: '.project-manager/bin/openclaw',
  },
  aider: { company: 'Aider', category1: 'Coding Editor/Orchestrator', category2: 'CLI', scope: 'user' },
  cursor: { company: 'Cursor', category1: 'Coding Editor/Orchestrator', category2: 'Desktop App', scope: 'user' },
  vscode: { company: 'Microsoft', category1: 'Coding Editor/Orchestrator', category2: 'Desktop App', scope: 'user' },
  zed: { company: 'Zed', category1: 'Coding Editor/Orchestrator', category2: 'Desktop App', scope: 'user' },
  trae: { company: 'ByteDance', category1: 'Coding Editor/Orchestrator', category2: 'Desktop App', scope: 'user' },
  antigravity: { company: 'Google', category1: 'Coding Editor/Orchestrator', category2: 'Desktop App', scope: 'user' },

  'mcp-filesystem': { company: 'MCP', category1: 'MCP Server', category2: 'Filesystem', scope: 'project' },
  'mcp-chrome': { company: 'MCP', category1: 'MCP Server', category2: 'Browser', scope: 'project' },
  'mcp-slack': { company: 'Slack', category1: 'MCP Server', category2: 'Notify', scope: 'project' },

  github: { company: 'GitHub', category1: 'Version Control', githubUrl: 'https://git-scm.com/docs/gitcli' },
  linear: { company: 'Linear', category1: 'Project Mgmt' },
  slack: { company: 'Slack', category1: 'Notifications' },
  sentry: { company: 'Sentry', category1: 'Monitoring' },
};

export function registryFor(id: string): IntegrationRegistryEntry {
  return INTEGRATION_REGISTRY[id] ?? {};
}
