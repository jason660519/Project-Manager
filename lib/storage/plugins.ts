import type {
  AnyPlugin,
  CliPlugin,
  EditorPlugin,
  FrontendPlugin,
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

// AI providers are owned by the Keys view (`lib/keys/*`). The plugin catalog
// no longer seeds them so they stay out of the Plugins hub.
const DEFAULT_PROVIDERS: ProviderPlugin[] = [];

const DEFAULT_CLIS: CliPlugin[] = [
  {
    id: 'claude-code',
    kind: 'cli',
    name: 'Claude Code CLI',
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
    name: 'Hermes Agent CLI',
    enabled: false,
    installedAt: BUILT_IN_INSTALL_DATE,
    command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/hermes',
    argsTemplate: ['chat', '-q', '{prompt}'],
  },
  {
    id: 'openclaw',
    kind: 'cli',
    name: 'OpenClaw CLI',
    enabled: false,
    installedAt: BUILT_IN_INSTALL_DATE,
    command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/openclaw',
    argsTemplate: ['agent', '--message', '{prompt}'],
  },
];

const DEFAULT_EDITORS: EditorPlugin[] = [
  { id: 'cursor', kind: 'editor', name: 'Cursor IDE App', enabled: true, installedAt: BUILT_IN_INSTALL_DATE, command: 'cursor' },
  { id: 'vscode', kind: 'editor', name: 'VS Code IDE App', enabled: true, installedAt: BUILT_IN_INSTALL_DATE, command: 'code' },
  { id: 'trae', kind: 'editor', name: 'Trae IDE App', enabled: true, installedAt: BUILT_IN_INSTALL_DATE, command: 'trae' },
  { id: 'antigravity', kind: 'editor', name: 'Antigravity IDE App', enabled: true, installedAt: BUILT_IN_INSTALL_DATE, command: 'antigravity' },
];

const DEFAULT_FRONTEND: FrontendPlugin[] = [
  {
    id: 'monaco-editor',
    kind: 'frontend',
    name: 'Monaco Editor Workbench',
    enabled: true,
    installedAt: BUILT_IN_INSTALL_DATE,
    packageName: '@monaco-editor/react',
    implementationPath: 'app/ui/views/MonacoEditorWorkbench.tsx',
  },
];

const DEFAULT_CATALOG: PluginCatalog = {
  schemaVersion: 2,
  plugins: [...DEFAULT_PROVIDERS, ...DEFAULT_CLIS, ...DEFAULT_EDITORS, ...DEFAULT_FRONTEND],
};
const REQUIRED_BUILTIN_PLUGINS: AnyPlugin[] = [...DEFAULT_FRONTEND];

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

// Built-in CLI plugin id → legacy names that should be auto-renamed to today's
// canonical CLI-suffixed names. Only matches when the persisted name is one of
// the legacy literals, so user-customized names are left untouched.
const BUILTIN_NAME_UPGRADES: Record<string, { from: string[]; to: string }> = {
  'claude-code': { from: ['Claude Code'], to: 'Claude Code CLI' },
  'hermes-agent': { from: ['Hermes Agent'], to: 'Hermes Agent CLI' },
  openclaw: { from: ['OpenClaw'], to: 'OpenClaw CLI' },
};

function upgradeBuiltinNames(catalog: PluginCatalog): {
  catalog: PluginCatalog;
  changed: boolean;
} {
  let changed = false;
  const plugins = catalog.plugins.map((p) => {
    const rule = BUILTIN_NAME_UPGRADES[p.id];
    if (rule && rule.from.includes(p.name) && p.name !== rule.to) {
      changed = true;
      return { ...p, name: rule.to };
    }
    return p;
  });
  return changed ? { catalog: { ...catalog, plugins }, changed } : { catalog, changed };
}

function ensureRequiredBuiltins(catalog: PluginCatalog): {
  catalog: PluginCatalog;
  changed: boolean;
} {
  const existingIds = new Set(catalog.plugins.map((plugin) => plugin.id));
  const missing = REQUIRED_BUILTIN_PLUGINS.filter((plugin) => !existingIds.has(plugin.id));
  if (missing.length === 0) return { catalog, changed: false };
  return {
    catalog: { ...catalog, plugins: [...catalog.plugins, ...missing] },
    changed: true,
  };
}

export function loadPluginCatalog(): PluginCatalog {
  const raw = readJSON<unknown>(KEY_SHARED_PLUGINS);
  if (!raw) return DEFAULT_CATALOG;

  if (isV2(raw)) {
    const upgrade = upgradeBuiltinNames({ schemaVersion: 2, plugins: raw.plugins });
    const required = ensureRequiredBuiltins(upgrade.catalog);
    if (upgrade.changed || required.changed) writeJSON(KEY_SHARED_PLUGINS, required.catalog);
    return required.catalog;
  }

  if (isV1(raw)) {
    const migrated = migrateV1toV2(raw);
    const upgrade = upgradeBuiltinNames(migrated);
    const required = ensureRequiredBuiltins(upgrade.catalog);
    writeJSON(KEY_SHARED_PLUGINS, required.catalog);
    return required.catalog;
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

export const selectFrontend = (c: PluginCatalog): FrontendPlugin[] =>
  c.plugins.filter((p): p is FrontendPlugin => p.kind === 'frontend');

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
