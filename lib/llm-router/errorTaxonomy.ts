/**
 * Unified provider error classification for Keys validation, scan fallback,
 * and LLM router cooldown decisions (F56).
 */

export type ProviderErrorCategory =
  | 'auth'
  | 'model_not_found'
  | 'rate_limit'
  | 'quota'
  | 'unreachable'
  | 'timeout'
  | 'server_error'
  | 'permission'
  | 'invalid_request'
  | 'parse'
  | 'empty'
  | 'keychain'
  | 'unknown';

export interface ProviderErrorClassification {
  category: ProviderErrorCategory;
  retryable: boolean;
  cooldownSeconds?: number;
}

export function classifyProviderError(raw: string): ProviderErrorClassification {
  const lower = raw.toLowerCase();

  if (
    lower.includes('invalid_api_key') ||
    lower.includes('incorrect api key') ||
    lower.includes('unauthorized') ||
    /\b401\b/.test(lower) ||
    (lower.includes('403') && lower.includes('invalid'))
  ) {
    return { category: 'auth', retryable: false };
  }

  if (
    lower.includes('model_not_found') ||
    lower.includes('model not found') ||
    lower.includes('unknown model') ||
    lower.includes('does not exist')
  ) {
    return { category: 'model_not_found', retryable: true };
  }

  if (lower.includes('429') || lower.includes('rate limit')) {
    return { category: 'rate_limit', retryable: true, cooldownSeconds: 60 };
  }

  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('service unavailable')
  ) {
    return { category: 'server_error', retryable: true, cooldownSeconds: 120 };
  }

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('408')) {
    return { category: 'timeout', retryable: true, cooldownSeconds: 30 };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound')
  ) {
    return { category: 'unreachable', retryable: true };
  }

  if (lower.includes('403') || lower.includes('permission denied')) {
    return { category: 'permission', retryable: false };
  }

  if (lower.includes('400') || lower.includes('invalid request')) {
    return { category: 'invalid_request', retryable: false };
  }

  return { category: 'unknown', retryable: true };
}
