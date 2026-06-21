import { describe, expect, it } from 'vitest';

import { classifyProviderError } from '../../../../lib/llm-router/errorTaxonomy';
import { computeHealthScore } from '../../../../lib/llm-router/healthScore';
import { rankCandidatesByHealth } from '../../../../lib/llm-router/rankCandidates';
import { getSloForAlias } from '../../../../lib/llm-router/sloConfig';
import {
  computeWindowMetrics,
  pruneObservations,
  recordObservation,
  type DeploymentObservation,
  type DeploymentSliStats,
} from '../../../../lib/llm-router/sliWindow';
import { deploymentExceedsSlo } from '../../../../lib/llm-router/sloGate';

const NOW = 1_720_000_000;

function obs(success: boolean, latencyMs: number, offsetSec = 0): DeploymentObservation {
  return { success, latencyMs, observedAtUnix: NOW - offsetSec };
}

function stats(observations: DeploymentObservation[]): DeploymentSliStats {
  return { observations: [...observations] };
}

describe('F56 error taxonomy', () => {
  it('classifies auth errors as non-retryable without cooldown', () => {
    const result = classifyProviderError('401 Unauthorized: invalid_api_key');
    expect(result.category).toBe('auth');
    expect(result.retryable).toBe(false);
    expect(result.cooldownSeconds).toBeUndefined();
  });

  it('classifies rate limits with 60s cooldown', () => {
    const result = classifyProviderError('429 Too Many Requests rate limit');
    expect(result.category).toBe('rate_limit');
    expect(result.cooldownSeconds).toBe(60);
  });

  it('classifies 503 with 120s cooldown', () => {
    const result = classifyProviderError('503 service unavailable');
    expect(result.category).toBe('server_error');
    expect(result.cooldownSeconds).toBe(120);
  });
});

describe('F56 SLO config', () => {
  it('pm-fast is stricter than pm-reasoning', () => {
    const fast = getSloForAlias('pm-fast');
    const reasoning = getSloForAlias('pm-reasoning');
    expect(fast.maxP95LatencyMs).toBeLessThan(reasoning.maxP95LatencyMs);
  });

  it('defaults unknown alias to pm-code thresholds', () => {
    const slo = getSloForAlias('unknown-alias');
    expect(slo.maxP95LatencyMs).toBe(getSloForAlias('pm-code').maxP95LatencyMs);
  });
});

describe('F56 SLI window', () => {
  it('prunes observations older than 5 minutes', () => {
    const pruned = pruneObservations(
      [obs(true, 100, 400), obs(true, 200, 100), obs(true, 300, 10)],
      NOW,
      300,
    );
    expect(pruned).toHaveLength(2);
  });

  it('computes p95 latency and error rate', () => {
    const metrics = computeWindowMetrics(
      stats([
        obs(true, 1000, 10),
        obs(true, 2000, 20),
        obs(true, 3000, 30),
        obs(true, 4000, 40),
        obs(false, 5000, 50),
      ]),
      NOW,
      300,
    );
    expect(metrics.sampleCount).toBe(5);
    expect(metrics.errorRate).toBeCloseTo(0.2, 5);
    expect(metrics.p95LatencyMs).toBe(4000);
  });

  it('recordObservation caps history at 50 entries', () => {
    let current = stats([]);
    for (let i = 0; i < 55; i += 1) {
      current = recordObservation(current, obs(true, i, 0), NOW, 300, 50);
    }
    expect(current.observations.length).toBe(50);
  });
});

describe('F56 SLO gate', () => {
  it('does not gate cold-start deployments below minSamples', () => {
    const slo = getSloForAlias('pm-fast');
    const metrics = computeWindowMetrics(
      stats([obs(true, 9000, 1), obs(true, 9500, 2)]),
      NOW,
      300,
    );
    expect(deploymentExceedsSlo(metrics, slo)).toBe(false);
  });

  it('gates pm-fast when p95 latency exceeds threshold with enough samples', () => {
    const slo = getSloForAlias('pm-fast');
    const metrics = computeWindowMetrics(
      stats([
        obs(true, 4000, 10),
        obs(true, 4500, 20),
        obs(true, 5000, 30),
        obs(true, 5500, 40),
        obs(true, 6000, 50),
      ]),
      NOW,
      300,
    );
    expect(deploymentExceedsSlo(metrics, slo)).toBe(true);
  });

  it('does not gate pm-reasoning for same latencies', () => {
    const slo = getSloForAlias('pm-reasoning');
    const metrics = computeWindowMetrics(
      stats([
        obs(true, 4000, 10),
        obs(true, 4500, 20),
        obs(true, 5000, 30),
        obs(true, 5500, 40),
        obs(true, 6000, 50),
      ]),
      NOW,
      300,
    );
    expect(deploymentExceedsSlo(metrics, slo)).toBe(false);
  });

  it('gates on error rate breach', () => {
    const slo = getSloForAlias('pm-fast');
    const metrics = computeWindowMetrics(
      stats([
        obs(false, 1000, 10),
        obs(false, 1000, 20),
        obs(false, 1000, 30),
        obs(true, 1000, 40),
        obs(true, 1000, 50),
      ]),
      NOW,
      300,
    );
    expect(metrics.errorRate).toBeGreaterThan(slo.maxErrorRate);
    expect(deploymentExceedsSlo(metrics, slo)).toBe(true);
  });
});

describe('F56 health score and ranking', () => {
  it('assigns higher score to healthier deployments', () => {
    const slo = getSloForAlias('pm-fast');
    const healthy = computeWindowMetrics(
      stats([obs(true, 800, 10), obs(true, 900, 20), obs(true, 700, 30)]),
      NOW,
      300,
    );
    const degraded = computeWindowMetrics(
      stats([
        obs(false, 8000, 10),
        obs(false, 9000, 20),
        obs(true, 7000, 30),
        obs(true, 8000, 40),
        obs(true, 9000, 50),
      ]),
      NOW,
      300,
    );
    expect(computeHealthScore(healthy, slo)).toBeGreaterThan(computeHealthScore(degraded, slo));
  });

  it('ranks healthier candidate first while preserving tie order', () => {
    const ranked = rankCandidatesByHealth(
      [
        { provider: 'openai', model: 'gpt-4o', originalIndex: 0 },
        { provider: 'anthropic', model: 'claude-sonnet-4-6', originalIndex: 1 },
      ],
      {
        'openai:gpt-4o': stats([
          obs(false, 9000, 10),
          obs(false, 9000, 20),
          obs(false, 9000, 30),
          obs(false, 9000, 40),
          obs(false, 9000, 50),
        ]),
        'anthropic:claude-sonnet-4-6': stats([
          obs(true, 900, 10),
          obs(true, 800, 20),
          obs(true, 850, 30),
        ]),
      },
      'pm-fast',
      NOW,
    );
    expect(ranked[0]?.provider).toBe('anthropic');
    expect(ranked[1]?.provider).toBe('openai');
  });
});
