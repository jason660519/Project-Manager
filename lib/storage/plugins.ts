import type {
  AnyPlugin,
  CliPlugin,
  EditorPlugin,
  McpPlugin,
  PluginCatalog,
  PluginCatalogV1,
  ProviderPlugin,
  SkillPlugin,
} from '../types/plugins';
import type { McpServerConfig } from '../bridge';
import { getSecret, setSecret } from '../bridge';
import { KEY_SHARED_PLUGINS } from './keys';

// API keys live in the OS Keychain under Tauri (ADR-004 — keys must never sit
// in the renderer's localStorage). In `next dev` mode there is no Tauri runtime
// so we fall back to localStorage purely so the UI can be exercised in a browser;
// shipped builds always use the keychain path.
const SECRET_SERVICE = 'projectmanager';
const SECRET_KEY_PREFIX = 'apikey-';
const LS_KEY_PREFIX = 'projectManager.personal.apikey.';

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled */
  }
}

// Sentinel install date for built-in defaults that ship with the app.
const BUILT_IN_INSTALL_DATE = '1970-01-01T00:00:00.000Z';
const nowIso = () => new Date().toISOString();

const DEFAULT_PROVIDERS: ProviderPlugin[] = [
  {
    id: 'anthropic',
    kind: 'provider',
    name: 'Anthropic',
    enabled: true,
    installedAt: BUILT_IN_INSTALL_DATE,
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    kind: 'provider',
    name: 'OpenAI',
    enabled: true,
    installedAt: BUILT_IN_INSTALL_DATE,
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  },
  {
    id: 'google',
    kind: 'provider',
    name: 'Google Gemini',
    enabled: true,
    installedAt: BUILT_IN_INSTALL_DATE,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'ollama',
    kind: 'provider',
    name: 'Ollama',
    enabled: true,
    installedAt: BUILT_IN_INSTALL_DATE,
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3',
    models: ['llama3', 'llama3:70b', 'mistral', 'codellama'],
  },
];

const DEFAULT_CLIS: CliPlugin[] = [
  {
    id: 'claude-code',
    kind: 'cli',
    name: 'Claude Code',
    enabled: true,
    installedAt: BUILT_IN_INSTALL_DATE,
    command: 'claude',
    argsTemplate: ['--cwd', '{root}', '{prompt}'],
    providerId: 'anthropic',
  },
  {
    id: 'codex',
    kind: 'cli',
    name: 'Codex CLI',
    enabled: true,
    installedAt: BUILT_IN_INSTALL_DATE,
    command: 'codex',
    argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'],
    providerId: 'openai',
  },
  {
    id: 'hermes-agent',
    kind: 'cli',
    name: 'Hermes Agent',
    enabled: false,
    installedAt: BUILT_IN_INSTALL_DATE,
    command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/hermes',
    argsTemplate: ['chat', '-q', '{prompt}'],
  },
  {
    id: 'openclaw',
    kind: 'cli',
    name: 'OpenClaw',
    enabled: false,
    installedAt: BUILT_IN_INSTALL_DATE,
    command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/openclaw',
    argsTemplate: ['agent', '--message', '{prompt}'],
  },
];

const DEFAULT_EDITORS: EditorPlugin[] = [
  { id: 'cursor', kind: 'editor', name: 'Cursor', enabled: true, installedAt: BUILT_IN_INSTALL_DATE, command: 'cursor' },
  { id: 'vscode', kind: 'editor', name: 'VS Code', enabled: true, installedAt: BUILT_IN_INSTALL_DATE, command: 'code' },
  { id: 'trae', kind: 'editor', name: 'Trae', enabled: true, installedAt: BUILT_IN_INSTALL_DATE, command: 'trae' },
  { id: 'antigravity', kind: 'editor', name: 'Antigravity', enabled: true, installedAt: BUILT_IN_INSTALL_DATE, command: 'antigravity' },
];

const DEFAULT_CATALOG: PluginCatalog = {
  schemaVersion: 2,
  plugins: [...DEFAULT_PROVIDERS, ...DEFAULT_CLIS, ...DEFAULT_EDITORS],
};

// One-shot migration from the v1 three-array layout to the v2 union.
function migrateV1toV2(v1: PluginCatalogV1): PluginCatalog {
  const stamp = nowIso();
  const providers: ProviderPlugin[] = (v1.providers ?? []).map((p) => ({
    id: p.id,
    kind: 'provider',
    name: p.name,
    enabled: p.enabled ?? true,
    installedAt: stamp,
    baseUrl: p.baseUrl,
    defaultModel: p.defaultModel,
    models: p.models,
  }));
  const cli: CliPlugin[] = (v1.agents ?? []).map((a) => ({
    id: a.id,
    kind: 'cli',
    name: a.name,
    enabled: a.enabled ?? true,
    installedAt: stamp,
    command: a.command,
    argsTemplate: a.argsTemplate,
    providerId: a.providerId,
  }));
  const editors: EditorPlugin[] = (v1.ides ?? []).map((i) => ({
    id: i.id,
    kind: 'editor',
    name: i.name,
    enabled: i.enabled ?? true,
    installedAt: stamp,
    command: i.command,
  }));
  return { schemaVersion: 2, plugins: [...providers, ...cli, ...editors] };
}

