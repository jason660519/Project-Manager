/**
 * Pick a model id for the post-validation inference probe (F56 Slice 2).
 * Prefers live dynamic models from list-models, then static catalogue defaults.
 */

import { getLlmProvider, type LlmProviderId, type LlmProviderSpec } from './llmProviders';

const PROBE_MODEL_PREFERENCES: Partial<Record<LlmProviderId, string[]>> = {
  openai: ['gpt-4o-mini', 'gpt-4o'],
  gemini: ['gemini-2.5-flash', 'gemini-1.5-flash-latest'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
  deepseek: ['deepseek-v4-flash', 'deepseek-chat'],
  grok: ['grok-3-mini', 'grok-4.3'],
  openrouter: ['openai/gpt-4o-mini', 'openai/gpt-4o'],
  perplexity: ['sonar'],
};

function firstAvailable(preferred: string[], available: string[]): string | undefined {
  const set = new Set(available);
  return preferred.find((model) => set.has(model));
}

export function resolveProbeModelForProvider(
  providerId: string,
  dynamicModels: readonly string[],
  spec?: LlmProviderSpec,
): string | null {
  const llm = spec ?? getLlmProvider(providerId as LlmProviderId);
  if (!llm) return null;

  const preferences = PROBE_MODEL_PREFERENCES[llm.id] ?? [];
  const dynamicPreferred = firstAvailable(preferences, [...dynamicModels]);
  if (dynamicPreferred) return dynamicPreferred;

  const staticPreferred = firstAvailable(preferences, llm.availableModels);
  if (staticPreferred) return staticPreferred;

  if (dynamicModels.length > 0) return dynamicModels[0] ?? null;
  return llm.defaultModel;
}
