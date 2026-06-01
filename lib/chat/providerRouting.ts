import {
  getLlmProvider,
  type LlmProviderId,
  type LlmProviderSpec,
} from '../keys/llmProviders';

const FALLBACK_PROVIDERS: LlmProviderId[] = ['deepseek', 'anthropic', 'openai', 'gemini', 'grok'];

const MODEL_PATTERNS: Array<{ pattern: RegExp; provider: LlmProviderId }> = [
  { pattern: /^deepseek/i, provider: 'deepseek' },
  { pattern: /^claude/i, provider: 'anthropic' },
  { pattern: /^gpt/i, provider: 'openai' },
  { pattern: /^o1/i, provider: 'openai' },
  { pattern: /^o3/i, provider: 'openai' },
  { pattern: /^gemini/i, provider: 'gemini' },
  { pattern: /^grok/i, provider: 'grok' },
  { pattern: /^kimi|^moonshot/i, provider: 'kimi' },
  { pattern: /^qwen/i, provider: 'qwen' },
  { pattern: /^glm/i, provider: 'zhipu' },
];

export function detectProviderFromModel(model: string): LlmProviderId | undefined {
  for (const { pattern, provider } of MODEL_PATTERNS) {
    if (pattern.test(model)) return provider;
  }
  return undefined;
}

export function getChatProviderSpec(provider: string): LlmProviderSpec {
  const spec = getLlmProvider(provider as LlmProviderId);
  if (!spec) throw new Error(`Unsupported provider: ${provider}`);
  return spec;
}

export function getDefaultChatModel(provider: string): string {
  return getChatProviderSpec(provider).defaultModel;
}

export function buildChatProviderChain({
  model,
  userProvider,
}: {
  model?: string;
  userProvider?: string;
}): string[] {
  const detected = model ? detectProviderFromModel(model) : undefined;
  if (userProvider) {
    return [userProvider, ...FALLBACK_PROVIDERS.filter((provider) => provider !== userProvider)];
  }
  if (detected) {
    return [detected, ...FALLBACK_PROVIDERS.filter((provider) => provider !== detected)];
  }
  return [...FALLBACK_PROVIDERS];
}

export function resolveChatProviderApiKey(provider: string): string {
  const spec = getChatProviderSpec(provider);
  for (const envName of spec.envVarNames) {
    const value = process.env[envName];
    if (value?.trim()) return value;
  }
  const legacyEnvName = `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  const legacyValue = process.env[legacyEnvName];
  if (legacyValue?.trim()) return legacyValue;
  throw new Error(`${spec.envVarNames[0] ?? legacyEnvName} not configured`);
}

export function openAiCompatibleChatCompletionsUrl(provider: string): string {
  const spec = getChatProviderSpec(provider);
  if (spec.apiKind !== 'openai-compatible') {
    throw new Error(`Provider ${provider} is not OpenAI-compatible`);
  }
  if (!spec.baseUrl) throw new Error(`Provider ${provider} is missing a baseUrl`);
  return `${spec.baseUrl.replace(/\/$/, '')}/chat/completions`;
}

export function openAiCompatibleBaseUrl(provider: string): string {
  const spec = getChatProviderSpec(provider);
  if (spec.apiKind !== 'openai-compatible') {
    throw new Error(`Provider ${provider} is not OpenAI-compatible`);
  }
  if (!spec.baseUrl) throw new Error(`Provider ${provider} is missing a baseUrl`);
  return spec.baseUrl.replace(/\/$/, '');
}