function isV2(raw: unknown): raw is PluginCatalog {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return r.schemaVersion === 2 && Array.isArray(r.plugins);
}

function isV1(raw: unknown): raw is PluginCatalogV1 {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return Array.isArray(r.providers) || Array.isArray(r.agents) || Array.isArray(r.ides);
}

export function loadPluginCatalog(): PluginCatalog {
  const raw = readJSON<unknown>(KEY_SHARED_PLUGINS);
  if (!raw) return DEFAULT_CATALOG;

  if (isV2(raw)) {
    return { schemaVersion: 2, plugins: raw.plugins };
  }

  if (isV1(raw)) {
    const migrated = migrateV1toV2(raw);
    writeJSON(KEY_SHARED_PLUGINS, migrated);
    return migrated;
  }

  return DEFAULT_CATALOG;
}

export function savePluginCatalog(catalog: PluginCatalog): void {
  writeJSON(KEY_SHARED_PLUGINS, catalog);
}

// ── Selectors ────────────────────────────────────────────────────────────────

export const selectProviders = (c: PluginCatalog): ProviderPlugin[] =>
  c.plugins.filter((p): p is ProviderPlugin => p.kind === 'provider');

export const selectCli = (c: PluginCatalog): CliPlugin[] =>
  c.plugins.filter((p): p is CliPlugin => p.kind === 'cli');

export const selectEditors = (c: PluginCatalog): EditorPlugin[] =>
  c.plugins.filter((p): p is EditorPlugin => p.kind === 'editor');

export const selectMcpServers = (c: PluginCatalog): McpPlugin[] =>
  c.plugins.filter((p): p is McpPlugin => p.kind === 'mcp');

export const selectSkills = (c: PluginCatalog): SkillPlugin[] =>
  c.plugins.filter((p): p is SkillPlugin => p.kind === 'skill');

// ── Updaters ─────────────────────────────────────────────────────────────────

export function addPlugin(catalog: PluginCatalog, plugin: AnyPlugin): PluginCatalog {
  return { ...catalog, plugins: [...catalog.plugins, plugin] };
}

export function removePlugin(catalog: PluginCatalog, id: string): PluginCatalog {
  return { ...catalog, plugins: catalog.plugins.filter((p) => p.id !== id) };
}

export function updatePlugin(
  catalog: PluginCatalog,
  id: string,
  updater: (plugin: AnyPlugin) => AnyPlugin,
): PluginCatalog {
  return {
    ...catalog,
    plugins: catalog.plugins.map((p) => (p.id === id ? updater(p) : p)),
  };
}

export function togglePluginEnabled(catalog: PluginCatalog, id: string): PluginCatalog {
  return updatePlugin(catalog, id, (p) => ({ ...p, enabled: !p.enabled }));
}

// ── Provider API keys (unchanged semantics) ──────────────────────────────────

export async function getProviderApiKey(providerId: string): Promise<string> {
  if (isTauri()) {
    try {
      const v = await getSecret(SECRET_SERVICE, `${SECRET_KEY_PREFIX}${providerId}`);
      return v ?? '';
    } catch {
      return '';
    }
  }
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(`${LS_KEY_PREFIX}${providerId}`) ?? '';
  } catch {
    return '';
  }
}

export async function setProviderApiKey(providerId: string, value: string): Promise<void> {
  if (isTauri()) {
    await setSecret(SECRET_SERVICE, `${SECRET_KEY_PREFIX}${providerId}`, value);
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(`${LS_KEY_PREFIX}${providerId}`, value);
    } else {
      window.localStorage.removeItem(`${LS_KEY_PREFIX}${providerId}`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Snapshot the catalog and pull out enabled stdio MCP servers, substituting
 * `{root}` in their args. Output matches the `mcpServers` shape PM writes to
 * the temp mcp_config.json that child CLIs consume.
 */
export function collectEnabledMcpServers(
  projectRoot: string,
): Record<string, McpServerConfig> {
  const catalog = loadPluginCatalog();
  const out: Record<string, McpServerConfig> = {};
  for (const m of selectMcpServers(catalog)) {
    if (!m.enabled || m.transport !== 'stdio' || !m.command) continue;
    out[m.id] = {
      command: m.command,
      args: (m.args ?? []).map((a) => a.replaceAll('{root}', projectRoot)),
      env: m.env,
    };
  }
  return out;
}

export async function loadAllApiKeys(providers: ProviderPlugin[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    providers.map(async (p) => [p.id, await getProviderApiKey(p.id)] as const),
  );
  return Object.fromEntries(entries);
}
