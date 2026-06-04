import { appendPmOperationLog, isTauriRuntime } from '../bridge';
import type { ValidationFailureCategory } from '../keys/providerMetadata';

export interface AiSdksRescanLogEntry {
  providerId: string;
  category: ValidationFailureCategory;
  reason: string;
  scope: 'provider' | 'all';
}

function redactSecrets(text: string): string {
  return text
    .replace(/\borg-[A-Za-z0-9_-]{8,}\b/g, 'org-...')
    .replace(/\bak-[A-Za-z0-9_-]{8,}\b/g, 'ak-...')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{8,}\b/g, 'sk-ant-...')
    .replace(/\bsk-or-[A-Za-z0-9_-]{8,}\b/g, 'sk-or-...')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-...')
    .replace(/\bxai-[A-Za-z0-9_-]{8,}\b/g, 'xai-...')
    .replace(/\bpplx-[A-Za-z0-9_-]{8,}\b/g, 'pplx-...');
}

export async function logAiSdksRescanFailure(entry: AiSdksRescanLogEntry): Promise<void> {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event: 'ai_sdks_rescan_failed',
    providerId: entry.providerId,
    category: entry.category,
    reason: redactSecrets(entry.reason),
    scope: entry.scope,
  });

  if (isTauriRuntime()) {
    try {
      await appendPmOperationLog('ai-sdks-rescan', line);
      return;
    } catch (err) {
      console.warn('[ai-sdks-rescan] failed to append operation log:', err);
    }
  }

  console.warn('[ai-sdks-rescan]', line);
}
