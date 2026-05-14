import type { AgentPluginEntry, IdePluginEntry, PluginCatalog, ProviderEntry } from '../types/plugins';
import { getSecret, setSecret } from '../bridge';
import { KEY_SHARED_PLUGINS } from './keys';

// API keys live in the OS Keychain under Tauri (ADR-004 — keys must never sit
// in the renderer's localStorage). In `next dev` mode there is no Tauri runtime
// so we fall back to localStorage purely so the UI can be exercised in a browser;
// shipped builds always use the keychain path.
const SECRET_SERVICE = 'devpilot';
const SECRET_KEY_PREFIX = 'apikey-';
const LS_KEY_PREFIX = 'devpilot.personal.apikey.';

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

const DEFAULT_PROVIDERS: ProviderEntry[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3',
    models: ['llama3', 'llama3:70b', 'mistral', 'codellama'],
  },
];

const DEFAULT_AGENTS: AgentPluginEntry[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    command: 'claude',
    argsTemplate: ['--cwd', '{root}', '{prompt}'],
    providerId: 'anthropic',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'],
    providerId: 'openai',
  },
];

const DEFAULT_IDES: IdePluginEntry[] = [
  { id: 'cursor', name: 'Cursor', command: 'cursor' },
  { id: 'vscode', name: 'VS Code', command: 'code' },
  { id: 'trae', name: 'Trae', command: 'trae' },
  { id: 'antigravity', name: 'Antigravity', command: 'antigravity' },
];

const DEFAULT_CATALOG: PluginCatalog = {
  providers: DEFAULT_PROVIDERS,
  agents: DEFAULT_AGENTS,
  ides: DEFAULT_IDES,
};

export function loadPluginCatalog(): PluginCatalog {
  const raw = readJSON<PluginCatalog>(KEY_SHARED_PLUGINS);
  if (!raw) return DEFAULT_CATALOG;
  return {
    providers: Array.isArray(raw.providers) ? raw.providers : DEFAULT_CATALOG.providers,
    agents: Array.isArray(raw.agents) ? raw.agents : DEFAULT_CATALOG.agents,
    ides: Array.isArray(raw.ides) ? raw.ides : DEFAULT_CATALOG.ides,
  };
}

export function savePluginCatalog(catalog: PluginCatalog): void {
  writeJSON(KEY_SHARED_PLUGINS, catalog);
}

// Provider API keys — stored in the OS Keychain via the Rust bridge when
// running inside Tauri, with a localStorage fallback for `next dev` only.

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
    // setSecret with an empty string effectively clears the entry server-side.
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

export async function loadAllApiKeys(providers: ProviderEntry[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    providers.map(async (p) => [p.id, await getProviderApiKey(p.id)] as const),
  );
  return Object.fromEntries(entries);
}
