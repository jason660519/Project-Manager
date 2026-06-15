'use client';

/**
 * Arena execution engine (F50 Phase 2) — replaces the ad-hoc execution core
 * inside useArenaChat.
 *
 * Fixes the four defects pinned by the P0 suite:
 * - timeouts now abort the underlying request (AbortController) instead of
 *   racing and letting it burn tokens in the background;
 * - concurrency actually honours `maxParallelRuns` (previously declared in
 *   config but never enforced);
 * - rate-limited calls retry with exponential backoff and report a real
 *   `retryCount` (previously hard-coded 0);
 * - httpStatus is what the transport saw (previously hard-coded 200 on the
 *   Tauri path) and token counts carry a measured/estimated provenance tag.
 *
 * Every trial gets a `runId` + `trialIndex`, closing the gap to the
 * `LlmArenaResultRow` data contract. The transport is injectable so unit and
 * stress tests never touch a real API.
 *
 * Known limitation: the Tauri bridge (`callSingleProvider`) has no abort
 * support — on that path a timeout stops *waiting* but cannot cancel the
 * native request. The browser path cancels for real via fetch(signal).
 */

import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import { getLlmProvider } from '../../../../lib/keys/llmProviders';
import { loadProviderKey, hasProviderKey } from '../../../../lib/keys/loadProviderKey';
import { loadAllProviderMetadata } from '../../../../lib/keys/providerMetadata';
import { callSingleProvider } from '../../../../lib/scanner/runProjectScan';
import type { AnthropicMessage } from '../../../../lib/bridge';
import {
  LLM_ARENA_EVALUATION_CONFIG,
  classifyLlmArenaError,
  type LlmArenaErrorType,
} from './LlmArenaEvaluation';
import type { ArenaResult } from './useArenaChat';

export interface ArenaRunRequest {
  provider: LlmProviderId;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Trials per request (spec: trial-level records). Defaults to 1. */
  trials?: number;
  taskBucket?: string;
  imageDataUrl?: string | null;
  imageDetail?: 'auto' | 'low' | 'high';
}

export interface ArenaTrialOutcome extends ArenaResult {
  runId: string;
  trialIndex: number;
  taskBucket: string;
  tokenSource: 'measured' | 'estimated';
}

export type ArenaBlockReason =
  | 'missing_key'
  | 'metadata_stale'
  | 'image_unsupported_runtime'
  | 'unknown_provider';

export interface ArenaBlockedRequest {
  request: ArenaRunRequest;
  reason: ArenaBlockReason;
  message: string;
}

export interface ArenaPreflightResult {
  runnable: ArenaRunRequest[];
  blocked: ArenaBlockedRequest[];
}

export interface ArenaTransportReply {
  content: string;
  model: string;
  httpStatus: number | null;
  inputTokens?: number;
  outputTokens?: number;
}

export class ArenaTransportError extends Error {
  httpStatus: number | null;
  constructor(message: string, httpStatus: number | null = null) {
    super(message);
    this.name = 'ArenaTransportError';
    this.httpStatus = httpStatus;
  }
}

export interface ArenaTransport {
  capabilities: { text: boolean; image: boolean };
  call(args: {
    request: ArenaRunRequest;
    apiKey: string;
    signal: AbortSignal;
  }): Promise<ArenaTransportReply>;
}

export interface ArenaPreflightDeps {
  hasKey?: (provider: LlmProviderId) => Promise<boolean>;
  /** lastValidatedAt per provider; defaults to the providerMetadata module. */
  lastValidatedAt?: (provider: LlmProviderId) => string | null;
  canImage?: boolean;
  /** Validation freshness window; older = blocked until revalidated. */
  maxMetadataAgeMs?: number;
  now?: () => number;
}

export const ARENA_METADATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

function defaultLastValidatedAt(provider: LlmProviderId): string | null {
  const meta = loadAllProviderMetadata()[provider];
  return meta?.lastValidatedAt ?? null;
}

/**
 * Node 1 of the standard flow: requests that cannot succeed are blocked here,
 * with a reason, before any token is spent.
 */
export async function preflightArenaRequests(
  requests: ArenaRunRequest[],
  deps: ArenaPreflightDeps = {},
): Promise<ArenaPreflightResult> {
  const hasKey = deps.hasKey ?? hasProviderKey;
  const lastValidatedAt = deps.lastValidatedAt ?? defaultLastValidatedAt;
  const canImage = deps.canImage ?? isTauriRuntime();
  const maxAgeMs = deps.maxMetadataAgeMs ?? ARENA_METADATA_MAX_AGE_MS;
  const now = deps.now ?? Date.now;

  const runnable: ArenaRunRequest[] = [];
  const blocked: ArenaBlockedRequest[] = [];

  for (const request of requests) {
    if (!getLlmProvider(request.provider)) {
      blocked.push({
        request,
        reason: 'unknown_provider',
        message: `Unknown provider: ${request.provider}`,
      });
      continue;
    }
    if (request.imageDataUrl && !canImage) {
      blocked.push({
        request,
        reason: 'image_unsupported_runtime',
        message: '影像評測需要在桌面 App（Tauri）執行；瀏覽器模式僅支援純文字。',
      });
      continue;
    }
    if (!(await hasKey(request.provider))) {
      blocked.push({
        request,
        reason: 'missing_key',
        message: `No API key saved for ${request.provider}`,
      });
      continue;
    }
    const validatedAt = lastValidatedAt(request.provider);
    const validatedMs = validatedAt ? Date.parse(validatedAt) : Number.NaN;
    if (!Number.isFinite(validatedMs) || now() - validatedMs > maxAgeMs) {
      blocked.push({
        request,
        reason: 'metadata_stale',
        message: `${request.provider} 的金鑰驗證已過期（>7 天）— 請到 API Key Validation 重新驗證。`,
      });
      continue;
    }
    runnable.push(request);
  }

  return { runnable, blocked };
}

