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

export interface RescanSummary {
  scanned: number;
  skipped: number;
  newModels: number;
  failed: Array<{ id: LlmProviderId; reason: string }>;
}

const STATIC_MODELS_BY_ID = new Map<LlmProviderId, readonly string[]>(
  listLlmProviders().map((provider) => [provider.id, provider.availableModels]),
);

function knownModelsBefore(id: LlmProviderId): Set<string> {
  const meta = loadProviderMetadata(id);
  const dynamic = meta?.status === 'ok' ? meta.dynamicModels ?? [] : [];
  return new Set(mergeCuratedAndDynamicModels(STATIC_MODELS_BY_ID.get(id) ?? [], dynamic));
}

export async function rescanAiProviderModels(ids: readonly LlmProviderId[]): Promise<RescanSummary> {
  const summary: RescanSummary = { scanned: 0, skipped: 0, newModels: 0, failed: [] };

  for (const id of ids) {
    try {
      const spec = getProvider(id);
      if (!spec) {
        summary.failed.push({ id, reason: 'Unknown provider' });
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
        summary.failed.push({ id, reason: result.errorReason ?? 'Validation failed' });
      }
    } catch (err) {
      summary.failed.push({ id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return summary;
}
