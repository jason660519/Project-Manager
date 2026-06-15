/**
 * Coding-agent candidates — the bridge from the Keys "Coding Agent Candidate"
 * sheet to the AI Assistant's coding-model picker.
 *
 * The sheet (`app/ui/views/Keys/CodingAgentCandidateSheet.tsx`) lets the user
 * hand-pick a short-list of coding-capable models. Each row carries a provider,
 * a model, a free-text note, and an enabled flag. This module owns the canonical
 * row/state types (kept server-safe so the AI Assistant can read them without
 * importing the client-only Keys context) plus a pure selector.
 *
 * Mirrors `lib/aiSdks/candidates.ts`, which does the same for the AI SDKs view.
 */

import { uuidv5 } from '../aiSdks/uuid';
import type { LlmProviderId } from './llmProviders';

/** Fixed namespace for coding-candidate row ids (do not change — would re-key all rows). */
export const CODING_CANDIDATE_ID_NAMESPACE = '7a1c9d44-2e8b-5f0a-9c3d-6b4e1f2a8d70';

/** One hand-picked coding-model candidate for the AI Assistant short-list. */
export interface CodingCandidateRow {
  provider: LlmProviderId;
  model: string;
  note: string;
  enabled: boolean;
  /** Provenance (F50 Phase 4): absent = manual curation (pre-F50 rows). */
  origin?: 'manual' | 'accepted';
  /** run_id of the arena run whose promotion suggested this row. */
  sourceRunId?: string;
  /** overall_score snapshot at acceptance time. */
  scoreSnapshot?: number;
}

export interface CodingCandidateState {
  rows: CodingCandidateRow[];
  /**
   * Dismissed arena suggestions, keyed by `codingCandidateId(provider, model)`
   * → ISO timestamp. A dismissed pair is never re-suggested.
   */
  dismissedSuggestions?: Record<string, string>;
}

export interface CodingCandidate {
  /** Deterministic UUIDv5 of `${provider}:${model}` — stable row identity. */
  id: string;
  provider: LlmProviderId;
  model: string;
  note: string;
  /** Provenance passthrough for consumers that care where a row came from. */
  origin?: 'manual' | 'accepted';
  sourceRunId?: string;
  scoreSnapshot?: number;
}

/** Stable UUIDv5 row id derived from the provider:model natural key. */
export function codingCandidateId(provider: LlmProviderId, model: string): string {
  return uuidv5(`${provider}:${model}`, CODING_CANDIDATE_ID_NAMESPACE);
}

/**
 * The enabled coding candidates, in sheet order — the curated short-list the AI
 * Assistant's coding picker consumes. Pure + server-safe.
 */
export function listCodingAgentCandidates(state: CodingCandidateState): CodingCandidate[] {
  return state.rows
    .filter((row) => row.enabled && Boolean(row.model))
    .map((row) => ({
      id: codingCandidateId(row.provider, row.model),
      provider: row.provider,
      model: row.model,
      note: row.note,
      ...(row.origin ? { origin: row.origin } : {}),
      ...(row.sourceRunId ? { sourceRunId: row.sourceRunId } : {}),
      ...(typeof row.scoreSnapshot === 'number' ? { scoreSnapshot: row.scoreSnapshot } : {}),
    }));
}
