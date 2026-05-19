import {
  AdapterDescriptor,
  AgentAppAdapterConfig,
  AgentAdapterConfig,
  AnyAdapterConfig,
  ExecutionTargetKind,
  IDEAdapterConfig,
  ProjectManagerConfig,
  RuntimeAdapter,
} from '../types';
import { AgentAdapter } from './agent-adapter';
import { LocalAppAdapter } from './local-app-adapter';
import { LocalIDEAdapter } from './local-ide-adapter';
import { loadPluginCatalog, selectCli } from '../storage/plugins';

const PLUGIN_AGENT_IDS = new Set(['hermes-agent', 'openclaw']);

const BUILT_IN_IDES: IDEAdapterConfig[] = [
  { id: 'Trae', name: 'TRAE IDE', type: 'ide', targetKind: 'ide', command: 'trae' },
  { id: 'Cursor', name: 'Cursor IDE', type: 'ide', targetKind: 'ide', command: 'cursor' },
  { id: 'VSCode', name: 'VS Code', type: 'ide', targetKind: 'ide', command: 'code' },
  { id: 'Antigravity', name: 'Antigravity IDE', type: 'ide', targetKind: 'ide', command: 'antigravity' },
  { id: 'Kiro', name: 'AWS Kiro', type: 'ide', targetKind: 'ide', command: 'kiro' },
];

const BUILT_IN_AGENT_CLIS: AgentAdapterConfig[] = [
  {
    id: 'codex',
    name: 'Codex CLI',
    type: 'agent',
    targetKind: 'agent-cli',
    command: 'codex',
    argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'],
  },
  {
    id: 'claude-code',
    name: 'Claude Code CLI',
    type: 'agent',
    targetKind: 'agent-cli',
    command: 'claude',
    argsTemplate: ['--cwd', '{root}', '{prompt}'],
  },
  {
    id: 'openai-cli',
    name: 'OpenAI CLI',
    type: 'agent',
    targetKind: 'agent-cli',
    command: 'openai',
    argsTemplate: ['api', 'responses.create', '-m', '{prompt}'],
  },
  {
    id: 'cmux',
    name: 'Cmux CLI',
    type: 'agent',
    targetKind: 'agent-cli',
    command: 'cmux',
    argsTemplate: ['run', '--cwd', '{root}', '{prompt}'],
  },
];

const BUILT_IN_AGENT_APPS: AgentAppAdapterConfig[] = [
  {
    id: 'codex-app',
    name: 'Codex App',
    type: 'app',
    targetKind: 'agent-app',
    command: 'open',
    argsTemplate: ['-a', 'Codex'],
  },
  {
    id: 'anthropic-app',
    name: 'Anthropic App',
    type: 'app',
    targetKind: 'agent-app',
    command: 'open',
    argsTemplate: ['-a', 'Claude'],
  },
];

function mergeBuiltIns<T extends AnyAdapterConfig>(builtIns: T[], configured: T[] = []): T[] {
  const byId = new Map(configured.map((adapter) => [adapter.id, adapter]));
  const merged = builtIns.map((builtIn) => {
    const configuredAdapter = byId.get(builtIn.id);
    if (!configuredAdapter) return builtIn;
    return {
      ...builtIn,
      command: configuredAdapter.command,
      ...(configuredAdapter.type !== 'ide' && 'argsTemplate' in configuredAdapter
        ? { argsTemplate: configuredAdapter.argsTemplate }
        : {}),
    } as T;
  });
  const builtInIds = new Set(builtIns.map((adapter) => adapter.id));
  return [
    ...merged,
    ...configured.filter((adapter) => !builtInIds.has(adapter.id)),
  ];
}

function listEnabledPluginAgents(config: ProjectManagerConfig): AgentAdapterConfig[] {
  if (typeof window === 'undefined') return [];
  const existingIds = new Set([
    ...config.adapters.ides.map((adapter) => adapter.id),
    ...config.adapters.agents.map((adapter) => adapter.id),
    ...(config.adapters.apps ?? []).map((adapter) => adapter.id),
  ]);
  return selectCli(loadPluginCatalog())
    .filter((plugin) => PLUGIN_AGENT_IDS.has(plugin.id) && plugin.enabled && !existingIds.has(plugin.id))
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      type: 'agent',
      targetKind: 'agent-cli',
      command: plugin.command,
      argsTemplate: plugin.argsTemplate,
    }));
}

export function listAdapterDescriptors(config: ProjectManagerConfig): AdapterDescriptor[] {
  return listAdapters(config).map(({ id, name, type, targetKind }) => ({
    id,
    name,
    type,
    targetKind,
  }));
}

export function listAdapters(config: ProjectManagerConfig): AnyAdapterConfig[] {
  const ides = mergeBuiltIns(BUILT_IN_IDES, config.adapters.ides ?? []);
  const agents = mergeBuiltIns(BUILT_IN_AGENT_CLIS, config.adapters.agents ?? []);
  const apps = mergeBuiltIns(BUILT_IN_AGENT_APPS, config.adapters.apps ?? []);
  return [...ides, ...agents, ...apps, ...listEnabledPluginAgents(config)];
}

export function getAdapterExecutionKind(adapter: AnyAdapterConfig | undefined): ExecutionTargetKind | undefined {
  if (!adapter) return undefined;
  if (adapter.targetKind) return adapter.targetKind;
  if (adapter.type === 'ide') return 'ide';
  if (adapter.type === 'app') return 'agent-app';
  return 'agent-cli';
}

export function createRuntimeAdapterFromConfig(adapter: AnyAdapterConfig): RuntimeAdapter {
  if (adapter.type === 'ide') return new LocalIDEAdapter(adapter);
  if (adapter.type === 'app') return new LocalAppAdapter(adapter);
  return new AgentAdapter(adapter);
}

export function createRuntimeAdapter(
  config: ProjectManagerConfig,
  adapterId: string,
): RuntimeAdapter | null {
  const adapter = listAdapters(config).find((candidate) => candidate.id === adapterId);
  return adapter ? createRuntimeAdapterFromConfig(adapter) : null;
}