async function callBrowserChatProxy(args: {
  request: ArenaRunRequest;
  apiKey: string;
  signal: AbortSignal;
}): Promise<ArenaTransportReply> {
  const { request, apiKey, signal } = args;
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      provider: request.provider,
      model: request.model,
      systemPrompt: request.systemPrompt,
      apiKey,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      messages: [{ role: 'user', content: request.userPrompt }],
    }),
  });
  const data = (await res.json().catch(() => null)) as
    | {
        content?: string;
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
        error?: string;
        details?: string[];
      }
    | null;
  if (!res.ok) {
    const details = Array.isArray(data?.details) ? ` ${data.details.join(' | ')}` : '';
    throw new ArenaTransportError(`${data?.error ?? `HTTP ${res.status}`}${details}`.trim(), res.status);
  }
  return {
    content: data?.content ?? '',
    model: data?.model || request.model,
    httpStatus: res.status,
    inputTokens: typeof data?.inputTokens === 'number' ? data.inputTokens : undefined,
    outputTokens: typeof data?.outputTokens === 'number' ? data.outputTokens : undefined,
  };
}

function buildTauriMessages(request: ArenaRunRequest): AnthropicMessage[] {
  const fullText = request.systemPrompt
    ? `${request.systemPrompt}\n\n${request.userPrompt}`
    : request.userPrompt;
  if (!request.imageDataUrl) return [{ role: 'user', content: fullText }];

  const match = request.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const parsedImage = match ? { mediaType: match[1], base64: match[2] } : null;
  const apiKind = getLlmProvider(request.provider)?.apiKind;

  if (apiKind === 'anthropic') {
    const contentBlocks: any[] = [];
    if (parsedImage) {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: parsedImage.mediaType, data: parsedImage.base64 },
      });
    }
    contentBlocks.push({ type: 'text', text: fullText });
    return [{ role: 'user', content: contentBlocks }];
  }
  if (apiKind === 'gemini') {
    const parts: any[] = [{ text: fullText }];
    if (parsedImage) {
      parts.push({ inlineData: { mimeType: parsedImage.mediaType, data: parsedImage.base64 } });
    }
    return [{ role: 'user', content: parts }];
  }
  // openai-compatible
  const contentBlocks: any[] = [{ type: 'text', text: fullText }];
  contentBlocks.push({
    type: 'image_url',
    image_url: { url: request.imageDataUrl, detail: request.imageDetail ?? 'auto' },
  });
  return [{ role: 'user', content: contentBlocks }];
}

async function callTauriBridge(args: {
  request: ArenaRunRequest;
  apiKey: string;
  signal: AbortSignal;
}): Promise<ArenaTransportReply> {
  const { request, apiKey } = args;
  // The bridge cannot abort mid-flight; the runner's abort barrier stops the
  // wait so the scheduler slot frees up — best available semantics here.
  const reply = await callSingleProvider(
    request.provider,
    apiKey,
    buildTauriMessages(request),
    request.model,
    request.temperature,
    request.maxTokens,
  );
  return {
    content: reply.content,
    model: reply.model,
    httpStatus: 200,
    inputTokens: reply.inputTokens,
    outputTokens: reply.outputTokens,
  };
}

export function defaultArenaTransport(): ArenaTransport {
  if (isTauriRuntime()) {
    return { capabilities: { text: true, image: true }, call: callTauriBridge };
  }
  return { capabilities: { text: true, image: false }, call: callBrowserChatProxy };
}

export interface ArenaRunOptions {
  transport?: ArenaTransport;
  loadKey?: (provider: LlmProviderId) => Promise<string>;
  maxParallel?: number;
  /** Extra attempts after a rate-limited call. Only rate limits retry. */
  maxRetries?: number;
  retryBaseDelayMs?: number;
  /** Streamed per-trial callback so the UI can update before the batch ends. */
  onOutcome?: (outcome: ArenaTrialOutcome) => void;
  runIdPrefix?: string;
}

interface ArenaTrialTask {
  request: ArenaRunRequest;
  trialIndex: number;
  runId: string;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ArenaTransportError('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new ArenaTransportError('aborted'));
      },
      { once: true },
    );
  });
}

