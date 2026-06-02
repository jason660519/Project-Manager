import type { ParsedEnvEntry } from './envParser';
import { PROVIDERS, type ProviderSpec } from './registry';

export type DetectionStatus = 'valid' | 'pattern-mismatch' | 'empty';
export type DetectionMatchSource = 'explicit' | 'generated';

export interface DetectedKey {
  provider: ProviderSpec;
  /** The env var name we matched against (e.g. `ANTHROPIC_API_KEY`). */
  envKey: string;
  value: string;
  /** Source line in the original .env for UI hover/debugging. */
  line: number;
  status: DetectionStatus;
  /** Whether the match came from registry/profile aliases or generated provider aliases. */
  matchSource: DetectionMatchSource;
}

export interface UndetectedEnvKey {
  key: string;
  line: number;
  reason: string;
}

const SECRET_SUFFIXES = [
  'API_KEY',
  'AI_API_KEY',
  'TOKEN',
  'ACCESS_TOKEN',
  'PERSONAL_ACCESS_TOKEN',
  'TRIAL_KEY',
  'PRODUCTION_KEY',
] as const;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function envToken(value: string): string {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function providerAliasTokens(provider: ProviderSpec): string[] {
  const keychainBase = provider.keychainKey
    .replace(/-(api-key|token)$/i, '')
    .replace(/-/g, '_');

  return unique([
    envToken(provider.id),
    envToken(provider.label),
    envToken(keychainBase),
    ...provider.envVarNames.map((name) =>
      envToken(name.replace(/_(API_KEY|AI_API_KEY|TOKEN|ACCESS_TOKEN|PERSONAL_ACCESS_TOKEN|TRIAL_KEY|PRODUCTION_KEY)$/i, '')),
    ),
  ]);
}

/**
 * Build the full set of env names PM should consider for one provider.
 *
 * Explicit registry/profile aliases stay first so provider-owned priority still
 * wins. Generated aliases cover common user naming conventions such as
 * `MISTRAL_AI_API_KEY`, `COHERE_TRIAL_KEY`, and
 * `GITHUB_PERSONAL_ACCESS_TOKEN` without needing a code change for every
 * future provider row.
 */
export function buildProviderEnvVarCandidates(provider: ProviderSpec): Array<{
  name: string;
  source: DetectionMatchSource;
}> {
  const explicit = unique(provider.envVarNames.map((name) => envToken(name)));
  const generated = providerAliasTokens(provider).flatMap((alias) =>
    SECRET_SUFFIXES.map((suffix) => `${alias}_${suffix}`),
  );

  const out: Array<{ name: string; source: DetectionMatchSource }> = [];
  const seen = new Set<string>();
  for (const name of explicit) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, source: 'explicit' });
  }
  for (const name of generated) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, source: 'generated' });
  }
  return out;
}

function looksLikeCredentialEnvKey(key: string): boolean {
  return SECRET_SUFFIXES.some((suffix) => key.endsWith(`_${suffix}`));
}

/**
 * Match parsed .env entries against the provider registry.
 *
 * Rules:
 *   - First explicit env var name in `provider.envVarNames` that appears in the
 *     input wins (priority order matters: `ANTHROPIC_API_KEY` beats
 *     `CLAUDE_API_KEY`).
 *   - If no explicit alias matches, PM falls back to generated provider aliases
 *     derived from provider id, label, and keychain key.
 *   - Each provider yields at most one DetectedKey.
 *   - If a provider has a `validatePattern` and the value fails it, status is
 *     `pattern-mismatch` — the UI should warn but still let the user confirm
 *     (people use proxies / sandbox tokens that don't match the canonical
 *     pattern).
 */
export function detectProviders(entries: ParsedEnvEntry[], providers: ProviderSpec[] = PROVIDERS): DetectedKey[] {
  const lookup = new Map<string, ParsedEnvEntry>();
  for (const e of entries) lookup.set(envToken(e.key), e);

  const out: DetectedKey[] = [];
  for (const provider of providers) {
    let match: ParsedEnvEntry | undefined;
    let matchedCandidate: { name: string; source: DetectionMatchSource } | undefined;
    for (const candidate of buildProviderEnvVarCandidates(provider)) {
      const hit = lookup.get(candidate.name);
      if (hit) {
        match = hit;
        matchedCandidate = candidate;
        break;
      }
    }
    if (!match || !matchedCandidate) continue;

    let status: DetectionStatus = 'valid';
    if (match.value.length === 0) status = 'empty';
    else if (provider.validatePattern && !provider.validatePattern.test(match.value)) {
      status = 'pattern-mismatch';
    }

    out.push({
      provider,
      envKey: match.key,
      value: match.value,
      line: match.line,
      status,
      matchSource: matchedCandidate.source,
    });
  }
  return out;
}

export function findUndetectedProviderEnvKeys(
  entries: ParsedEnvEntry[],
  detected: DetectedKey[],
  providers: ProviderSpec[] = PROVIDERS,
): UndetectedEnvKey[] {
  const matchedKeys = new Set(detected.map((item) => envToken(item.envKey)));
  const knownCandidates = new Set(
    providers.flatMap((provider) => buildProviderEnvVarCandidates(provider).map((candidate) => candidate.name)),
  );

  return entries
    .filter((entry) => looksLikeCredentialEnvKey(envToken(entry.key)))
    .filter((entry) => !matchedKeys.has(envToken(entry.key)))
    .map((entry) => ({
      key: entry.key,
      line: entry.line,
      reason: knownCandidates.has(envToken(entry.key))
        ? 'Provider is disabled in the import profile.'
        : 'No enabled provider alias matched this credential-like env var.',
    }));
}
