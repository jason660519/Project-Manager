import type {
  AnyAdapterConfig,
  CandidateSheet,
  CapabilityCandidate,
  CapabilityKind,
  EngineerRole,
  RoleCapability,
} from '../types';
import { isUsable } from './state-machine';

/**
 * Capability registry (schema v7, F23).
 *
 * Owns the seed catalog of built-in candidates, adapter `supports` presets,
 * and the role × adapter × passed-candidate intersection used at dispatch.
 * The Integrations Hub sheet UIs read from this module; test runners write
 * the new state via the state machine in `state-machine.ts`.
 */

/**
 * Provider/model pairs known to support vision input. Seeded into the VLA
 * sheet on first run; users must still pass the empirical test before any
 * of these become assignable to an engineer role.
 */
const VISION_CAPABLE_MODELS: ReadonlyArray<{
  providerId: string;
  modelId: string;
  label: string;
}> = [
  { providerId: 'anthropic', modelId: 'claude-opus-4-7',           label: 'Claude Opus 4.7 (Anthropic)' },
  { providerId: 'anthropic', modelId: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Anthropic)' },
  { providerId: 'anthropic', modelId: 'claude-opus-4-1',           label: 'Claude Opus 4.1 (Anthropic)' },
  { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Anthropic)' },
  { providerId: 'openai',    modelId: 'gpt-5.5',                   label: 'GPT-5.5 (OpenAI)' },
  { providerId: 'openai',    modelId: 'gpt-4o',                    label: 'GPT-4o (OpenAI)' },
  { providerId: 'gemini',    modelId: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro (Google)' },
  { providerId: 'gemini',    modelId: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash (Google)' },
];

const FULL_CAPABILITY_SET: CapabilityKind[] = ['eyes', 'voice-tts', 'voice-stt', 'hands', 'recording'];

/**
 * Built-in adapter `supports` presets keyed by adapter id. Applied by the
 * v6 → v7 migration to existing adapter rows when they have no `supports`
 * field yet. IDEs declare an empty set — they dispatch as text only.
 */
export const BUILT_IN_ADAPTER_SUPPORTS: Readonly<Record<string, CapabilityKind[]>> = {
  // Agent CLIs.
  'claude-code': [...FULL_CAPABILITY_SET],
  'codex':       [...FULL_CAPABILITY_SET],
  'openai-cli':  [...FULL_CAPABILITY_SET],
  'cmux':        [...FULL_CAPABILITY_SET],
  // Agent apps.
  'codex-app':     [...FULL_CAPABILITY_SET],
  'anthropic-app': [...FULL_CAPABILITY_SET],
  // IDEs — no AI capability surface; text dispatch only.
  'Cursor':      [],
  'VSCode':      [],
  'Trae':        [],
  'Antigravity': [],
  'Kiro':        [],
};

/** Returns the seed candidate list installed on first v7 migration. */
export function seedBuiltInCandidates(): CapabilityCandidate[] {
  const candidates: CapabilityCandidate[] = [];

  for (const m of VISION_CAPABLE_MODELS) {
    candidates.push({
      id: `${m.providerId}:${m.modelId}`,
      sheet: 'vla',
      label: m.label,
      providerId: m.providerId,
      modelId: m.modelId,
      state: 'not_tested',
    });
  }

  candidates.push({
    id: 'macos:say',
    sheet: 'tts',
    label: 'macOS `say` (system TTS, offline)',
    state: 'not_tested',
  });

  candidates.push({
    id: 'tools:microphone:default-input',
    sheet: 'tools',
    label: 'Microphone (default input device)',
    state: 'not_tested',
    config: { kind: 'microphone' },
  });

  candidates.push({
    id: 'macos:synthetic-input',
    sheet: 'hands',
    label: 'macOS synthetic input (mouse + keyboard via enigo)',
    state: 'not_tested',
  });

  return candidates;
}

/** Merges seed candidates into existing storage, preserving any state already set on existing rows. */
export function mergeSeedCandidates(existing: CapabilityCandidate[] = []): CapabilityCandidate[] {
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const seed of seedBuiltInCandidates()) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  return [...byId.values()];
}

/** Maps a capability kind to the Integrations Hub sheet it draws candidates from. */
export function sheetForKind(kind: CapabilityKind): CandidateSheet {
  switch (kind) {
    case 'eyes':      return 'vla';
    case 'voice-tts': return 'tts';
    case 'voice-stt': return 'stt';
    case 'hands':     return 'hands';
    case 'recording': return 'tools';
  }
}

/**
 * The set of capabilities actually executable at dispatch time. Gated by:
 *   1. adapter.supports                (declared technical ceiling)
 *   2. candidate exists                (referenced row is in the registry)
 *   3. candidate.state === 'passed'    (empirical proof + user opt-in)
 *
 * Capabilities that fall through any gate are surfaced to the UI as
 * disabled-with-reason elsewhere — `effectiveCapabilities` itself only
 * returns the ones that pass all three.
 */
export function effectiveCapabilities(
  role: Pick<EngineerRole, 'capabilities'>,
  adapter: Pick<AnyAdapterConfig, 'supports'>,
  candidates: CapabilityCandidate[],
): RoleCapability[] {
  const adapterSupports = new Set(adapter.supports ?? []);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return (role.capabilities ?? []).filter((rc) => {
    if (!adapterSupports.has(rc.kind)) return false;
    const candidate = byId.get(rc.candidateId);
    if (!candidate) return false;
    return isUsable(candidate.state);
  });
}
