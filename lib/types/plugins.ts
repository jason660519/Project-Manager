// Plugin catalog v2 — single discriminated-union list keyed by `kind`.
// The v1 shape (three parallel arrays: providers / agents / ides) is migrated
// once on read by `loadPluginCatalog` and persisted in v2 form thereafter.

export type PluginKind = 'provider' | 'cli' | 'editor' | 'mcp' | 'skill';

interface BasePlugin {
  id: string;
  name: string;
  kind: PluginKind;
  enabled: boolean;
  installedAt: string;
}

export interface ProviderPlugin extends BasePlugin {
  kind: 'provider';
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

export interface CliPlugin extends BasePlugin {
  kind: 'cli';
  command: string;
  argsTemplate: string[];
  providerId?: string;
}

export interface EditorPlugin extends BasePlugin {
  kind: 'editor';
  command: string;
}

export type McpTransport = 'stdio' | 'http';

export interface McpPlugin extends BasePlugin {
  kind: 'mcp';
  transport: McpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  autoStart?: boolean;
}

export type SkillSource = 'skillsmp' | 'local' | 'url';

export interface SkillPlugin extends BasePlugin {
  kind: 'skill';
  source: SkillSource;
  sourceUrl?: string;
  installedPath: string;
  version?: string;
}

export type AnyPlugin =
  | ProviderPlugin
  | CliPlugin
  | EditorPlugin
  | McpPlugin
  | SkillPlugin;

export interface PluginCatalog {
  schemaVersion: 2;
  plugins: AnyPlugin[];
}

// ── Legacy v1 shape (kept for one-shot migration) ────────────────────────────

export interface ProviderEntryV1 {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  enabled?: boolean;
}

export interface AgentPluginEntryV1 {
  id: string;
  name: string;
  command: string;
  argsTemplate: string[];
  providerId?: string;
  enabled?: boolean;
}

export interface IdePluginEntryV1 {
  id: string;
  name: string;
  command: string;
  enabled?: boolean;
}

export interface PluginCatalogV1 {
  providers?: ProviderEntryV1[];
  agents?: AgentPluginEntryV1[];
  ides?: IdePluginEntryV1[];
}
