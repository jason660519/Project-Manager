/**
 * AI SDKs model-list rescan orchestration.
 *
 * This reuses the Keys page validation path: stored provider keys are checked
 * with the existing provider validation helper, which refreshes shared
 * providerMetadata with dynamic model lists. AI SDKs only reads that metadata,
 * so parameter overrides remain untouched.
 */

import { listLlmProviders, type LlmProviderId } from '../keys/llmProviders';
import { getProvider } from '../keys/registry';
import { hasProviderKeyInStore } from '../keys/providerKeyStore';
import { loadProviderMetadata, mergeCuratedAndDynamicModels } from '../keys/providerMetadata';
import { revalidateStoredKey } from '../keys/validation';
import { buildRescanFailure, type RescanFailure } from './rescanErrors';
import { logAiSdksRescanFailure } from './rescanLog';

export interface RescanSummary {
  scanned: number;
  skipped: number;
  newModels: number;
  failed: RescanFailure[];
}

const STATIC_MODELS_BY_ID = new Map<LlmProviderId, readonly string[]>(
  listLlmProviders().map((provider) => [provider.id, provider.availableModels]),
);

function knownModelsBefore(id: LlmProviderId): Set<string> {
  const meta = loadProviderMetadata(id);
  const dynamic = meta?.status === 'ok' ? meta.dynamicModels ?? [] : [];
  return new Set(mergeCuratedAndDynamicModels(STATIC_MODELS_BY_ID.get(id) ?? [], dynamic));
}

async function recordRescanFailure(
  summary: RescanSummary,
  id: LlmProviderId,
  reason: string,
  scope: 'provider' | 'all',
): Promise<void> {
  const failure = buildRescanFailure(id, reason);
  summary.failed.push(failure);
  await logAiSdksRescanFailure({
    providerId: id,
    category: failure.category,
    reason: failure.reason,
    scope,
  });
}

export async function rescanAiProviderModels(
  ids: readonly LlmProviderId[],
  options: { scope?: 'provider' | 'all' } = {},
): Promise<RescanSummary> {
  const scope = options.scope ?? (ids.length > 1 ? 'all' : 'provider');
  const summary: RescanSummary = { scanned: 0, skipped: 0, newModels: 0, failed: [] };

  for (const id of ids) {
    try {
      const spec = getProvider(id);
      if (!spec) {
        await recordRescanFailure(summary, id, 'Unknown provider', scope);
        continue;
      }

      if (!(await hasProviderKeyInStore(id))) {
        summary.skipped += 1;
        continue;
      }

      const before = knownModelsBefore(id);
      const result = await revalidateStoredKey(spec);
      if (result.ok) {
        summary.scanned += 1;
        summary.newModels += result.models.filter((model) => !before.has(model.trim())).length;
      } else {
        await recordRescanFailure(
          summary,
          id,
          result.errorReason ?? 'Validation failed',
          scope,
        );
      }
    } catch (err) {
      await recordRescanFailure(
        summary,
        id,
        err instanceof Error ? err.message : String(err),
        scope,
      );
    }
  }

  return summary;
}
