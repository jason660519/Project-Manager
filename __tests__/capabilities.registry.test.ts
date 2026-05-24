import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_ADAPTER_SUPPORTS,
  effectiveCapabilities,
  mergeSeedCandidates,
  seedBuiltInCandidates,
  sheetForKind,
} from '../lib/capabilities/registry';
import type {
  AgentAdapterConfig,
  CapabilityCandidate,
  EngineerRole,
} from '../lib/types';

const passedSonnet = (overrides: Partial<CapabilityCandidate> = {}): CapabilityCandidate => ({
  id: 'anthropic:claude-sonnet-4-6',
  sheet: 'vla',
  label: 'Claude Sonnet 4.6',
  providerId: 'anthropic',
  modelId: 'claude-sonnet-4-6',
  state: 'passed',
  ...overrides,
});

const role = (
  capabilities: NonNullable<EngineerRole['capabilities']>,
): Pick<EngineerRole, 'capabilities'> => ({ capabilities });

const adapter = (
  supports: AgentAdapterConfig['supports'],
): Pick<AgentAdapterConfig, 'supports'> => ({ supports });

describe('capability registry (F23 Step 1)', () => {
  describe('seed catalog', () => {
    it('seeds candidates across VLA, TTS, Tools, and Hands sheets in not_tested state', () => {
      const seeded = seedBuiltInCandidates();
      const sheets = new Set(seeded.map((c) => c.sheet));
      expect(sheets.has('vla')).toBe(true);
      expect(sheets.has('tts')).toBe(true);
      expect(sheets.has('tools')).toBe(true);
      expect(sheets.has('hands')).toBe(true);
      expect(seeded.every((c) => c.state === 'not_tested')).toBe(true);
    });

    it('seeds the well-known built-in IDs', () => {
      const ids = new Set(seedBuiltInCandidates().map((c) => c.id));
      expect(ids.has('macos:say')).toBe(true);
      expect(ids.has('tools:microphone:default-input')).toBe(true);
      expect(ids.has('macos:synthetic-input')).toBe(true);
      expect(ids.has('anthropic:claude-sonnet-4-6')).toBe(true);
    });

    it('mergeSeedCandidates preserves state on existing rows', () => {
      const existing: CapabilityCandidate[] = [
        passedSonnet({ state: 'passed' }),
      ];
      const merged = mergeSeedCandidates(existing);
      const sonnet = merged.find((c) => c.id === 'anthropic:claude-sonnet-4-6');
      expect(sonnet?.state).toBe('passed');
      expect(merged.length).toBeGreaterThan(existing.length);
    });

    it('mergeSeedCandidates is idempotent', () => {
      const once = mergeSeedCandidates([]);
      const twice = mergeSeedCandidates(once);
      expect(twice.length).toBe(once.length);
    });
  });

  describe('BUILT_IN_ADAPTER_SUPPORTS', () => {
    it('grants agent CLIs the full capability set', () => {
      expect(BUILT_IN_ADAPTER_SUPPORTS['claude-code']).toContain('eyes');
      expect(BUILT_IN_ADAPTER_SUPPORTS['claude-code']).toContain('voice-tts');
      expect(BUILT_IN_ADAPTER_SUPPORTS['claude-code']).toContain('voice-stt');
      expect(BUILT_IN_ADAPTER_SUPPORTS['claude-code']).toContain('hands');
      expect(BUILT_IN_ADAPTER_SUPPORTS['claude-code']).toContain('recording');
    });

    it('grants IDEs no capabilities (text dispatch only)', () => {
      expect(BUILT_IN_ADAPTER_SUPPORTS['Cursor']).toEqual([]);
      expect(BUILT_IN_ADAPTER_SUPPORTS['VSCode']).toEqual([]);
    });
  });

  describe('sheetForKind', () => {
    it('maps each capability kind to its candidate sheet', () => {
      expect(sheetForKind('eyes')).toBe('vla');
      expect(sheetForKind('voice-tts')).toBe('tts');
      expect(sheetForKind('voice-stt')).toBe('stt');
      expect(sheetForKind('hands')).toBe('hands');
      expect(sheetForKind('recording')).toBe('tools');
    });
  });

  describe('effectiveCapabilities — three-gate intersection', () => {
    const eyes = passedSonnet();
    const r = role([{ kind: 'eyes', candidateId: eyes.id }]);

    // T-04
    it('returns the capability when all three gates are open', () => {
      const a = adapter(['eyes']);
      expect(effectiveCapabilities(r, a, [eyes])).toHaveLength(1);
    });

    // T-05
    it('filters out when adapter does not declare support', () => {
      const a = adapter([]);
      expect(effectiveCapabilities(r, a, [eyes])).toHaveLength(0);
    });

    // T-06
    it('filters out when the candidate state is passed_disabled', () => {
      const a = adapter(['eyes']);
      const disabled = passedSonnet({ state: 'passed_disabled' });
      expect(effectiveCapabilities(r, a, [disabled])).toHaveLength(0);
    });

    // T-07
    it('filters out when the candidate is missing entirely', () => {
      const a = adapter(['eyes']);
      expect(effectiveCapabilities(r, a, [])).toHaveLength(0);
    });

    it('returns multiple capabilities when all gates are open for each', () => {
      const tts: CapabilityCandidate = {
        id: 'macos:say',
        sheet: 'tts',
        label: 'macOS say',
        state: 'passed',
      };
      const multi = role([
        { kind: 'eyes', candidateId: eyes.id },
        { kind: 'voice-tts', candidateId: tts.id },
      ]);
      const a = adapter(['eyes', 'voice-tts']);
      expect(effectiveCapabilities(multi, a, [eyes, tts])).toHaveLength(2);
    });
  });
});
