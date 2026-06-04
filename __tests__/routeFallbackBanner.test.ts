import { describe, expect, it } from 'vitest';
import {
  buildRouteFallbackBannerContent,
  summarizeRouteError,
} from '../lib/chat/routeFallbackBanner';

describe('summarizeRouteError', () => {
  it('extracts message from nested Gemini JSON errors', () => {
    const reason =
      'Gemini API 429 Too Many Requests: {\n  "error": {\n    "code": 429,\n    "message": "Your prepayment credits are depleted.",\n    "status": "RESOURCE_EXHAUSTED"\n  }\n}\n';
    expect(summarizeRouteError(reason)).toBe('429: Your prepayment credits are depleted.');
  });

  it('truncates very long plain-text errors', () => {
    const reason = `Provider failed: ${'x'.repeat(200)}`;
    expect(summarizeRouteError(reason).endsWith('…')).toBe(true);
    expect(summarizeRouteError(reason).length).toBeLessThanOrEqual(140);
  });
});

describe('buildRouteFallbackBannerContent', () => {
  it('returns null when route is not degraded', () => {
    expect(
      buildRouteFallbackBannerContent({
        routeDecisionId: 'route-1',
        modelAlias: 'pm-code',
        strategy: 'deterministic-fallback-v1',
        selectedProvider: 'openai',
        selectedModel: 'gpt-4o-mini',
        degraded: false,
        attempts: [{ provider: 'openai', model: 'gpt-4o-mini', status: 'success' }],
      }),
    ).toBeNull();
  });

  it('collects failed and cooldown attempts for degraded routes', () => {
    const content = buildRouteFallbackBannerContent({
      routeDecisionId: 'route-2',
      modelAlias: 'pm-reasoning',
      strategy: 'deterministic-fallback-v1',
      selectedProvider: 'anthropic',
      selectedModel: 'claude-sonnet-4-6',
      degraded: true,
      attempts: [
        {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          status: 'skipped_cooldown',
          errorReason: '429 credits depleted',
        },
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          status: 'success',
        },
      ],
    });

    expect(content).toEqual({
      failedLines: [
        {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          kind: 'skipped_cooldown',
          reason: '429 credits depleted',
        },
      ],
      selectedProvider: 'anthropic',
      selectedModel: 'claude-sonnet-4-6',
    });
  });
});
