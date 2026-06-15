import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMOTION_THRESHOLDS, evaluatePromotion } from '../lib/keys/promotionRules';

/** F50 Phase 4 (tdd-spec E4 前段): pure promotion tiering. */

function trials(successes: number, failures: number, score = 85) {
  return [
    ...Array.from({ length: successes }, () => ({ success: true, overallScore: score })),
    ...Array.from({ length: failures }, () => ({ success: false, overallScore: 10 })),
  ];
}

describe('promotionRules (Suite E4)', () => {
  it('promotes to master at >= 95% success with enough trials', () => {
    const verdict = evaluatePromotion(trials(10, 0));
    expect(verdict.tier).toBe('master');
    expect(verdict.successRate).toBe(1);
    expect(verdict.trialCount).toBe(10);
    expect(verdict.averageScore).toBe(85);
  });

  it('qualifies as fallback between 90% and 95%', () => {
    // 9/10 = 0.9 → fallback (below master 0.95, at fallback 0.9)
    expect(evaluatePromotion(trials(9, 1)).tier).toBe('fallback');
  });

  it('rejects below the fallback rate', () => {
    expect(evaluatePromotion(trials(8, 2)).tier).toBe('rejected');
  });

  it('makes no judgement below minTrials', () => {
    expect(evaluatePromotion(trials(4, 0)).tier).toBe('insufficient_data');
    expect(DEFAULT_PROMOTION_THRESHOLDS.minTrials).toBe(5);
  });

  it('averages only scored trials and reports null when none carry a score', () => {
    const verdict = evaluatePromotion([
      { success: true, overallScore: 90 },
      { success: true, overallScore: 80 },
      { success: true, overallScore: null },
      { success: true },
      { success: true, overallScore: 70 },
    ]);
    expect(verdict.averageScore).toBe(80);
    expect(evaluatePromotion(Array.from({ length: 6 }, () => ({ success: true }))).averageScore).toBeNull();
  });

  it('honours custom thresholds', () => {
    const verdict = evaluatePromotion(trials(3, 0), {
      masterSuccessRate: 0.9,
      fallbackSuccessRate: 0.8,
      minTrials: 3,
    });
    expect(verdict.tier).toBe('master');
  });
});
