import { callAnthropic, callGemini, callOpenAICompatible, type AnthropicMessage } from '../bridge';
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

/** Reportable summary of one provider attempt. The UI shows these in order. */
export interface ProviderAttempt {
  provider: LlmProviderId;
  outcome: 'success' | 'retryable' | 'fatal';
  error?: string;
}

/** Result type augmented with per-provider attempt history. */
export interface FallbackScanResult extends ScanResult {
  attempts?: ProviderAttempt[];
  providerUsed?: LlmProviderId;
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

async function callProvider(
  provider: LlmProviderId,
  apiKey: string,
  fullPrompt: string,
  modelOverride?: string,
): Promise<string> {
  const r = await callSingleProvider(provider, apiKey, fullPrompt, modelOverride);
  return r.content;
}

/**
 * Run the AI project scan with provider fallback (Settings → AI providers).
 *
 * Tauri path:
 *   1. Load the user's preferred provider order (defaults to Anthropic →
 *      OpenAI → Gemini, all enabled).
 *   2. Filter out providers without a stored API key.
 *   3. Try each in turn. On success → return immediately. On retryable
 *      failure → record + try next. On fatal failure (401/403/400) →
 *      record + still try next, since the next provider's key may be valid.
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
    try {
      const apiKey = await loadProviderKey(provider);
      const content = await callProvider(provider, apiKey, prompt, modelMap.get(provider));
      const config = parseScanResponse(content);
      attempts.push({ provider, outcome: 'success' });
      return {
        success: true,
        config,
        context,
        rawResponse: content,
        attempts,
        providerUsed: provider,
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      attempts.push({ provider, outcome: classifyProviderError(raw), error: raw });
      // Always continue to the next provider — the user opted into a chain.
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
