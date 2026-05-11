import {
  AdapterDescriptor,
  AnyAdapterConfig,
  DevPilotConfig,
  RuntimeAdapter,
} from '../types';
import { AgentAdapter } from './agent-adapter';
import { LocalIDEAdapter } from './local-ide-adapter';

export function listAdapterDescriptors(config: DevPilotConfig): AdapterDescriptor[] {
  return [...config.adapters.ides, ...config.adapters.agents].map(({ id, name, type }) => ({
    id,
    name,
    type,
  }));
}

export function listAdapters(config: DevPilotConfig): AnyAdapterConfig[] {
  return [...config.adapters.ides, ...config.adapters.agents];
}

export function createRuntimeAdapter(
  config: DevPilotConfig,
  adapterId: string,
): RuntimeAdapter | null {
  const ide = config.adapters.ides.find((adapter) => adapter.id === adapterId);
  if (ide) {
    return new LocalIDEAdapter(ide);
  }

  const agent = config.adapters.agents.find((adapter) => adapter.id === adapterId);
  if (agent) {
    return new AgentAdapter(agent);
  }

  return null;
}
