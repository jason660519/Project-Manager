export interface SloThresholds {
  maxP95LatencyMs: number;
  maxErrorRate: number;
  minSamplesToGate: number;
}

const SLO_BY_ALIAS: Record<string, SloThresholds> = {
  'pm-fast': { maxP95LatencyMs: 3000, maxErrorRate: 0.15, minSamplesToGate: 5 },
  'pm-code': { maxP95LatencyMs: 12000, maxErrorRate: 0.2, minSamplesToGate: 5 },
  'pm-reasoning': { maxP95LatencyMs: 30000, maxErrorRate: 0.15, minSamplesToGate: 3 },
  'pm-local': { maxP95LatencyMs: 8000, maxErrorRate: 0.1, minSamplesToGate: 3 },
};

const PM_CODE = SLO_BY_ALIAS['pm-code'];

export function getSloForAlias(alias: string): SloThresholds {
  return SLO_BY_ALIAS[alias] ?? PM_CODE;
}

export const SLI_WINDOW_SECONDS = 300;
export const SLI_MAX_OBSERVATIONS = 50;
