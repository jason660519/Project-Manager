export interface ProviderEntry {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  enabled?: boolean;
}

export interface AgentPluginEntry {
  id: string;
  name: string;
  command: string;
  argsTemplate: string[];
  providerId?: string;
  enabled?: boolean;
}

export interface IdePluginEntry {
  id: string;
  name: string;
  command: string;
  enabled?: boolean;
}

export interface PluginCatalog {
  providers: ProviderEntry[];
  agents: AgentPluginEntry[];
  ides: IdePluginEntry[];
}
