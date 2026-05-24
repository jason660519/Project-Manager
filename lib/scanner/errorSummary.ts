import type { ProviderAttempt } from './runProjectScan';

function oneLine(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function redactSensitiveTokens(raw: string): string {
  return raw
    .replace(/\\u003c[^\\]+\\u003e/g, '<redacted>')
    .replace(/<[^>]*(?:sk|ak|key|org)[^>]*>/gi, '<redacted>')
    .replace(/\borg-[A-Za-z0-9_-]{8,}\b/g, 'org-...')
    .replace(/\bak-[A-Za-z0-9_-]{8,}\b/g, 'ak-...')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{8,}\b/g, 'sk-ant-...')
    .replace(/\bsk-or-[A-Za-z0-9_-]{8,}\b/g, 'sk-or-...')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-...')
    .replace(/\bxai-[A-Za-z0-9_-]{8,}\b/g, 'xai-...')
    .replace(/\bpplx-[A-Za-z0-9_-]{8,}\b/g, 'pplx-...');
}

export function summarizeScanError(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const safe = redactSensitiveTokens(oneLine(raw));

  const modelMatch = safe.match(/Model not found:?\s*["']?([^"',}\]\s]+)?/i);
  if (modelMatch?.[1]) return `Model not found: ${modelMatch[1]}`;
  if (/model not found/i.test(safe)) return 'Model not found';

  if (/credit balance is too low|insufficient credits|payment required|\b402\b/i.test(safe)) {
    return 'Billing/credits issue';
  }
  if (/suspended/i.test(safe)) {
    return 'Account suspended or unavailable';
  }
  if (/too many requests|\b429\b|rate limit|insufficient quota/i.test(safe)) {
    return 'Rate limit or quota issue';
  }
  if (/JSON Parse error|unterminated string|unexpected end|invalid json/i.test(safe)) {
    return 'Provider returned malformed JSON';
  }
  if (/invalid[_ -]?api[_ -]?key|unauthori[sz]ed|\b401\b|\b403\b/i.test(safe)) {
    return 'Authentication failed';
  }
  if (/timed out|timeout/i.test(safe)) {
    return 'Timed out';
  }
  if (/invalid[_ -]?request|bad request|\b400\b/i.test(safe)) {
    return 'Invalid request';
  }

  return safe.length > 120 ? `${safe.slice(0, 117)}...` : safe;
}

export function formatProviderAttempt(attempt: Pick<ProviderAttempt, 'provider' | 'modelId'>): string {
  return attempt.modelId ? `${attempt.provider}/${attempt.modelId}` : attempt.provider;
}

export function formatAttemptFailure(attempt: ProviderAttempt): string {
  const target = formatProviderAttempt(attempt);
  const error = summarizeScanError(attempt.error);
  return error ? `${target} (${error})` : target;
}
