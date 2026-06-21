/**
 * Post list-models inference probe orchestration (F56 Slice 2).
 */

import { probeProviderInference, type ProbeProviderInferenceResult } from '../bridge';
import { getLlmProvider, type LlmProviderId } from './llmProviders';
import { resolveProbeModelForProvider } from './probeModelSelection';
import type { ProviderMetadata } from './providerMetadata';
import { getProviderApiContract } from './validation';
import type { ProviderSpec } from './registry';

export interface ValidationProbeOutcome {
  metadataPatch: Partial<ProviderMetadata>;
  probe: ProbeProviderInferenceResult | null;
}

export function shouldRunInferenceProbe(provider: ProviderSpec, listModelsOk: boolean): boolean {
  if (!listModelsOk) return false;
  if (provider.category !== 'ai') return false;
  const contract = getProviderApiContract(provider);
  return contract !== null && contract.apiKind !== 'github';
}

export async function runInferenceProbeAfterValidation(args: {
  provider: ProviderSpec;
  apiKey: string;
  dynamicModels: string[];
}): Promise<ValidationProbeOutcome> {
  const { provider, apiKey, dynamicModels } = args;
  if (!shouldRunInferenceProbe(provider, true)) {
    return { metadataPatch: {}, probe: null };
  }

  const llm = getLlmProvider(provider.id as LlmProviderId);
  const model = resolveProbeModelForProvider(provider.id, dynamicModels, llm);
  const contract = getProviderApiContract(provider);
  if (!model || !contract) {
    return {
      metadataPatch: {
        probeResult: {
          status: 'skipped',
          reason: 'No probe model or API contract',
          probedAt: new Date().toISOString(),
        },
      },
      probe: null,
    };
  }

  try {
    const probe = await probeProviderInference({
      providerId: provider.id,
      model,
      apiKind: contract.apiKind,
      baseUrl: contract.baseUrl,
      apiKey,
      recordSli: true,
    });
    const probedAt = new Date().toISOString();
    if (probe.ok) {
      return {
        probe,
        metadataPatch: {
          probeResult: {
            status: 'ok',
            model: probe.model,
            latencyMs: probe.latencyMs,
            ttftMs: probe.ttftMs ?? probe.latencyMs,
            probedAt,
          },
        },
      };
    }
    return {
      probe,
      metadataPatch: {
        probeResult: {
          status: 'fail',
          model: probe.model,
          latencyMs: probe.latencyMs,
          ttftMs: probe.ttftMs ?? probe.latencyMs,
          probedAt,
          errorReason: probe.errorReason ?? 'Probe failed',
        },
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      probe: null,
      metadataPatch: {
        probeResult: {
          status: 'fail',
          model: model ?? undefined,
          probedAt: new Date().toISOString(),
          errorReason: message,
        },
      },
    };
  }
}

export function mergeValidationMetadata(args: {
  base: ProviderMetadata;
  probePatch: Partial<ProviderMetadata>;
}): ProviderMetadata {
  const probeResult = args.probePatch.probeResult ?? args.base.probeResult;
  return {
    ...args.base,
    ...args.probePatch,
    probeResult,
  };
}
