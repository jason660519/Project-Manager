import { describe, expect, it } from 'vitest';

import {
  buildLlmRouterHealthRows,
  parseDeploymentId,
  sloGateStatus,
} from '../../../../lib/llm-router/healthDashboard';

describe('F56 health dashboard', () => {
  it('parses provider:model deployment ids', () => {
    expect(parseDeploymentId('anthropic:claude-haiku-4-5-20251001')).toEqual({
      providerId: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('ranks healthier deployment first', () => {
    const now = 1_000_000;
    const rows = buildLlmRouterHealthRows({
      alias: 'pm-fast',
      nowUnix: now,
      deployments: {
        'openai:gpt-4o': {
          observations: [
            { success: true, latencyMs: 5000, observedAtUnix: now - 10 },
            { success: true, latencyMs: 5200, observedAtUnix: now - 20 },
            { success: true, latencyMs: 5100, observedAtUnix: now - 30 },
            { success: true, latencyMs: 5300, observedAtUnix: now - 40 },
            { success: true, latencyMs: 5400, observedAtUnix: now - 50 },
          ],
        },
        'anthropic:claude-haiku-4-5-20251001': {
          observations: [
            { success: true, latencyMs: 800, ttftMs: 790, observedAtUnix: now - 10 },
          ],
        },
      },
    });

    expect(rows[0]?.deploymentId).toBe('anthropic:claude-haiku-4-5-20251001');
    expect(rows[0]?.healthScore).toBeGreaterThan(rows[1]?.healthScore ?? 0);
    expect(rows[1]?.sloGate).toBe('closed');
  });

  it('reports cold start until min samples', () => {
    expect(sloGateStatus(2, { errorRate: 1, p95LatencyMs: 99999 }, 'pm-fast')).toBe('cold');
    expect(sloGateStatus(5, { errorRate: 1, p95LatencyMs: 99999 }, 'pm-fast')).toBe('closed');
    expect(sloGateStatus(5, { errorRate: 0, p95LatencyMs: 900 }, 'pm-fast')).toBe('open');
  });
});
