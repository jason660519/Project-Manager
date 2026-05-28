import { useState, useCallback, useEffect } from 'react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import { getLlmProvider } from '../../../../lib/keys/llmProviders';
import { loadProviderKey } from '../../../../lib/keys/loadProviderKey';
import { callSingleProvider } from '../../../../lib/scanner/runProjectScan';
import type { AnthropicMessage } from '../../../../lib/bridge';
import { classifyLlmArenaError, type LlmArenaErrorType } from './LlmArenaEvaluation';

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
  models: ArenaModelSpec[];
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  imageDataUrl?: string | null;
  imageDetail?: 'auto' | 'low' | 'high';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

async function callBrowserArenaProvider(args: {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; inputTokens: number; outputTokens: number; model: string; httpStatus: number | null }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: args.provider,
      model: args.model,
      systemPrompt: args.systemPrompt,
      apiKey: args.apiKey,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      messages: [{ role: 'user', content: args.userPrompt }],
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
    throw new Error(`${data?.error ?? `HTTP ${res.status}`}${details}`.trim());
  }
  const content = data?.content ?? '';
  return {
    content,
    inputTokens: typeof data?.inputTokens === 'number' ? data.inputTokens : estimateTokens(`${args.systemPrompt}\n${args.userPrompt}`),
    outputTokens: typeof data?.outputTokens === 'number' ? data.outputTokens : estimateTokens(content),
    model: data?.model || args.model,
    httpStatus: res.status,
  };
}

export function useArenaChat(storageKey?: string) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Record<string, ArenaResult>>(() => {
    if (!storageKey || typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, ArenaResult>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(results));
    } catch {}
  }, [results, storageKey]);

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

      const fullText = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;

      // Parse image if present
      let parsedImage: { mediaType: string; base64: string } | null = null;
      if (imageDataUrl) {
        const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parsedImage = { mediaType: match[1], base64: match[2] };
        }
      }

      // Create a unique key for each model attempt so we can store them side-by-side
      const promises = models.map(async (spec) => {
        const resultKey = `${spec.provider}-${spec.model}`;
        const start = performance.now();

        try {
          const apiKey = await loadProviderKey(spec.provider);
          if (!apiKey?.trim()) {
            throw new Error(`No API key saved for ${spec.provider}`);
          }

          const providerSpec = getLlmProvider(spec.provider);
          if (!providerSpec) {
            throw new Error(`Unknown provider: ${spec.provider}`);
          }

          // Browser mode has no Tauri bridge for Gemini/OpenAI-compatible providers.
          // Route pure-text LLM Arena calls through the local Next API proxy so all
          // providers use the same local-server path as Chat.
          if (!imageDataUrl && !isTauriRuntime()) {
            const response = await withTimeout(
              callBrowserArenaProvider({
                provider: spec.provider,
                apiKey,
                model: spec.model,
                systemPrompt,
                userPrompt,
                temperature,
                maxTokens,
              }),
              timeoutMs ?? 0,
              `${spec.provider}/${spec.model}`,
            );
            const latencyMs = Math.round(performance.now() - start);
            const outputLines = response.content.split(/\r?\n/).filter(Boolean);

            setResults((prev) => ({
              ...prev,
              [resultKey]: {
                provider: spec.provider,
                model: spec.model,
                requestedModel: spec.model,
                effectiveModel: response.model,
                content: response.content,
                outputLines,
                httpStatus: response.httpStatus,
                retryCount: 0,
                errorType: response.content.trim() ? 'none' : 'empty_output',
                inputTokens: response.inputTokens,
                outputTokens: response.outputTokens,
                latencyMs,
                timestamp: Date.now(),
              },
            }));
            return;
          }

          // Build messages payload based on apiKind.
          let messages: AnthropicMessage[] = [];
          if (!imageDataUrl) {
            messages = [{ role: 'user', content: fullText }];
          } else if (providerSpec.apiKind === 'anthropic') {
            const contentBlocks: any[] = [];
            if (parsedImage) {
              contentBlocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: parsedImage.mediaType,
                  data: parsedImage.base64,
                },
              });
            }
            contentBlocks.push({ type: 'text', text: fullText });
            messages = [{ role: 'user', content: contentBlocks }];
          } else if (providerSpec.apiKind === 'gemini') {
            const parts: any[] = [];
            parts.push({ text: fullText });
            if (parsedImage) {
              parts.push({
                inlineData: {
                  mimeType: parsedImage.mediaType,
                  data: parsedImage.base64,
                },
              });
            }
            messages = [{ role: 'user', content: parts }];
          } else {
            // openai-compatible
            const contentBlocks: any[] = [];
            contentBlocks.push({ type: 'text', text: fullText });
            if (imageDataUrl) {
              contentBlocks.push({
                type: 'image_url',
                image_url: {
                  url: imageDataUrl,
                  detail: imageDetail,
                },
              });
            }
            messages = [{ role: 'user', content: contentBlocks }];
          }

          const response = await withTimeout(
            callSingleProvider(
              spec.provider,
              apiKey,
              messages,
              spec.model,
              temperature,
              maxTokens
            ),
            timeoutMs ?? 0,
            `${spec.provider}/${spec.model}`,
          );
          const latencyMs = Math.round(performance.now() - start);
          const outputLines = response.content.split(/\r?\n/).filter(Boolean);

          setResults((prev) => ({
            ...prev,
            [resultKey]: {
              provider: spec.provider,
              model: spec.model,
              requestedModel: spec.model,
              effectiveModel: response.model,
              content: response.content,
              outputLines,
              httpStatus: 200,
              retryCount: 0,
              errorType: response.content.trim() ? 'none' : 'empty_output',
              inputTokens: response.inputTokens,
              outputTokens: response.outputTokens,
              latencyMs,
              timestamp: Date.now(),
            },
          }));
        } catch (error) {
          const latencyMs = Math.round(performance.now() - start);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorType = classifyLlmArenaError(error);
          console.error('[llm-arena] provider run failed', {
            provider: spec.provider,
            model: spec.model,
            errorType,
            message: errorMessage,
          });
          setResults((prev) => ({
            ...prev,
            [resultKey]: {
              provider: spec.provider,
              model: spec.model,
              requestedModel: spec.model,
              effectiveModel: '',
              outputLines: [errorMessage],
              httpStatus: null,
              retryCount: 0,
              errorType,
              error: errorMessage,
              latencyMs,
              timestamp: Date.now(),
            },
          }));
        }
      });

      await Promise.allSettled(promises);
      setIsRunning(false);
    },
    []
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
