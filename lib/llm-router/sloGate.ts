import type { SloThresholds } from './sloConfig';
import type { WindowMetrics } from './sliWindow';

export function deploymentExceedsSlo(metrics: WindowMetrics, slo: SloThresholds): boolean {
  if (metrics.sampleCount < slo.minSamplesToGate) return false;
  if (metrics.errorRate > slo.maxErrorRate) return true;
  if (metrics.p95LatencyMs > slo.maxP95LatencyMs) return true;
  return false;
}

export function sloBreachReason(metrics: WindowMetrics, slo: SloThresholds): string {
  if (metrics.errorRate > slo.maxErrorRate) {
    return `error rate ${(metrics.errorRate * 100).toFixed(0)}% exceeds SLO ${(slo.maxErrorRate * 100).toFixed(0)}%`;
  }
  if (metrics.p95LatencyMs > slo.maxP95LatencyMs) {
    return `p95 latency ${metrics.p95LatencyMs}ms exceeds SLO ${slo.maxP95LatencyMs}ms`;
  }
  return 'SLO threshold exceeded';
}
