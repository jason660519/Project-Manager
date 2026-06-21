import { SLI_MAX_OBSERVATIONS, SLI_WINDOW_SECONDS } from './sloConfig';

export interface DeploymentObservation {
  success: boolean;
  latencyMs: number;
  ttftMs?: number;
  observedAtUnix: number;
}

export interface DeploymentSliStats {
  observations: DeploymentObservation[];
}

export interface WindowMetrics {
  sampleCount: number;
  errorRate: number;
  p95LatencyMs: number;
}

export function pruneObservations(
  observations: DeploymentObservation[],
  nowUnix: number,
  windowSeconds: number = SLI_WINDOW_SECONDS,
): DeploymentObservation[] {
  const cutoff = nowUnix - windowSeconds;
  return observations.filter((o) => o.observedAtUnix >= cutoff);
}

export function computeWindowMetrics(
  stats: DeploymentSliStats,
  nowUnix: number,
  windowSeconds: number = SLI_WINDOW_SECONDS,
): WindowMetrics {
  const observations = pruneObservations(stats.observations, nowUnix, windowSeconds);
  if (observations.length === 0) {
    return { sampleCount: 0, errorRate: 0, p95LatencyMs: 0 };
  }

  const failures = observations.filter((o) => !o.success).length;
  const successLatencies = observations.filter((o) => o.success).map((o) => o.latencyMs).sort((a, b) => a - b);
  const latencies = successLatencies.length > 0 ? successLatencies : observations.map((o) => o.latencyMs).sort((a, b) => a - b);
  const p95Index = Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1);

  return {
    sampleCount: observations.length,
    errorRate: failures / observations.length,
    p95LatencyMs: latencies[Math.max(0, p95Index)] ?? 0,
  };
}

export function recordObservation(
  stats: DeploymentSliStats,
  observation: DeploymentObservation,
  nowUnix: number,
  windowSeconds: number = SLI_WINDOW_SECONDS,
  maxObservations: number = SLI_MAX_OBSERVATIONS,
): DeploymentSliStats {
  const pruned = pruneObservations([...stats.observations, observation], nowUnix, windowSeconds);
  const capped =
    pruned.length > maxObservations ? pruned.slice(pruned.length - maxObservations) : pruned;
  return { observations: capped };
}

export function deploymentId(provider: string, model: string): string {
  return `${provider}:${model}`;
}
