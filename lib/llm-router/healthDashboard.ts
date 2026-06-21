import { computeHealthScore } from './healthScore';
import { getSloForAlias } from './sloConfig';
import { deploymentExceedsSlo } from './sloGate';
import {
  computeWindowMetrics,
  type DeploymentSliStats,
} from './sliWindow';

export type SloGateStatus = 'cold' | 'open' | 'closed';

export interface LlmRouterHealthRow {
  deploymentId: string;
  providerId: string;
  model: string;
  sampleCount: number;
  p95LatencyMs: number;
  errorRate: number;
  healthScore: number;
  sloGate: SloGateStatus;
  lastLatencyMs: number | null;
  lastTtftMs: number | null;
}

export function parseDeploymentId(deploymentId: string): { providerId: string; model: string } {
  const splitAt = deploymentId.indexOf(':');
  if (splitAt <= 0) {
    return { providerId: deploymentId, model: '' };
  }
  return {
    providerId: deploymentId.slice(0, splitAt),
    model: deploymentId.slice(splitAt + 1),
  };
}

export function sloGateStatus(
  sampleCount: number,
  metrics: { errorRate: number; p95LatencyMs: number },
  alias: string,
): SloGateStatus {
  const slo = getSloForAlias(alias);
  if (sampleCount < slo.minSamplesToGate) return 'cold';
  return deploymentExceedsSlo(
    { sampleCount, errorRate: metrics.errorRate, p95LatencyMs: metrics.p95LatencyMs },
    slo,
  )
    ? 'closed'
    : 'open';
}

export function buildLlmRouterHealthRows(args: {
  deployments: Record<string, DeploymentSliStats>;
  alias: string;
  nowUnix: number;
}): LlmRouterHealthRow[] {
  const { deployments, alias, nowUnix } = args;
  const slo = getSloForAlias(alias);

  return Object.entries(deployments)
    .map(([deploymentId, stats]) => {
      const metrics = computeWindowMetrics(stats, nowUnix);
      const { providerId, model } = parseDeploymentId(deploymentId);
      const last = stats.observations.at(-1) ?? null;
      return {
        deploymentId,
        providerId,
        model,
        sampleCount: metrics.sampleCount,
        p95LatencyMs: metrics.p95LatencyMs,
        errorRate: metrics.errorRate,
        healthScore: computeHealthScore(metrics, slo),
        sloGate: sloGateStatus(metrics.sampleCount, metrics, alias),
        lastLatencyMs: last?.latencyMs ?? null,
        lastTtftMs: last && 'ttftMs' in last ? (last as { ttftMs?: number }).ttftMs ?? null : null,
      };
    })
    .sort((a, b) => b.healthScore - a.healthScore || a.deploymentId.localeCompare(b.deploymentId));
}
