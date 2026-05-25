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
