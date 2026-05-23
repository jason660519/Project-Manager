import { callAnthropic, callGemini, callOpenAICompatible, isModelNotFoundError, type AnthropicMessage } from '../bridge';
import { getLlmProvider } from '../keys/llmProviders';
import { hasProviderKey, loadProviderKey } from '../keys/loadProviderKey';
import {
  iterateProvidersForFallback,
  loadProviderOrder,
  type LlmProviderId,
} from '../keys/providerOrder';
import { buildProjectContextBridge } from './buildContextBridge';
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

/** Result type augmented with per-provider attempt history. */
export interface FallbackScanResult extends ScanResult {
  attempts?: ProviderAttempt[];
  providerUsed?: LlmProviderId;
  /** The exact model ID that produced the successful response (may be the tier fallback). */
  usedModelId?: string;
}

const SYSTEM_PRELUDE =
  'You are a project structure analyst. Return only valid JSON, no markdown fences.\n\n';

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
export async function runProjectScan(projectRoot: string): Promise<FallbackScanResult> {
  const root = projectRoot.replace(/\/+$/, '');

  if (!isTauri()) {
    try {
      const res = await fetch('/api/scan-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: root }),
      });
      const data = (await res.json()) as ScanResult;
      if (!res.ok && !data.error) {
        return { success: false, error: `Scan request failed (${res.status})` };
      }
      return data;
    } catch (error) {
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

  if (sequence.length === 0) {
    return {
      success: false,
      error: 'NO_PROVIDER_CONFIGURED',
      attempts: [],
    };
  }

  let context;
  try {
    context = await buildProjectContextBridge(root);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  const prompt = SYSTEM_PRELUDE + buildScanPrompt(context);

  const attempts: ProviderAttempt[] = [];
  for (const provider of sequence) {
    const spec = getLlmProvider(provider);
    const primaryModel = modelMap.get(provider) ?? spec?.defaultModel ?? provider;
    let apiKey: string;
    try {
      apiKey = await loadProviderKey(provider);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      attempts.push({ provider, modelId: primaryModel, outcome: 'retryable', error: raw });
      continue;
    }

    // ── Attempt 1: user-preferred model (or provider default) ────────────────
    try {
      const r = await callSingleProvider(provider, apiKey, prompt, primaryModel);
      const config = parseScanResponse(r.content);
      attempts.push({ provider, modelId: primaryModel, outcome: 'success' });
      return {
        success: true,
        config,
        context,
        rawResponse: r.content,
        attempts,
        providerUsed: provider,
        usedModelId: primaryModel,
      };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      attempts.push({ provider, modelId: primaryModel, outcome: classifyProviderError(raw), error: raw });
      // Transient errors (rate limit, auth, network) → skip tier, try next provider.
      if (!isModelNotFoundError(raw)) continue;
    }

    // ── Attempt 2: same-provider tier model (model-not-found only) ───────────
    const tierModel = spec?.tierModel;
    if (!tierModel || tierModel === primaryModel) continue;

    try {
      const r = await callSingleProvider(provider, apiKey, prompt, tierModel);
      const config = parseScanResponse(r.content);
      attempts.push({ provider, modelId: tierModel, outcome: 'success' });
      return {
        success: true,
        config,
        context,
        rawResponse: r.content,
        attempts,
        providerUsed: provider,
        usedModelId: tierModel,
      };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      attempts.push({ provider, modelId: tierModel, outcome: classifyProviderError(raw), error: raw });
      // Tier also failed — fall through to next provider.
    }
  }

  // Everyone in the chain failed. Return the final error along with the
  // attempt log so the UI can render "tried 3 providers, all failed".
  const last = attempts[attempts.length - 1];
  return {
    success: false,
    error: last?.error || 'All configured providers failed',
    attempts,
  };
}
