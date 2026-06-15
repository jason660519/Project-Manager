'use client';

/**
 * Arena → Coding Candidates suggestion feed (F50 Phase 4, node 7 of the
 * standard flow). Derives promotion suggestions from the persisted LLM Arena
 * run history; suggestions are computed, never stored — only acceptances
 * (rows) and dismissals (dismissedSuggestions) persist.
 */

import { useEffect, useMemo, useState } from 'react';
import { readKeysSlice, subscribeKeysSlice } from '../../../../lib/keys/store';
import {
  DEFAULT_PROMOTION_THRESHOLDS,
  evaluatePromotion,
  type PromotionThresholds,
  type PromotionVerdict,
} from '../../../../lib/keys/promotionRules';
import {
  codingCandidateId,
  type CodingCandidateState,
} from '../../../../lib/keys/codingCandidates';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import { sanitizeLlmArenaHistory, type RunHistoryEntry } from './LlmArenaTypes';

export interface ArenaPromotionSuggestion {
  /** codingCandidateId(provider, model) — also the dismissal key. */
  id: string;
  provider: LlmProviderId;
  model: string;
  verdict: PromotionVerdict;
  sourceRunId: string | null;
}

function trialSucceeded(entry: RunHistoryEntry): boolean {
  return !entry.error && entry.evaluationLevel !== 'fail';
}

function pairFromHistory(key: string, entries: RunHistoryEntry[]): { provider: LlmProviderId; model: string } {
  const row = entries.find((entry) => entry.resultRow)?.resultRow;
  if (row) return { provider: row.provider, model: row.model_id };
  // Fallback: provider ids never contain '-', so the first dash splits the key.
  const dash = key.indexOf('-');
  return { provider: key.slice(0, dash) as LlmProviderId, model: key.slice(dash + 1) };
}

export function useArenaPromotionSuggestions(args: {
  codingState: CodingCandidateState;
  providers: ReadonlyArray<{ id: LlmProviderId; availableModels: string[] }>;
  thresholds?: PromotionThresholds;
}): ArenaPromotionSuggestion[] {
  const { codingState, providers, thresholds = DEFAULT_PROMOTION_THRESHOLDS } = args;
  const [history, setHistory] = useState<Record<string, RunHistoryEntry[]>>(() =>
    typeof window === 'undefined' ? {} : sanitizeLlmArenaHistory(readKeysSlice('llmArenaHistory')),
  );

  useEffect(
    () => subscribeKeysSlice('llmArenaHistory', (value) => setHistory(sanitizeLlmArenaHistory(value))),
    [],
  );

  return useMemo(() => {
    const existingIds = new Set(
      codingState.rows.map((row) => codingCandidateId(row.provider, row.model)),
    );
    const dismissed = codingState.dismissedSuggestions ?? {};
    const availableByProvider = new Map(
      providers.map((provider) => [provider.id, new Set(provider.availableModels)]),
    );

    const suggestions: ArenaPromotionSuggestion[] = [];
    for (const [key, entries] of Object.entries(history)) {
      if (entries.length === 0) continue;
      const { provider, model } = pairFromHistory(key, entries);
      const id = codingCandidateId(provider, model);
      if (existingIds.has(id) || dismissed[id]) continue;
      // Only suggest models the user could actually run right now.
      if (!availableByProvider.get(provider)?.has(model)) continue;
      const verdict = evaluatePromotion(
        entries.map((entry) => ({
          success: trialSucceeded(entry),
          overallScore: entry.overallScore ?? entry.resultRow?.overall_score ?? null,
        })),
        thresholds,
      );
      if (verdict.tier !== 'master' && verdict.tier !== 'fallback') continue;
      suggestions.push({
        id,
        provider,
        model,
        verdict,
        sourceRunId: entries[0]?.resultRow?.run_id ?? null,
      });
    }

    return suggestions.sort(
      (a, b) => (b.verdict.averageScore ?? 0) - (a.verdict.averageScore ?? 0),
    );
  }, [history, codingState, providers, thresholds]);
}
