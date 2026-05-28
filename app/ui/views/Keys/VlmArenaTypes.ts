'use client';

import type { ArenaResult } from './useArenaChat';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { Translations } from '../../../../lib/i18n';

export type ScenarioId = 'space_read' | 'ad_copy' | 'design_advice' | 'error_tolerance' | 'render_2d_3d';
export type RowScore = 'unrated' | 'pass' | 'good' | 'great' | 'fail';
export type VlmArenaCopy = Translations['keysArena']['vlm'];

export interface RunHistoryEntry {
  timestamp: number;
  scenario: ScenarioId;
  prompt: string;
  result: ArenaResult;
  resultImage2dUrl?: string;
  resultImage3dUrl?: string;
  message?: string;
  httpStatus?: number | null;
}

export interface ProviderLike {
  id: LlmProviderId;
  label: string;
  availableModels: string[];
}

export const VLM_SCENARIO_IDS: ScenarioId[] = ['space_read', 'ad_copy', 'design_advice', 'error_tolerance', 'render_2d_3d'];

export function getVlmScenarioItems(copy: VlmArenaCopy): Array<{ id: ScenarioId; label: string; instruction: string }> {
  return [
    { id: 'space_read', ...copy.scenarios.spaceRead },
    { id: 'ad_copy', ...copy.scenarios.adCopy },
    { id: 'design_advice', ...copy.scenarios.designAdvice },
    { id: 'error_tolerance', ...copy.scenarios.errorTolerance },
    { id: 'render_2d_3d', ...copy.scenarios.render2d3d },
  ];
}

export function scoreLabel(score: RowScore, copy: VlmArenaCopy): string {
  return copy.scores[score];
}

export function vlmStatusMeta(result: ArenaResult | undefined, copy: VlmArenaCopy): { text: string; className: string } {
  if (result?.error) return { text: copy.statuses.failed, className: 'bg-red-500/15 text-red-400' };
  if (result) return { text: copy.statuses.completed, className: 'bg-emerald-500/15 text-emerald-400' };
  return { text: copy.statuses.queued, className: 'bg-stone-500/15 text-stone-400' };
}

export const ROW_SCORE_IDS: RowScore[] = ['unrated', 'pass', 'good', 'great', 'fail'];
