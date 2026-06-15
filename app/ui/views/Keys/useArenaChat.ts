'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { LlmArenaErrorType } from './LlmArenaEvaluation';
import { commitKeysSlice, readKeysSlice, type KeysSliceName } from '../../../../lib/keys/store';
import {
  preflightArenaRequests,
  runArenaComparison,
  type ArenaBlockReason,
  type ArenaPreflightDeps,
  type ArenaRunOptions,
  type ArenaRunRequest,
} from './arenaRunner';

export interface ArenaModelSpec {
  provider: LlmProviderId;
  model: string;
}

export interface ArenaResult {
  provider: LlmProviderId;
  model: string;
  content?: string;
  error?: string;
  requestedModel?: string;
  effectiveModel?: string;
  outputLines?: string[];
  httpStatus?: number | null;
  retryCount?: number;
  errorType?: LlmArenaErrorType;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  timestamp: number;
}

export interface UseArenaChatConfig {
  /** Per-model prompt overrides keep row-level prompts working in batch runs. */
  models: Array<ArenaModelSpec & { userPromptOverride?: string }>;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  imageDataUrl?: string | null;
  imageDetail?: 'auto' | 'low' | 'high';
}

export interface UseArenaChatOptions {
  /** Injectable for tests; production uses key store + providerMetadata + runtime detection. */
  preflightDeps?: ArenaPreflightDeps;
  runnerOptions?: Pick<ArenaRunOptions, 'transport' | 'loadKey' | 'maxParallel' | 'maxRetries' | 'retryBaseDelayMs'>;
}

const BLOCK_REASON_ERROR_TYPE: Record<ArenaBlockReason, LlmArenaErrorType> = {
  missing_key: 'missing_key',
  metadata_stale: 'other',
  image_unsupported_runtime: 'other',
  unknown_provider: 'runtime_error',
};

/**
 * Arena UI state hook. Since F50 Phase 2 the execution core lives in
 * `arenaRunner` (preflight gate → abort-capable, concurrency-capped,
 * retry-aware engine); this hook only maps outcomes into the per-model
 * results record the matrix table renders, and persists it via the keys
 * store.
 */
export function useArenaChat(
  persistSlice?: Extract<KeysSliceName, 'llmArenaResults'>,
  options?: UseArenaChatOptions,
) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Record<string, ArenaResult>>(() => {
    if (!persistSlice || typeof window === 'undefined') return {};
    const value = readKeysSlice(persistSlice);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, ArenaResult>)
      : {};
  });
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!persistSlice || typeof window === 'undefined') return;
    commitKeysSlice(persistSlice, results);
  }, [results, persistSlice]);

  const runComparison = useCallback(
    async ({
      models,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
      timeoutMs,
      imageDataUrl,
      imageDetail = 'auto',
    }: UseArenaChatConfig) => {
      if (models.length === 0) return;
      setIsRunning(true);
      try {
        const requests: ArenaRunRequest[] = models.map((spec) => ({
          provider: spec.provider,
          model: spec.model,
          systemPrompt,
          userPrompt: spec.userPromptOverride?.trim() ? spec.userPromptOverride : userPrompt,
          temperature,
          maxTokens,
          timeoutMs,
          imageDataUrl,
          imageDetail,
        }));

        const { runnable, blocked } = await preflightArenaRequests(
          requests,
          optionsRef.current?.preflightDeps,
        );

        // Blocked requests fail at the selection node — no token spent, the
        // row shows why immediately.
        if (blocked.length > 0) {
          setResults((prev) => {
            const next = { ...prev };
            for (const { request, reason, message } of blocked) {
              next[`${request.provider}-${request.model}`] = {
                provider: request.provider,
                model: request.model,
                requestedModel: request.model,
                effectiveModel: '',
                outputLines: [message],
                httpStatus: null,
                retryCount: 0,
                errorType: BLOCK_REASON_ERROR_TYPE[reason],
                error: message,
                latencyMs: 0,
                timestamp: Date.now(),
              };
            }
            return next;
          });
        }

        if (runnable.length > 0) {
          await runArenaComparison(runnable, {
            ...optionsRef.current?.runnerOptions,
            onOutcome: (outcome) => {
              setResults((prev) => ({
                ...prev,
                [`${outcome.provider}-${outcome.model}`]: outcome,
              }));
            },
          });
        }
      } finally {
        setIsRunning(false);
      }
    },
    [],
  );

  const clearResults = useCallback(() => {
    setResults({});
  }, []);

  return {
    runComparison,
    results,
    clearResults,
    isRunning,
  };
}
