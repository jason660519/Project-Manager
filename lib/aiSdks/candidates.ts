/**
 * Candidate models — the bridge from the AI SDKs sheets to the AI Assistant.
 *
 * A model row is a "candidate" when the user ticks its checkbox in the AI SDKs
 * view (`store.models[id].candidate === true`). The AI Assistant's chat model
 * picker surfaces these as a curated quick-pick list, so users choose from the
 * models they've vetted rather than the full provider × model matrix.
 *
 * Pure + server-safe: takes an already-loaded `AiSdksConfig` and reads only the
 * static catalog (no window/bridge), so it is easy to test and reuse.
 */

import { listLlmProviders, type LlmProviderId } from '../keys/llmProviders';
import { buildModelCatalog, type ModelType } from './catalog';
import type { AiSdksConfig } from './store';

export interface CandidateModel {
  /** UUIDv5 col-id of the model row. */
  id: string;
  providerId: LlmProviderId;
  providerLabel: string;
  model: string;
  modelType: ModelType;
}

/**
 * Every model the user has marked as a candidate, across all providers —
 * catalog models and user-added custom models. Stable order: catalog order,
 * then custom models.
 */
export function listCandidateModels(store: AiSdksConfig): CandidateModel[] {
  const out: CandidateModel[] = [];

  for (const row of buildModelCatalog()) {
    if (store.models[row.id]?.candidate === true) {
      out.push({
        id: row.id,
        providerId: row.providerId,
        providerLabel: row.providerLabel,
        model: row.model,
        modelType: store.models[row.id]?.modelType ?? row.modelType,
      });
    }
  }

  const labelFor = new Map(listLlmProviders().map((p) => [p.id, p.label] as const));
  for (const m of store.customModels) {
    if (store.models[m.id]?.candidate === true) {
      out.push({
        id: m.id,
        providerId: m.providerId,
        providerLabel: labelFor.get(m.providerId) ?? m.providerId,
        model: m.model,
        modelType: store.models[m.id]?.modelType ?? m.modelType ?? 'LLM',
      });
    }
  }

  return out;
}
