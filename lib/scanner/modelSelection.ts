import type { LlmProviderSpec } from '../keys/llmProviders';
import { loadProviderMetadata } from '../keys/providerMetadata';
import type { LlmProviderId } from '../keys/providerOrder';

const SCAN_MODEL_PREFERENCES: Partial<Record<LlmProviderId, string[]>> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash-latest'],
  deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
  grok: ['grok-4.3', 'grok-4.3-fast', 'grok-3-mini', 'grok-3', 'grok-2-latest'],
  kimi: ['kimi-k2.6', 'kimi-k2.5', 'moonshot-v1-32k', 'moonshot-v1-8k'],
  openrouter: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-sonnet',
    'deepseek/deepseek-chat',
  ],
  perplexity: ['sonar', 'sonar-pro'],
};

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function firstAvailable(preferred: string[], available: string[]): string | undefined {
  const availableSet = new Set(available);
  return preferred.find((model) => availableSet.has(model));
}

export interface ScanModelResolution {
  model: string;
  source: 'stored' | 'dynamic-preferred' | 'static-preferred' | 'default';
  dynamicModels: string[];
}

/**
 * Pick the model used by project initialization.
 *
 * Keys validation can discover the provider's live model list. Prefer that
 * list over static registry defaults so initialization does not call stale
 * model ids even when the provider key itself validates successfully.
 */
export function resolveScanModelForProvider(
  provider: LlmProviderId,
  spec: LlmProviderSpec,
  storedModel?: string,
): ScanModelResolution {
  const meta = loadProviderMetadata(provider);
  const dynamicModels =
    meta?.status === 'ok' && meta.dynamicModels?.length
      ? uniqueNonEmpty(meta.dynamicModels)
      : [];
  const preferences = SCAN_MODEL_PREFERENCES[provider] ?? [];

  if (storedModel && dynamicModels.includes(storedModel)) {
    return { model: storedModel, source: 'stored', dynamicModels };
  }

  const dynamicPreferred = firstAvailable(preferences, dynamicModels);
  if (dynamicPreferred) {
    return { model: dynamicPreferred, source: 'dynamic-preferred', dynamicModels };
  }

  if (
    storedModel &&
    spec.availableModels.includes(storedModel) &&
    (preferences.length === 0 || preferences.includes(storedModel))
  ) {
    return { model: storedModel, source: 'stored', dynamicModels };
  }

  const staticPreferred = firstAvailable(preferences, spec.availableModels);
  if (staticPreferred) {
    return { model: staticPreferred, source: 'static-preferred', dynamicModels };
  }

  return { model: spec.defaultModel, source: 'default', dynamicModels };
}
