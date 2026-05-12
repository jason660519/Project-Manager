export interface ProviderEntry {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

export interface AgentPluginEntry {
  id: string;
  name: string;
  command: string;
  argsTemplate: string[];
  providerId?: string;
}

export interface IdePluginEntry {
  id: string;
  name: string;
  command: string;
}

export interface PluginCatalog {
  providers: ProviderEntry[];
  agents: AgentPluginEntry[];
  ides: IdePluginEntry[];
}