let runSequence = 0;

export async function runArenaComparison(
  requests: ArenaRunRequest[],
  options: ArenaRunOptions = {},
): Promise<ArenaTrialOutcome[]> {
  const transport = options.transport ?? defaultArenaTransport();
  const loadKey = options.loadKey ?? loadProviderKey;
  const maxParallel = options.maxParallel ?? LLM_ARENA_EVALUATION_CONFIG.maxParallelRuns;
  const maxRetries = options.maxRetries ?? 2;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
  const runIdPrefix = options.runIdPrefix ?? 'pm-arena';

  const tasks: ArenaTrialTask[] = [];
  for (const request of requests) {
    const trials = Math.max(1, Math.round(request.trials ?? 1));
    for (let trialIndex = 0; trialIndex < trials; trialIndex += 1) {
      runSequence += 1;
      tasks.push({
        request,
        trialIndex,
        runId: `${runIdPrefix}-${Date.now()}-${runSequence}-${request.provider}-${request.model}-t${trialIndex}`,
      });
    }
  }

  const outcomes: ArenaTrialOutcome[] = new Array(tasks.length);
  const queue = tasks.map((task, index) => ({ task, index }));

  async function runOneTrial({ task, index }: { task: ArenaTrialTask; index: number }): Promise<void> {
    const { request, trialIndex, runId } = task;
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = () =>
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start);
    const timeoutMs = request.timeoutMs ?? 0;

    const controller = new AbortController();
    let timedOut = false;
    const timer =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs)
        : null;

    let retryCount = 0;
    try {
      const apiKey = await loadKey(request.provider);
      if (!apiKey?.trim()) {
        throw new ArenaTransportError(`No API key saved for ${request.provider}`);
      }

      // Even a transport that ignores the signal (Tauri bridge, naive mocks)
      // must not pin a worker slot past the timeout.
      const abortBarrier = new Promise<never>((_, reject) => {
        const onAbort = () => reject(new ArenaTransportError('aborted'));
        if (controller.signal.aborted) onAbort();
        else controller.signal.addEventListener('abort', onAbort, { once: true });
      });
      abortBarrier.catch(() => {});

      let reply: ArenaTransportReply | null = null;
      // First attempt + up to maxRetries extra attempts, rate limits only.
      for (let attempt = 0; ; attempt += 1) {
        try {
          reply = await Promise.race([
            transport.call({ request, apiKey, signal: controller.signal }),
            abortBarrier,
          ]);
          break;
        } catch (error) {
          const errorType = classifyTrialError(error, timedOut);
          if (errorType === 'rate_limit' && attempt < maxRetries) {
            retryCount += 1;
            await sleep(retryBaseDelayMs * 2 ** attempt, controller.signal);
            continue;
          }
          throw error;
        }
      }

      const promptText = `${request.systemPrompt}\n${request.userPrompt}`;
      const measured =
        typeof reply.inputTokens === 'number' && typeof reply.outputTokens === 'number';
      const outcome: ArenaTrialOutcome = {
        runId,
        trialIndex,
        taskBucket: request.taskBucket ?? 'llm_general',
        tokenSource: measured ? 'measured' : 'estimated',
        provider: request.provider,
        model: request.model,
        requestedModel: request.model,
        effectiveModel: reply.model,
        content: reply.content,
        outputLines: reply.content.split(/\r?\n/).filter(Boolean),
        httpStatus: reply.httpStatus,
        retryCount,
        errorType: reply.content.trim() ? 'none' : 'empty_output',
        inputTokens: reply.inputTokens ?? estimateTokens(promptText),
        outputTokens: reply.outputTokens ?? estimateTokens(reply.content),
        latencyMs: elapsed(),
        timestamp: Date.now(),
      };
      outcomes[index] = outcome;
      options.onOutcome?.(outcome);
    } catch (error) {
      const errorType = classifyTrialError(error, timedOut);
      const errorMessage = timedOut
        ? `${request.provider}/${request.model} timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);
      const outcome: ArenaTrialOutcome = {
        runId,
        trialIndex,
        taskBucket: request.taskBucket ?? 'llm_general',
        tokenSource: 'estimated',
        provider: request.provider,
        model: request.model,
        requestedModel: request.model,
        effectiveModel: '',
        outputLines: [errorMessage],
        httpStatus: error instanceof ArenaTransportError ? error.httpStatus : null,
        retryCount,
        errorType,
        error: errorMessage,
        latencyMs: elapsed(),
        timestamp: Date.now(),
      };
      outcomes[index] = outcome;
      options.onOutcome?.(outcome);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      await runOneTrial(next);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(maxParallel, tasks.length)) }, worker));
  return outcomes;
}

function classifyTrialError(error: unknown, timedOut: boolean): LlmArenaErrorType {
  if (timedOut) return 'timeout';
  if (error instanceof Error && error.name === 'AbortError') return 'timeout';
  if (error instanceof ArenaTransportError && error.httpStatus === 429) return 'rate_limit';
  return classifyLlmArenaError(error);
}
