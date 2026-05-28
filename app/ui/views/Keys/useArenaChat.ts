import { useState, useCallback, useEffect } from 'react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import { getLlmProvider } from '../../../../lib/keys/llmProviders';
import { loadProviderKey } from '../../../../lib/keys/loadProviderKey';
import { callSingleProvider } from '../../../../lib/scanner/runProjectScan';
import type { AnthropicMessage } from '../../../../lib/bridge';

export interface ArenaModelSpec {
  provider: LlmProviderId;
  model: string;
}

export interface ArenaResult {
  provider: LlmProviderId;
  model: string;
  content?: string;
  error?: string;
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
  imageDataUrl?: string | null;
  imageDetail?: 'auto' | 'low' | 'high';
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

          // Build messages payload based on apiKind
          let messages: AnthropicMessage[] = [];
          if (providerSpec.apiKind === 'anthropic') {
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

          const response = await callSingleProvider(
            spec.provider,
            apiKey,
            messages,
            spec.model,
            temperature,
            maxTokens
          );
          const latencyMs = Math.round(performance.now() - start);

          setResults((prev) => ({
            ...prev,
            [resultKey]: {
              provider: spec.provider,
              model: spec.model,
              content: response.content,
              inputTokens: response.inputTokens,
              outputTokens: response.outputTokens,
              latencyMs,
              timestamp: Date.now(),
            },
          }));
        } catch (error) {
          const latencyMs = Math.round(performance.now() - start);
          setResults((prev) => ({
            ...prev,
            [resultKey]: {
              provider: spec.provider,
              model: spec.model,
              error: error instanceof Error ? error.message : String(error),
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
