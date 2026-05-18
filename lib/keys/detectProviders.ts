import type { ParsedEnvEntry } from './envParser';
import { PROVIDERS, type ProviderSpec } from './registry';

export type DetectionStatus = 'valid' | 'pattern-mismatch' | 'empty';

export interface DetectedKey {
  provider: ProviderSpec;
  /** The env var name we matched against (e.g. `ANTHROPIC_API_KEY`). */
  envKey: string;
  value: string;
  /** Source line in the original .env for UI hover/debugging. */
  line: number;
  status: DetectionStatus;
}

/**
 * Match parsed .env entries against the provider registry.
 *
 * Rules:
 *   - First env var name in `provider.envVarNames` that appears in the input
 *     wins (priority order matters: `ANTHROPIC_API_KEY` beats `CLAUDE_API_KEY`).
 *   - Each provider yields at most one DetectedKey.
 *   - If a provider has a `validatePattern` and the value fails it, status is
 *     `pattern-mismatch` — the UI should warn but still let the user confirm
 *     (people use proxies / sandbox tokens that don't match the canonical
 *     pattern).
 */
export function detectProviders(entries: ParsedEnvEntry[]): DetectedKey[] {
  const lookup = new Map<string, ParsedEnvEntry>();
  for (const e of entries) lookup.set(e.key, e);

  const out: DetectedKey[] = [];
  for (const provider of PROVIDERS) {
    let match: ParsedEnvEntry | undefined;
    let matchedName: string | undefined;
    for (const candidate of provider.envVarNames) {
      const hit = lookup.get(candidate);
      if (hit) {
        match = hit;
        matchedName = candidate;
        break;
      }
    }
    if (!match || !matchedName) continue;

    let status: DetectionStatus = 'valid';
    if (match.value.length === 0) status = 'empty';
    else if (provider.validatePattern && !provider.validatePattern.test(match.value)) {
      status = 'pattern-mismatch';
    }

    out.push({
      provider,
      envKey: matchedName,
      value: match.value,
      line: match.line,
      status,
    });
  }
  return out;
}
