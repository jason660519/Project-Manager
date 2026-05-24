import { callAnthropic, callGemini, callOpenAICompatible, isModelNotFoundError, type AnthropicMessage } from '../bridge';
import { getLlmProvider } from '../keys/llmProviders';
import { hasProviderKey, loadProviderKey } from '../keys/loadProviderKey';
import {
  iterateProvidersForFallback,
  loadProviderOrder,
  type LlmProviderId,
} from '../keys/providerOrder';
import { buildProjectContextBridge } from './buildContextBridge';
import { summarizeScanError } from './errorSummary';
import { resolveScanModelForProvider } from './modelSelection';
import {
  buildScanReviewPrompt,
  mergeScanReviewResponse,
  parseScanReviewResponse,
  type ScanReviewSummary,
} from './scanReview';
import {
  attachScanValidationMetadata,
  contextForValidation,
  summarizeScanValidation,
  type ScanValidationReport,
} from './scanValidation';
import { buildScanPrompt, parseScanResponse, type ScanResult } from './shared';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Reportable summary of one provider+model attempt. The UI shows these in order. */
export interface ProviderAttempt {
  provider: LlmProviderId;
  /** The specific model ID that was called. Undefined for legacy attempts lacking this data. */
  modelId?: string;
  outcome: 'success' | 'retryable' | 'fatal';
  error?: string;
}

export type ScanProgressStage =
  | 'provider_order'
  | 'scan_files'
  | 'section_candidates'
  | 'prompt'
  | 'provider_attempt'
  | 'quorum'
  | 'parse_response'
  | 'completed'
  | 'failed';

export interface ScanProgressEvent {
  stage: ScanProgressStage;
  status: 'pending' | 'running' | 'success' | 'warning' | 'failed';
  message: string;
  timestamp: string;
  provider?: LlmProviderId;
  modelId?: string;
  outcome?: ProviderAttempt['outcome'];
  error?: string;
  providerCount?: number;
  sectionCandidateCount?: number;
  featureCount?: number;
}

export interface RunProjectScanOptions {
  onProgress?: (event: ScanProgressEvent) => void;
  scanMode?: 'cheap' | 'fast' | 'quality';
  quorumDelayMs?: number;
  providerTimeoutMs?: number;
}

/** Result type augmented with per-provider attempt history. */
export interface FallbackScanResult extends ScanResult {
  attempts?: ProviderAttempt[];
  providerUsed?: LlmProviderId;
  /** The exact model ID that produced the successful response (may be the tier fallback). */
  usedModelId?: string;
  validationReport?: ScanValidationReport;
  reviewSummary?: ScanReviewSummary;
  quorumSummary?: {
    mode: NonNullable<RunProjectScanOptions['scanMode']>;
    requiredReports: number;
    validReports: number;
    selectedProvider?: LlmProviderId;
    selectedModelId?: string;
    comparedProviders: string[];
    completedEarly: boolean;
  };
}

const SYSTEM_PRELUDE =
  'You are a project structure analyst. Return only valid JSON, no markdown fences.\n\n';

function emitProgress(
  options: RunProjectScanOptions | undefined,
  event: Omit<ScanProgressEvent, 'timestamp'>,
): void {
  options?.onProgress?.({ ...event, timestamp: new Date().toISOString() });
}

/**
 * Decide whether an error from one provider should cause us to fall through
 * to the next, or whether it's a fatal we should stop on. The premise: if a
 * provider returns 4xx for auth / bad request, the next provider in line is
 * likely to error too only for *different* reasons, so we still fall through
 * — but we mark the attempt as `fatal` so the UI can surface it clearly.
 *
 * Anything we can't classify defaults to `retryable` (try the next provider).
 */
function classifyProviderError(raw: string): 'retryable' | 'fatal' {
  if (/401|403|invalid[_ -]?api[_ -]?key|unauthor/i.test(raw)) return 'fatal';
  if (/400|invalid[_ -]?request/i.test(raw)) return 'fatal';
  return 'retryable';
}

function shortError(raw: string): string {
  const oneLine = summarizeScanError(raw) ?? raw.replace(/\s+/g, ' ').trim();
  return oneLine.length > 220 ? `${oneLine.slice(0, 217)}...` : oneLine;
}

