import { describe, expect, it } from 'vitest';
import { formatAttemptFailure, summarizeScanError } from '../lib/scanner/errorSummary';

describe('scan error summaries', () => {
  it('turns provider billing and model errors into concise user-facing reasons', () => {
    expect(
      summarizeScanError(
        'OpenAI-compatible API 402 Payment Required: {"error":{"message":"Insufficient credits. Add more using https://openrouter.ai/settings/credits","code":402}}',
      ),
    ).toBe('Billing/credits issue');
    expect(
      summarizeScanError(
        'OpenAI-compatible API 400 Bad Request: {"code":"Client specified an invalid argument","error":"Model not found: grok-2-1212"}',
      ),
    ).toBe('Model not found: grok-2-1212');
  });

  it('redacts provider account and key fragments before summarizing fallback attempts', () => {
    const formatted = formatAttemptFailure({
      provider: 'kimi',
      modelId: 'kimi-k2.6',
      outcome: 'retryable',
      error:
        'OpenAI-compatible API 429 Too Many Requests: {"error":{"message":"Your account org-38ec1bc094a14cf4a021ee74d543d2fc <ak-fab5n11dqgu111dtrnc1> is suspended due to insufficient balance"}}',
    });

    expect(formatted).toBe('kimi/kimi-k2.6 (Account suspended or unavailable)');
    expect(formatted).not.toContain('org-38ec');
    expect(formatted).not.toContain('ak-fab');
  });

  it('collapses malformed JSON into an actionable category', () => {
    expect(summarizeScanError('JSON Parse error: Unterminated string')).toBe(
      'Provider returned malformed JSON',
    );
  });
});
