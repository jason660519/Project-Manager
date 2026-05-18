/**
 * Provider registry — single source of truth for every external credential PM
 * knows how to handle. AI providers (Anthropic, OpenAI, Gemini, DeepSeek, …)
 * are defined in `llmProviders.ts`; this file extends the list with non-LLM
 * integrations (currently just GitHub OAuth) so the Keys view and `.env`
 * import can iterate one combined list.
 */

import { listLlmProviders } from './llmProviders';

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

/**
 * Project off the LLM registry so the Keys page automatically shows every
 * provider PM can call. AI providers all support `apiKey + envImport`; the
 * Keys view doesn't expose OAuth for them.
 */
const AI_PROVIDERS: ProviderSpec[] = listLlmProviders().map((spec) => ({
  id: spec.id,
  label: spec.label,
  category: 'ai' as const,
  placeholder: spec.placeholder,
  keychainKey: spec.keychainKey,
  lsKey: spec.lsKey,
  docUrl: spec.docUrl,
  envVarNames: spec.envVarNames,
  validatePattern: spec.validatePattern,
  supportedMethods: ['apiKey', 'envImport'] as AuthMethod[],
}));

const INTEGRATION_PROVIDERS: ProviderSpec[] = [
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

export const PROVIDERS: ProviderSpec[] = [...AI_PROVIDERS, ...INTEGRATION_PROVIDERS];

export function getProvider(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function providersByCategory(category: ProviderCategory): ProviderSpec[] {
  return PROVIDERS.filter((p) => p.category === category);
}
