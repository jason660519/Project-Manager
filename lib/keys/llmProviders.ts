/**
 * Canonical LLM-provider registry. Everything the rest of the app needs to
 * talk to a provider lives here: where to dispatch the HTTP request
 * (`apiKind`/`baseUrl`), where the user's key lives (`keychainKey`/`lsKey`),
 * what env-var names .env import should look for, plus the human label and
 * a sane default model for one-shot scans.
 *
 * Adding a provider: append an entry. The Keys page (registry-driven), the
 * Settings fallback order, the scanner dispatch, and .env auto-detect all
 * pick it up automatically — no other files to touch.
 */

export type LlmProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'grok'
  | 'kimi'
  | 'openrouter'
  | 'perplexity'
  | 'together'
  | 'zhipu'
  | 'qwen';

/**
 * `anthropic` → POST /v1/messages with `x-api-key`.
 * `gemini`    → POST `{baseUrl}/{model}:generateContent?key=` (Google AI).
 * `openai-compatible` → POST `{baseUrl}/chat/completions` with Bearer auth.
 *
 * The fallback scanner reads this field to pick which Tauri command to invoke.
 */
export type LlmApiKind = 'anthropic' | 'gemini' | 'openai-compatible';

export interface LlmProviderSpec {
  id: LlmProviderId;
  label: string;
  placeholder: string;
  /** OS Keychain entry name (Tauri). */
  keychainKey: string;
  /** Browser localStorage key (dev fallback). */
  lsKey: string;
  /** Env vars considered when auto-importing from `.env`. Priority = order. */
  envVarNames: string[];
  /** Optional sanity pattern; .env import flags values that fail it. */
  validatePattern?: RegExp;
  docUrl: string;
  apiKind: LlmApiKind;
  /** Required when apiKind === 'openai-compatible'. */
  baseUrl?: string;
  /** Default model used for AI Scan one-shots. The user can override later. */
  defaultModel: string;
  /**
   * One-level-down fallback model tried automatically when the primary model
   * returns a "model not found" error. Only one tier is attempted; on continued
   * failure the chain moves to the next provider. Transient errors (rate limit,
   * network) skip this and jump directly to the next provider.
   */
  tierModel?: string;
  /**
   * Curated list of model IDs the user can pick from in Settings. We
   * intentionally hard-code instead of querying each provider's `/models`
   * endpoint — that adds noise (deprecated entries, embeddings, audio
   * models) and a network round-trip on every Settings open. Bump this
   * list when a notable new model lands.
   */
  availableModels: string[];
}

const LS_PREFIX = 'projectManager-key:';

