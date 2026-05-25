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
  runtime?: IntegrationRuntimeMetadata;
}

export interface IntegrationRuntimeCommand {
  id: string;
  label: string;
  command: string;
  args: string[];
  description: string;
}

export interface IntegrationRuntimeMetadata {
  dashboardUrl?: string;
  sourcePath?: string;
  statePath?: string;
  logPath?: string;
  docsPath?: string;
  commands?: IntegrationRuntimeCommand[];
}

export const INTEGRATION_REGISTRY: Record<string, IntegrationRegistryEntry> = {
  // AI provider rows (anthropic, openai, google, ollama) intentionally omitted —
  // those are surfaced from the Keys view, not the Plugins hub.

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
    runtime: {
      dashboardUrl: 'http://127.0.0.1:9119',
      sourcePath: '.project-manager/vendor/hermes-agent',
      statePath: '.project-manager/hermes',
      logPath: '.project-manager/dev-logs/hermes-dashboard.log',
      docsPath: 'docs/engineering/hermes-agent-plugin.md',
      commands: [
        {
          id: 'start-dashboard',
          label: 'Start dashboard',
          command: './start_project_manager.sh',
          args: ['hermes'],
          description: 'Start the project-scoped Hermes dashboard and open the local page.',
        },
        {
          id: 'doctor',
          label: 'Run doctor',
          command: 'npm',
          args: ['run', 'hermes:doctor'],
          description: 'Check project-scoped Hermes installation, credentials, tools, and profiles.',
        },
        {
          id: 'install',
          label: 'Install',
          command: 'npm',
          args: ['run', 'hermes:install'],
          description: 'Clone or refresh the local checkout, virtualenv, wrapper, and runtime home.',
        },
        {
          id: 'update',
          label: 'Update',
          command: 'npm',
          args: ['run', 'hermes:update'],
          description: 'Update the Hermes source checkout and reinstall the project wrapper.',
        },
        {
          id: 'rollback',
          label: 'Rollback',
          command: 'npm',
          args: ['run', 'hermes:rollback'],
          description: 'Roll back Hermes to the previous recorded source ref when available.',
        },
      ],
    },
  },
  openclaw: {
    company: 'OpenAI',
    category1: 'Coding Editor/Orchestrator',
    category2: 'Agent CLI',
    license: 'MIT',
    scope: 'project',
    port: '18790',
    installPathHint: '.project-manager/bin/openclaw',
    runtime: {
      dashboardUrl: 'http://127.0.0.1:18790/',
      sourcePath: '.project-manager/vendor/openclaw',
      statePath: '.project-manager/openclaw/state',
      logPath: '.project-manager/dev-logs/openclaw-gateway.log',
      docsPath: 'docs/engineering/openclaw-plugin.md',
      commands: [
        {
          id: 'start-gateway',
          label: 'Start gateway',
          command: './start_project_manager.sh',
          args: ['openclaw'],
          description: 'Start the project-scoped OpenClaw gateway, prepare the dashboard URL, and approve local pairings.',
        },
        {
          id: 'doctor',
          label: 'Run doctor',
          command: 'npm',
          args: ['run', 'openclaw:doctor'],
          description: 'Check OpenClaw config, gateway, state, plugins, skills, and security warnings.',
        },
        {
          id: 'install',
          label: 'Install',
          command: 'npm',
          args: ['run', 'openclaw:install'],
          description: 'Clone or refresh OpenClaw, build the control UI, and regenerate project-scoped state.',
        },
        {
          id: 'update',
          label: 'Update',
          command: 'npm',
          args: ['run', 'openclaw:update'],
          description: 'Update OpenClaw to the upstream default branch or configured ref.',
        },
        {
          id: 'rollback',
          label: 'Rollback',
          command: 'npm',
          args: ['run', 'openclaw:rollback'],
          description: 'Roll back OpenClaw to the previous recorded source ref when available.',
        },
      ],
    },
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
