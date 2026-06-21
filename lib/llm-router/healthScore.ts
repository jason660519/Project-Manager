import type { SloThresholds } from './sloConfig';
import type { WindowMetrics } from './sliWindow';

export function computeHealthScore(metrics: WindowMetrics, slo: SloThresholds): number {
  if (metrics.sampleCount === 0) return 75;

  const latencyRatio = slo.maxP95LatencyMs > 0
    ? Math.min(1, metrics.p95LatencyMs / slo.maxP95LatencyMs)
    : 0;
  const errorRatio = slo.maxErrorRate > 0
    ? Math.min(1, metrics.errorRate / slo.maxErrorRate)
    : 0;

  const penalty = latencyRatio * 45 + errorRatio * 45;
  return Math.max(0, Math.round(100 - penalty));
}