interface ProviderScanSuccess {
  ok: true;
  provider: LlmProviderId;
  modelId: string;
  rawResponse: string;
  config: import('../types').ProjectManagerConfig;
  report: ScanValidationReport;
  attempts: ProviderAttempt[];
}

interface ProviderScanFailure {
  ok: false;
  provider: LlmProviderId;
  attempts: ProviderAttempt[];
}

type ProviderScanOutcome = ProviderScanSuccess | ProviderScanFailure;

function validationScore(report: ScanValidationReport): number {
  return report.highConfidenceCount * 6 - report.reviewCount * 3 - report.errorCount * 4 - report.warningCount;
}

function selectBestScanReport(reports: ProviderScanSuccess[]): ProviderScanSuccess {
  return reports.reduce((best, candidate) => {
    const bestScore = validationScore(best.report);
    const candidateScore = validationScore(candidate.report);
    if (candidateScore > bestScore) return candidate;
    if (candidateScore === bestScore && candidate.report.featureCount > best.report.featureCount) {
      return candidate;
    }
    return best;
  }, reports[0]);
}

async function reviewLowConfidenceFeatures(args: {
  config: import('../types').ProjectManagerConfig;
  report: ScanValidationReport;
  context: import('./shared').ProjectContext;
  sequence: LlmProviderId[];
  modelMap: Map<LlmProviderId, string | undefined>;
  excludeProviders: Set<LlmProviderId>;
  options: RunProjectScanOptions;
}): Promise<{
  config: import('../types').ProjectManagerConfig;
  report: ScanValidationReport;
  reviewSummary?: ScanReviewSummary;
}> {
  if (args.report.reviewCount === 0) {
    return { config: args.config, report: args.report };
  }

  const reviewer = args.sequence.find((provider) => !args.excludeProviders.has(provider));
  if (!reviewer) {
    emitProgress(args.options, {
      stage: 'parse_response',
      status: 'warning',
      message: `${args.report.reviewCount} feature${
        args.report.reviewCount === 1 ? '' : 's'
      } need review, but no second provider is available for AI review`,
    });
    return {
      config: args.config,
      report: args.report,
      reviewSummary: {
        attempted: false,
        reviewedCount: args.report.reviewCount,
        acceptedCount: 0,
        rejectedCount: 0,
      },
    };
  }

  const spec = getLlmProvider(reviewer);
  if (!spec) return { config: args.config, report: args.report };
  const modelResolution = resolveScanModelForProvider(reviewer, spec, args.modelMap.get(reviewer));
  const modelId = modelResolution.model;

  try {
    const apiKey = await loadProviderKey(reviewer);
    emitProgress(args.options, {
      stage: 'provider_attempt',
      status: 'running',
      message: `Reviewing ${args.report.reviewCount} low-confidence feature${
        args.report.reviewCount === 1 ? '' : 's'
      } with ${reviewer}/${modelId}`,
      provider: reviewer,
      modelId,
    });
    const prompt = SYSTEM_PRELUDE + buildScanReviewPrompt(args.config, args.report, args.context);
    const response = await callSingleProvider(reviewer, apiKey, prompt, modelId, 0.1, 2048);
    const review = parseScanReviewResponse(response.content);
    const merged = mergeScanReviewResponse(
      args.config,
      args.report,
      review,
      contextForValidation(args.context),
    );
    emitProgress(args.options, {
      stage: 'parse_response',
      status: merged.acceptedCount > 0 ? 'success' : 'warning',
      message: `AI review accepted ${merged.acceptedCount}/${merged.reviewedCount} revision${
        merged.reviewedCount === 1 ? '' : 's'
      }; ${merged.report.reviewCount} feature${merged.report.reviewCount === 1 ? '' : 's'} still need review`,
      provider: reviewer,
      modelId,
      featureCount: merged.report.featureCount,
    });
    return {
      config: merged.config,
      report: merged.report,
      reviewSummary: {
        attempted: true,
        provider: reviewer,
        modelId,
        reviewedCount: merged.reviewedCount,
        acceptedCount: merged.acceptedCount,
        rejectedCount: merged.rejectedCount,
      },
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    emitProgress(args.options, {
      stage: 'provider_attempt',
      status: 'warning',
      message: `${reviewer}/${modelId} review pass failed`,
      provider: reviewer,
      modelId,
      error: raw,
    });
    return {
      config: args.config,
      report: args.report,
      reviewSummary: {
        attempted: true,
        provider: reviewer,
        modelId,
        reviewedCount: args.report.reviewCount,
        acceptedCount: 0,
        rejectedCount: 0,
        error: shortError(raw),
      },
    };
  }
}

/**
 * Run one LLM call against a single provider. Exposed beyond this module
 * so the Settings playground can re-use the exact same dispatch (same
 * Rust commands, same JSON shape) to test a provider without coupling to
 * the scanner's loop.
 */
export async function callSingleProvider(
  provider: LlmProviderId,
  apiKey: string,
  fullPrompt: string | AnthropicMessage[],
  modelOverride?: string,
  temperature?: number,
  maxTokens?: number,
): Promise<{ content: string; inputTokens: number; outputTokens: number; model: string }> {
  const spec = getLlmProvider(provider);
  if (!spec) throw new Error(`Unknown provider: ${provider}`);
  const model = modelOverride ?? spec.defaultModel;
  const messages = typeof fullPrompt === 'string'
    ? [{ role: 'user' as const, content: fullPrompt }]
    : fullPrompt;
  const maxTok = maxTokens ?? 4096;
  if (spec.apiKind === 'anthropic') {
    const r = await callAnthropic({ apiKey, model, maxTokens: maxTok, messages, temperature });
    return { content: r.content, inputTokens: r.inputTokens, outputTokens: r.outputTokens, model };
  }
  if (spec.apiKind === 'gemini') {
    const r = await callGemini({ apiKey, model, maxTokens: maxTok, messages, temperature });
    return { content: r.content, inputTokens: r.inputTokens, outputTokens: r.outputTokens, model };
  }
  // openai-compatible: routes to OpenAI / DeepSeek / Grok / Kimi / OpenRouter
  // / Perplexity / Together / Zhipu / Qwen. The baseUrl differs; the rest of
  // the call is identical.
  if (!spec.baseUrl) {
    throw new Error(`${provider} is openai-compatible but has no baseUrl registered`);
  }
  const r = await callOpenAICompatible({
    apiKey,
    baseUrl: spec.baseUrl,
    model,
    maxTokens: maxTok,
    messages,
    temperature,
  });
  return { content: r.content, inputTokens: r.inputTokens, outputTokens: r.outputTokens, model };
}

async function runProviderScanAttempt(args: {
  provider: LlmProviderId;
  modelMap: Map<LlmProviderId, string | undefined>;
  prompt: string;
  context: import('./shared').ProjectContext;
  options: RunProjectScanOptions;
  shouldEmit?: () => boolean;
}): Promise<ProviderScanOutcome> {
  const { provider, modelMap, prompt, context, options } = args;
  const shouldEmit = args.shouldEmit ?? (() => true);
  const emitIfActive = (event: Omit<ScanProgressEvent, 'timestamp'>) => {
    if (shouldEmit()) emitProgress(options, event);
  };
  const attempts: ProviderAttempt[] = [];
  const spec = getLlmProvider(provider);
  if (!spec) return { ok: false, provider, attempts };
  const modelResolution = resolveScanModelForProvider(provider, spec, modelMap.get(provider));
  const primaryModel = modelResolution.model;
  if (modelResolution.source !== 'stored') {
    emitIfActive({
      stage: 'provider_attempt',
      status: 'success',
      message: `Selected ${provider}/${primaryModel} for initialization (${modelResolution.source})`,
      provider,
      modelId: primaryModel,
    });
  }

  let apiKey: string;
  try {
    apiKey = await loadProviderKey(provider);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    attempts.push({ provider, modelId: primaryModel, outcome: 'retryable', error: raw });
    emitIfActive({
      stage: 'provider_attempt',
      status: 'warning',
      message: `${provider}/${primaryModel} could not load its API key`,
      provider,
      modelId: primaryModel,
      outcome: 'retryable',
      error: raw,
    });
    return { ok: false, provider, attempts };
  }

  const tryModel = async (modelId: string): Promise<ProviderScanSuccess> => {
    emitIfActive({
      stage: 'provider_attempt',
      status: 'running',
      message: `Trying ${provider}/${modelId}`,
      provider,
      modelId,
    });
    const response = await callSingleProvider(provider, apiKey, prompt, modelId);
    emitIfActive({
      stage: 'parse_response',
      status: 'running',
      message: `Parsing ${provider}/${modelId} scan response`,
      provider,
      modelId,
    });
    const parsedConfig = parseScanResponse(response.content);
    const { config, report } = attachScanValidationMetadata(
      parsedConfig,
      contextForValidation(context),
    );
    attempts.push({ provider, modelId, outcome: 'success' });
    emitIfActive({
      stage: 'provider_attempt',
      status: 'success',
      message: `${provider}/${modelId} produced ${config.features.length} feature${
        config.features.length === 1 ? '' : 's'
      }`,
      provider,
      modelId,
      outcome: 'success',
      featureCount: config.features.length,
    });
    return {
      ok: true,
      provider,
      modelId,
      rawResponse: response.content,
      config,
      report,
      attempts: [...attempts],
    };
  };

  try {
    return await tryModel(primaryModel);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const outcome = classifyProviderError(raw);
    attempts.push({ provider, modelId: primaryModel, outcome, error: raw });
    emitIfActive({
      stage: 'provider_attempt',
      status: outcome === 'fatal' ? 'failed' : 'warning',
      message: `${provider}/${primaryModel} failed`,
      provider,
      modelId: primaryModel,
      outcome,
      error: raw,
    });
    if (!isModelNotFoundError(raw)) return { ok: false, provider, attempts };
  }

  const tierModel = spec.tierModel;
  if (!tierModel || tierModel === primaryModel) return { ok: false, provider, attempts };

  try {
    return await tryModel(tierModel);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const outcome = classifyProviderError(raw);
    attempts.push({ provider, modelId: tierModel, outcome, error: raw });
    emitIfActive({
      stage: 'provider_attempt',
      status: outcome === 'fatal' ? 'failed' : 'warning',
      message: `${provider}/${tierModel} failed`,
      provider,
      modelId: tierModel,
      outcome,
      error: raw,
    });
    return { ok: false, provider, attempts };
  }
}

/**
 * Run the AI project scan with provider fallback (Settings → AI providers).
 *
 * Tauri path:
 *   1. Load the user's preferred provider order (defaults to Anthropic →
 *      OpenAI → Gemini, all enabled).
 *   2. Filter out providers without a stored API key.
 *   3. For each provider in turn:
 *        a. Try the user's preferred model (or the provider default).
 *        b. On "model not found" → try the provider's one-tier-down `tierModel`.
 *        c. On any other error (rate limit, auth, network) → skip tier attempt
 *           and move to the next provider.
 *   4. Return on the first successful response.
 *
 * Browser dev path is unchanged — it goes through `/api/scan-project`,
 * which uses server-side env vars (a deliberate inconsistency: dev/server
 * keys live in `.env`, desktop keys in OS Keychain).
 */
export async function runProjectScan(
  projectRoot: string,
  options: RunProjectScanOptions = {},
): Promise<FallbackScanResult> {
  const root = projectRoot.replace(/\/+$/, '');

  if (!isTauri()) {
    try {
      emitProgress(options, {
        stage: 'scan_files',
        status: 'running',
        message: 'Sending scan request to the dev API',
      });
      const res = await fetch('/api/scan-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: root }),
      });
      const data = (await res.json()) as ScanResult;
      if (!res.ok && !data.error) {
        emitProgress(options, {
          stage: 'failed',
          status: 'failed',
          message: `Scan request failed (${res.status})`,
        });
        return { success: false, error: `Scan request failed (${res.status})` };
      }
      emitProgress(options, {
        stage: data.success ? 'completed' : 'failed',
        status: data.success ? 'success' : 'failed',
        message: data.success ? 'Scan request completed' : data.error || 'Scan request failed',
        featureCount: data.config?.features.length,
      });
      return data;
    } catch (error) {
      emitProgress(options, {
        stage: 'failed',
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Tauri path — multi-provider fallback chain.
  const order = await loadProviderOrder();
  const keyAvailability = await Promise.all(
    order.map(async (e) => [e.provider, await hasProviderKey(e.provider)] as const),
  );
  const keyMap = new Map<LlmProviderId, boolean>(keyAvailability);
  const modelMap = new Map<LlmProviderId, string | undefined>(
    order.map((e) => [e.provider, e.model] as const),
  );
  const sequence = iterateProvidersForFallback(order, (p) => keyMap.get(p) === true);
  emitProgress(options, {
    stage: 'provider_order',
    status: sequence.length > 0 ? 'success' : 'failed',
    message:
      sequence.length > 0
        ? `${sequence.length} configured provider${sequence.length === 1 ? '' : 's'} available`
        : 'No enabled provider with a stored API key is available',
    providerCount: sequence.length,
  });

  if (sequence.length === 0) {
    return {
      success: false,
      error: 'NO_PROVIDER_CONFIGURED',
      attempts: [],
    };
  }

  let context;
  try {
    emitProgress(options, {
      stage: 'scan_files',
      status: 'running',
      message: 'Scanning project files and key documents',
    });
    context = await buildProjectContextBridge(root);
    emitProgress(options, {
      stage: 'section_candidates',
      status: 'success',
      message: `Built ${context.sectionCandidates?.length ?? 0} section candidate${
        (context.sectionCandidates?.length ?? 0) === 1 ? '' : 's'
      } from the project tree`,
      sectionCandidateCount: context.sectionCandidates?.length ?? 0,
    });
  } catch (error) {
    emitProgress(options, {
      stage: 'failed',
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  emitProgress(options, {
    stage: 'prompt',
    status: 'success',
    message: 'Prepared AI scan prompt with project tree and section candidates',
  });
  const prompt = SYSTEM_PRELUDE + buildScanPrompt(context);

  const attempts: ProviderAttempt[] = [];
  const validReports: ProviderScanSuccess[] = [];
  const mode = options.scanMode ?? 'fast';
  const requiredReports = mode === 'cheap' || sequence.length === 1 ? 1 : 2;
  const initialParallel = mode === 'quality' ? Math.min(3, sequence.length) : Math.min(2, sequence.length);
  const backupDelayMs = options.quorumDelayMs ?? 7000;
  const providerTimeoutMs = options.providerTimeoutMs ?? 60000;
  let nextProviderIndex = 0;
  let runClosed = false;
  let backupStarted = false;
  const active = new Map<LlmProviderId, Promise<ProviderScanOutcome>>();

  const startProvider = (provider: LlmProviderId) => {
    if (active.has(provider)) return;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scanPromise = runProviderScanAttempt({
      provider,
      modelMap,
      prompt,
      context,
      options,
      shouldEmit: () => !runClosed && !timedOut,
    });
    const timeoutPromise = new Promise<ProviderScanOutcome>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        const error = `Timed out after ${Math.round(providerTimeoutMs / 1000)}s`;
        if (!runClosed) {
          emitProgress(options, {
            stage: 'provider_attempt',
            status: 'warning',
            message: `${provider} initialization timed out`,
            provider,
            outcome: 'retryable',
            error,
          });
        }
        resolve({
          ok: false,
          provider,
          attempts: [{ provider, outcome: 'retryable', error }],
        });
      }, providerTimeoutMs);
    });
    active.set(
      provider,
      Promise.race([scanPromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
      }),
    );
  };

  const startNextProvider = (): boolean => {
    while (nextProviderIndex < sequence.length) {
      const provider = sequence[nextProviderIndex];
      nextProviderIndex += 1;
      if (active.has(provider)) continue;
      startProvider(provider);
      return true;
    }
    return false;
  };

  for (let index = 0; index < initialParallel; index += 1) {
    startNextProvider();
  }

  emitProgress(options, {
    stage: 'quorum',
    status: 'running',
    message: `Parallel initialization started: waiting for ${requiredReports} valid AI report${
      requiredReports === 1 ? '' : 's'
    } from up to ${sequence.length} configured provider${sequence.length === 1 ? '' : 's'}`,
    providerCount: sequence.length,
  });

  let backupTimer: ReturnType<typeof setTimeout> | undefined;
  let backupPromise =
    mode !== 'cheap' && sequence.length > initialParallel
      ? new Promise<ProviderScanOutcome | null>((resolve) => {
          backupTimer = setTimeout(() => {
            if (runClosed || validReports.length >= requiredReports) {
              resolve(null);
              return;
            }
            backupStarted = startNextProvider();
            if (backupStarted) {
              emitProgress(options, {
                stage: 'quorum',
                status: 'warning',
                message: `Started a backup AI provider because fewer than ${requiredReports} reports were ready after ${Math.round(
                  backupDelayMs / 1000,
                )}s`,
              });
            }
            resolve(null);
          }, backupDelayMs);
        })
      : undefined;

  while (active.size > 0 && validReports.length < requiredReports) {
    const settled = await Promise.race([
      ...[...active.entries()].map(async ([provider, promise]) => ({
        provider,
        outcome: await promise,
      })),
      ...(backupPromise ? [backupPromise.then((outcome) => ({ provider: undefined, outcome }))] : []),
    ]);

    if (!settled.provider || !settled.outcome) {
      backupPromise = undefined;
      continue;
    }

    active.delete(settled.provider);
    attempts.push(...settled.outcome.attempts);
    if (settled.outcome.ok) {
      validReports.push(settled.outcome);
      emitProgress(options, {
        stage: 'quorum',
        status: validReports.length >= requiredReports ? 'success' : 'running',
        message: `${validReports.length}/${requiredReports} valid AI report${
          requiredReports === 1 ? '' : 's'
        } received`,
        provider: settled.outcome.provider,
        modelId: settled.outcome.modelId,
        featureCount: settled.outcome.report.featureCount,
      });
    }

    if (validReports.length >= requiredReports) break;
    const concurrencyLimit = mode === 'quality' || backupStarted ? 3 : initialParallel;
    if (active.size < concurrencyLimit) {
      startNextProvider();
    }
  }

  if (backupTimer) clearTimeout(backupTimer);

  if (validReports.length > 0) {
    runClosed = true;
    const selected = selectBestScanReport(validReports);
    const reviewed = await reviewLowConfidenceFeatures({
      config: selected.config,
      report: selected.report,
      context,
      sequence,
      modelMap,
      excludeProviders: new Set(attempts.map((attempt) => attempt.provider)),
      options,
    });
    const comparedProviders = validReports.map((report) => `${report.provider}/${report.modelId}`);
    emitProgress(options, {
      stage: 'completed',
      status: validReports.length >= requiredReports ? 'success' : 'warning',
      message:
        validReports.length >= requiredReports
          ? `AI scan quorum completed; selected ${selected.provider}/${selected.modelId}`
          : `AI scan completed with one valid report; selected ${selected.provider}/${selected.modelId}`,
      provider: selected.provider,
      modelId: selected.modelId,
      featureCount: reviewed.config.features.length,
    });
    emitProgress(options, {
      stage: 'parse_response',
      status: reviewed.report.reviewCount > 0 ? 'warning' : 'success',
      message: summarizeScanValidation(reviewed.report),
      featureCount: reviewed.report.featureCount,
    });
    return {
      success: true,
      config: reviewed.config,
      context,
      rawResponse: selected.rawResponse,
      attempts,
      providerUsed: selected.provider,
      usedModelId: selected.modelId,
      validationReport: reviewed.report,
      reviewSummary: reviewed.reviewSummary,
      quorumSummary: {
        mode,
        requiredReports,
        validReports: validReports.length,
        selectedProvider: selected.provider,
        selectedModelId: selected.modelId,
        comparedProviders,
        completedEarly: active.size > 0,
      },
    };
  }

  runClosed = true;

  // Everyone in the chain failed. Return the final error along with the
  // attempt log so the UI can render "tried 3 providers, all failed".
  const last = attempts[attempts.length - 1];
  emitProgress(options, {
    stage: 'failed',
    status: 'failed',
    message: last?.error || 'All configured providers failed',
    provider: last?.provider,
    modelId: last?.modelId,
    error: last?.error,
  });
  return {
    success: false,
    error: last?.error || 'All configured providers failed',
    attempts,
  };
}
