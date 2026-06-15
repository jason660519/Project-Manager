/**
 * Arena → Coding Candidates promotion rules (F50 Phase 4).
 *
 * Pure + server-safe: turns a model's recent trial history into a promotion
 * tier. Thresholds mirror the evaluation spec
 * (docs/engineering/llm-vlm-arena-evaluation-spec-v1.md): success_rate >= 0.95
 * promotes to master, >= 0.9 qualifies as fallback. They are parameters here
 * because the UI-side evaluation config (`LLM_ARENA_EVALUATION_CONFIG`) lives
 * under app/ui and this module must stay importable from server-safe code.
 */

export type PromotionTier = 'master' | 'fallback' | 'rejected' | 'insufficient_data';

export interface PromotionTrial {
  /** A trial that completed with a valid, non-failing evaluation. */
  success: boolean;
  overallScore?: number | null;
}

export interface PromotionThresholds {
  masterSuccessRate: number;
  fallbackSuccessRate: number;
  /** Below this many trials no judgement is made (history window is 10). */
  minTrials: number;
}

export const DEFAULT_PROMOTION_THRESHOLDS: PromotionThresholds = {
  masterSuccessRate: 0.95,
  fallbackSuccessRate: 0.9,
  minTrials: 5,
};

export interface PromotionVerdict {
  tier: PromotionTier;
  trialCount: number;
  successRate: number;
  /** Mean overall_score across scored trials; null when none carried a score. */
  averageScore: number | null;
}

export function evaluatePromotion(
  trials: PromotionTrial[],
  thresholds: PromotionThresholds = DEFAULT_PROMOTION_THRESHOLDS,
): PromotionVerdict {
  const trialCount = trials.length;
  const successCount = trials.filter((trial) => trial.success).length;
  const successRate = trialCount === 0 ? 0 : successCount / trialCount;
  const scored = trials
    .map((trial) => trial.overallScore)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  const averageScore =
    scored.length === 0 ? null : Math.round((scored.reduce((sum, s) => sum + s, 0) / scored.length) * 10) / 10;

  let tier: PromotionTier;
  if (trialCount < thresholds.minTrials) tier = 'insufficient_data';
  else if (successRate >= thresholds.masterSuccessRate) tier = 'master';
  else if (successRate >= thresholds.fallbackSuccessRate) tier = 'fallback';
  else tier = 'rejected';

  return { tier, trialCount, successRate, averageScore };
}
