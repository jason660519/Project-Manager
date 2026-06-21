import { computeHealthScore } from './healthScore';
import { getSloForAlias } from './sloConfig';
import { computeWindowMetrics, deploymentId, type DeploymentSliStats } from './sliWindow';

export interface RankableCandidate {
  provider: string;
  model: string;
  originalIndex: number;
}

export function rankCandidatesByHealth(
  candidates: RankableCandidate[],
  deployments: Record<string, DeploymentSliStats>,
  alias: string,
  nowUnix: number,
): RankableCandidate[] {
  const slo = getSloForAlias(alias);

  return [...candidates].sort((a, b) => {
    const aMetrics = computeWindowMetrics(deployments[deploymentId(a.provider, a.model)] ?? { observations: [] }, nowUnix);
    const bMetrics = computeWindowMetrics(deployments[deploymentId(b.provider, b.model)] ?? { observations: [] }, nowUnix);
    const aScore = computeHealthScore(aMetrics, slo);
    const bScore = computeHealthScore(bMetrics, slo);
    if (bScore !== aScore) return bScore - aScore;
    return a.originalIndex - b.originalIndex;
  });
}
