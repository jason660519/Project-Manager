import type { LlmRouteAttempt, LlmRouteDecision } from '../bridge';

export interface RouteFallbackLine {
  provider: string;
  model: string;
  kind: 'failed' | 'skipped_cooldown';
  reason: string;
}

export interface RouteFallbackBannerContent {
  failedLines: RouteFallbackLine[];
  selectedProvider: string;
  selectedModel: string;
}

export function formatProviderModel(provider: string, model?: string): string {
  const trimmedModel = model?.trim();
  return trimmedModel ? `${provider} · ${trimmedModel}` : provider;
}

export function summarizeRouteError(reason?: string, maxLen = 140): string {
  const raw = reason?.trim();
  if (!raw) return 'Unknown error';

  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { message?: string; code?: number | string };
        message?: string;
      };
      const message = parsed.error?.message ?? parsed.message;
      if (typeof message === 'string' && message.trim()) {
        const code = parsed.error?.code;
        const prefix = code != null ? `${code}: ` : '';
        return truncate(`${prefix}${message.trim()}`, maxLen);
      }
    } catch {}
  }

  const oneLine = raw.replace(/\s+/g, ' ').trim();
  const statusMatch = /(\d{3}\s+[A-Za-z ]+:?)/.exec(oneLine);
  if (statusMatch) {
    const tail = oneLine.slice(statusMatch.index + statusMatch[0].length).trim();
    if (tail) return truncate(`${statusMatch[1].trim()} ${tail}`, maxLen);
  }

  return truncate(oneLine, maxLen);
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

export function buildRouteFallbackBannerContent(
  decision: LlmRouteDecision,
): RouteFallbackBannerContent | null {
  if (!decision.degraded) return null;

  const failedLines = decision.attempts
    .filter((attempt): attempt is LlmRouteAttempt & { status: 'failed' | 'skipped_cooldown' } =>
      attempt.status === 'failed' || attempt.status === 'skipped_cooldown',
    )
    .map((attempt) => ({
      provider: attempt.provider,
      model: attempt.model,
      kind: attempt.status,
      reason: summarizeRouteError(attempt.errorReason),
    }));

  if (failedLines.length === 0) return null;

  return {
    failedLines,
    selectedProvider: decision.selectedProvider,
    selectedModel: decision.selectedModel,
  };
}
