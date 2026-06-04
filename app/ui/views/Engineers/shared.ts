/**
 * Shared helpers for the Engineers view (table + sheet refactor).
 *
 * Kept in its own module so the table components and the slide-in detail
 * sheet can import without a circular dependency on `EngineersView.tsx`.
 */

import type { CapabilityKind } from '../../../../lib/types';

export type EngineersTab = 'ai_engineers' | 'ability_tools';

export const DEFAULT_ENGINEERS_TAB: EngineersTab = 'ai_engineers';

const SLUG_COLORS: Record<string, string> = {
  frontend:  'border-cyan-300/35 text-cyan-300/80',
  backend:   'border-emerald-300/35 text-emerald-300/80',
  fullstack: 'border-violet-300/35 text-violet-300/80',
  qa:        'border-amber-300/35 text-amber-300/80',
  devops:    'border-orange-300/35 text-orange-300/80',
  devex:     'border-sky-300/35 text-sky-300/80',
};

export function slugColor(slug: string): string {
  return SLUG_COLORS[slug] ?? 'border-stone-300/35 text-stone-300/80';
}

export function uid(): string {
  return typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export const CAPABILITY_KINDS: readonly CapabilityKind[] = [
  'eyes',
  'voice-tts',
  'voice-stt',
  'hands',
  'recording',
];

export const CAPABILITY_LABELS: Record<CapabilityKind, string> = {
  'eyes':      'Eyes',
  'voice-tts': 'Voice TTS',
  'voice-stt': 'Voice STT',
  'hands':     'Hands',
  'recording': 'Recording',
};

/**
 * Per-engineer command allowlist semantics: a role's `commands` is a *subset*
 * of the globally exposed System CLI commands (see `lib/storage/system-cli.ts`).
 *
 * `active`  — selected commands still present in the global exposure list.
 * `stale`   — selected commands that are no longer globally exposed. We surface
 *             these loudly (never silently drop) so the user can re-expose them
 *             in the Integrations Hub or remove them from the role.
 *
 * Inputs are normalized (trimmed, de-duplicated) and the result is sorted for a
 * stable display + dispatch order. This is a pure function so both the table
 * cell and the detail-sheet editor can share it without a React dependency.
 */
export interface PartitionedCommands {
  active: string[];
  stale: string[];
}

export function partitionEngineerCommands(
  selected: readonly string[] | undefined,
  exposed: readonly string[] | undefined,
): PartitionedCommands {
  const exposedSet = new Set((exposed ?? []).map((c) => c.trim()).filter(Boolean));
  const seen = new Set<string>();
  const active: string[] = [];
  const stale: string[] = [];
  for (const raw of selected ?? []) {
    const cmd = raw.trim();
    if (!cmd || seen.has(cmd)) continue;
    seen.add(cmd);
    (exposedSet.has(cmd) ? active : stale).push(cmd);
  }
  const byName = (a: string, b: string) => a.localeCompare(b);
  return { active: active.sort(byName), stale: stale.sort(byName) };
}
