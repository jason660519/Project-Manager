import {
  AdapterDescriptor,
  AgentAdapterConfig,
  AnyAdapterConfig,
  ProjectManagerConfig,
  RuntimeAdapter,
} from '../types';
import { AgentAdapter } from './agent-adapter';
import { LocalIDEAdapter } from './local-ide-adapter';
import { loadPluginCatalog, selectCli } from '../storage/plugins';

const PLUGIN_AGENT_IDS = new Set(['hermes-agent', 'openclaw']);

function listEnabledPluginAgents(config: ProjectManagerConfig): AgentAdapterConfig[] {
  if (typeof window === 'undefined') return [];
  const existingIds = new Set([
    ...config.adapters.ides.map((adapter) => adapter.id),
    ...config.adapters.agents.map((adapter) => adapter.id),
  ]);
  return selectCli(loadPluginCatalog())
    .filter((plugin) => PLUGIN_AGENT_IDS.has(plugin.id) && plugin.enabled && !existingIds.has(plugin.id))
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      type: 'agent',
      command: plugin.command,
      argsTemplate: plugin.argsTemplate,
    }));
}

export function listAdapterDescriptors(config: ProjectManagerConfig): AdapterDescriptor[] {
  return listAdapters(config).map(({ id, name, type }) => ({
    id,
    name,
    type,
  }));
}

export function listAdapters(config: ProjectManagerConfig): AnyAdapterConfig[] {
  return [...config.adapters.ides, ...config.adapters.agents, ...listEnabledPluginAgents(config)];
}

export function createRuntimeAdapterFromConfig(adapter: AnyAdapterConfig): RuntimeAdapter {
  if (adapter.type === 'ide') return new LocalIDEAdapter(adapter);
  return new AgentAdapter(adapter);
}

export function createRuntimeAdapter(
  config: ProjectManagerConfig,
  adapterId: string,
): RuntimeAdapter | null {
  const adapter = listAdapters(config).find((candidate) => candidate.id === adapterId);
  return adapter ? createRuntimeAdapterFromConfig(adapter) : null;
}