const PROVIDERS: LlmProviderSpec[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-...',
    keychainKey: 'anthropic-api-key',
    lsKey: `${LS_PREFIX}anthropic`,
    envVarNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    validatePattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    docUrl: 'https://console.anthropic.com/settings/keys',
    apiKind: 'anthropic',
    defaultModel: 'claude-sonnet-4-6',
    tierModel: 'claude-sonnet-4-6',
    availableModels: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-opus-4-1',
      'claude-haiku-4-5-20251001',
      'claude-3-7-sonnet-latest',
      'claude-3-5-haiku-latest',
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    keychainKey: 'openai-api-key',
    lsKey: `${LS_PREFIX}openai`,
    envVarNames: ['OPENAI_API_KEY'],
    validatePattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    docUrl: 'https://platform.openai.com/api-keys',
    apiKind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.5',
    tierModel: 'gpt-4o',
    availableModels: ['gpt-5.5', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'gpt-3.5-turbo'],
  },
  {
    id: 'gemini',
    label: 'Gemini (Google AI)',
    placeholder: 'AIza...',
    keychainKey: 'gemini-api-key',
    lsKey: `${LS_PREFIX}gemini`,
    envVarNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    validatePattern: /^AIza[A-Za-z0-9_-]{20,}$/,
    docUrl: 'https://aistudio.google.com/app/apikey',
    apiKind: 'gemini',
    defaultModel: 'gemini-2.5-flash',
    tierModel: 'gemini-1.5-pro-latest',
    availableModels: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest',
      'gemini-2.0-flash-exp',
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    placeholder: 'sk-...',
    keychainKey: 'deepseek-api-key',
    lsKey: `${LS_PREFIX}deepseek`,
    envVarNames: ['DEEPSEEK_API_KEY'],
    docUrl: 'https://platform.deepseek.com/api_keys',
    apiKind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-v4',
    tierModel: 'deepseek-chat',
    availableModels: ['deepseek-v4', 'deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'grok',
    label: 'Grok (xAI)',
    placeholder: 'xai-...',
    keychainKey: 'grok-api-key',
    lsKey: `${LS_PREFIX}grok`,
    envVarNames: ['GROK_API_KEY', 'XAI_API_KEY'],
    docUrl: 'https://console.x.ai',
    apiKind: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    tierModel: 'grok-beta',
    availableModels: ['grok-2-latest', 'grok-2-1212', 'grok-beta'],
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    placeholder: 'sk-...',
    keychainKey: 'kimi-api-key',
    lsKey: `${LS_PREFIX}kimi`,
    envVarNames: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'],
    docUrl: 'https://platform.moonshot.cn/console/api-keys',
    apiKind: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    availableModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    placeholder: 'sk-or-...',
    keychainKey: 'openrouter-api-key',
    lsKey: `${LS_PREFIX}openrouter`,
    envVarNames: ['OPENROUTER_API_KEY'],
    docUrl: 'https://openrouter.ai/keys',
    apiKind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    // OpenRouter routes to many models — default to a strong general one.
    defaultModel: 'anthropic/claude-3.5-sonnet',
    availableModels: [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
    ],
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    placeholder: 'pplx-...',
    keychainKey: 'perplexity-api-key',
    lsKey: `${LS_PREFIX}perplexity`,
    envVarNames: ['PERPLEXITY_API_KEY'],
    docUrl: 'https://www.perplexity.ai/settings/api',
    apiKind: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'llama-3.1-sonar-large-128k-online',
    availableModels: [
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-small-128k-online',
      'llama-3.1-sonar-huge-128k-online',
    ],
  },
  {
    id: 'together',
    label: 'Together AI',
    placeholder: '...',
    keychainKey: 'together-api-key',
    lsKey: `${LS_PREFIX}together`,
    envVarNames: ['TOGETHER_AI_API_KEY', 'TOGETHER_API_KEY'],
    docUrl: 'https://api.together.ai/settings/api-keys',
    apiKind: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    availableModels: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
      'mistralai/Mixtral-8x22B-Instruct-v0.1',
      'deepseek-ai/DeepSeek-V3',
    ],
  },
  {
    id: 'zhipu',
    label: 'Zhipu (GLM)',
    placeholder: '...',
    keychainKey: 'zhipu-api-key',
    lsKey: `${LS_PREFIX}zhipu`,
    envVarNames: ['ZHIPU_API_KEY'],
    docUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    apiKind: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    availableModels: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4-long'],
  },
  {
    id: 'qwen',
    label: 'Qwen (Alibaba)',
    placeholder: 'sk-...',
    keychainKey: 'qwen-api-key',
    lsKey: `${LS_PREFIX}qwen`,
    envVarNames: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY'],
    docUrl: 'https://dashscope.console.aliyun.com/apiKey',
    apiKind: 'openai-compatible',
    // DashScope's OpenAI-compatible mode is the easiest entry point.
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    availableModels: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long'],
  },
];

const ID_INDEX: Map<LlmProviderId, LlmProviderSpec> = new Map(PROVIDERS.map((p) => [p.id, p]));

export function listLlmProviders(): readonly LlmProviderSpec[] {
  return PROVIDERS;
}

export function getLlmProviderIds(): LlmProviderId[] {
  return PROVIDERS.map((p) => p.id);
}

export function getLlmProvider(id: LlmProviderId): LlmProviderSpec | undefined {
  return ID_INDEX.get(id);
}
