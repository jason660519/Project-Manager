/**
 * Provider registry — single source of truth for every external credential PM
 * knows how to handle. Adding a new provider is one entry here; the KeysView,
 * .env import flow, and OAuth flow all read from this list.
 */

export type AuthMethod = 'apiKey' | 'oauth' | 'envImport';
export type ProviderCategory = 'ai' | 'integration';

export interface OAuthDeviceFlowConfig {
  /** OAuth provider identifier, currently only 'github' is implemented. */
  provider: 'github';
  /** Scopes requested in the device-code call. */
  scopes: string[];
}

export interface ProviderSpec {
  id: string;
  label: string;
  category: ProviderCategory;
  placeholder: string;
  keychainKey: string;
  lsKey: string;
  docUrl: string;
  /**
   * Environment-variable names a project's `.env` is likely to use for this
   * provider. Listed in priority order — the first match wins when multiple
   * candidates exist in the same file.
   */
  envVarNames: string[];
  /** Optional sanity check; the .env import flow flags values that fail it. */
  validatePattern?: RegExp;
  supportedMethods: AuthMethod[];
  oauthConfig?: OAuthDeviceFlowConfig;
}

const LS_PREFIX = 'projectManager-key:';

export const KEYCHAIN_SERVICE = 'projectmanager';

export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude API)',
    category: 'ai',
    placeholder: 'sk-ant-...',
    keychainKey: 'anthropic-api-key',
    lsKey: `${LS_PREFIX}anthropic`,
    docUrl: 'https://console.anthropic.com/settings/keys',
    envVarNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    validatePattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    supportedMethods: ['apiKey', 'envImport'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    category: 'ai',
    placeholder: 'sk-...',
    keychainKey: 'openai-api-key',
    lsKey: `${LS_PREFIX}openai`,
    docUrl: 'https://platform.openai.com/api-keys',
    envVarNames: ['OPENAI_API_KEY'],
    validatePattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    supportedMethods: ['apiKey', 'envImport'],
  },
  {
    id: 'gemini',
    label: 'Gemini (Google AI)',
    category: 'ai',
    placeholder: 'AIza...',
    keychainKey: 'gemini-api-key',
    lsKey: `${LS_PREFIX}gemini`,
    docUrl: 'https://aistudio.google.com/app/apikey',
    envVarNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    validatePattern: /^AIza[A-Za-z0-9_-]{20,}$/,
    supportedMethods: ['apiKey', 'envImport'],
  },
  {
    id: 'github',
    label: 'GitHub Personal Access Token',
    category: 'integration',
    placeholder: 'ghp_... or gho_...',
    keychainKey: 'github-token',
    lsKey: `${LS_PREFIX}github`,
    docUrl: 'https://github.com/settings/tokens',
    envVarNames: ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT'],
    // GitHub tokens come in several flavours (classic ghp_, fine-grained
    // github_pat_, OAuth gho_, GitHub App ghs_) — a permissive prefix check
    // is the only useful client-side validation.
    validatePattern: /^(gh[psoru]_|github_pat_)[A-Za-z0-9_]{20,}$/,
    supportedMethods: ['apiKey', 'oauth', 'envImport'],
    oauthConfig: {
      provider: 'github',
      scopes: ['repo', 'read:user'],
    },
  },
];

export function getProvider(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function providersByCategory(category: ProviderCategory): ProviderSpec[] {
  return PROVIDERS.filter((p) => p.category === category);
}
