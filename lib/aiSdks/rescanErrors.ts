import type { LlmProviderId } from '../keys/llmProviders';
import {
  classifyValidationFailure,
  formatValidationFailure,
  type ValidationFailureCategory,
  type ValidationFailureSummary,
} from '../keys/providerMetadata';

export interface RescanFailure {
  id: LlmProviderId;
  reason: string;
  category: ValidationFailureCategory;
  summary: ValidationFailureSummary;
}

export function buildRescanFailure(id: LlmProviderId, reason: string): RescanFailure {
  const summary = classifyValidationFailure(reason);
  return { id, reason, category: summary.category, summary };
}

export function formatRescanFailureLine(
  failure: RescanFailure,
  providerLabel: string,
): string {
  return `${providerLabel}: ${formatValidationFailure(failure.reason)}`;
}

export function formatRescanFailureNotice(
  failures: readonly RescanFailure[],
  providerLabelById: ReadonlyMap<LlmProviderId, string>,
): string {
  return failures
    .map((f) =>
      formatRescanFailureLine(
        f,
        providerLabelById.get(f.id) ?? f.id,
      ),
    )
    .join('\n');
}
