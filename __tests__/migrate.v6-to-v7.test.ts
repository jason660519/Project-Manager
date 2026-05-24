import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from '../lib/storage/migrate';
import type { CapabilityCandidate, EngineerRole, ProjectManagerConfig } from '../lib/types';

const baseV6 = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 6,
  id: 'project-test',
  project: { name: 'P', root: '/r', defaultIDE: 'Cursor' },
  features: [],
  adapters: {
    ides: [{ id: 'Cursor', name: 'Cursor', type: 'ide', command: 'cursor' }],
    agents: [{
      id: 'claude-code',
      name: 'Claude Code',
      type: 'agent',
      command: 'claude',
      argsTemplate: [],
    }],
  },
  engineerRoles: [
    {
      id: 'role-frontend',
      name: 'Frontend Engineer',
      slug: 'frontend',
      skills: ['React'],
      commands: [],
      systemPrompt: 'You are a frontend engineer',
      referenceFiles: [],
    },
  ],
  ...overrides,
});

describe('migrate v6 → v7 (F23 engineer capabilities)', () => {
  // T-01 + bump verification
  it('exposes 7 as the current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(7);
  });

  it('bumps schemaVersion to 7 on a v6 document', () => {
    const out = migrateConfig(baseV6());
    expect(out.schemaVersion).toBe(7);
  });

  it('adds capabilities:[] to every engineer role', () => {
    const out = migrateConfig(baseV6()) as ProjectManagerConfig;
    const roles = out.engineerRoles ?? [];
    expect(roles).toHaveLength(1);
    expect((roles[0] as EngineerRole).capabilities).toEqual([]);
  });

  it('annotates built-in adapters with their declared supports preset', () => {
    const out = migrateConfig(baseV6());
    const cursor = out.adapters.ides.find((a) => a.id === 'Cursor');
    const claude = out.adapters.agents.find((a) => a.id === 'claude-code');
    expect(cursor?.supports).toEqual([]);
    expect(claude?.supports).toContain('eyes');
    expect(claude?.supports).toContain('voice-tts');
    expect(claude?.supports).toContain('hands');
  });

  it('seeds capabilityCandidates with VLA / TTS / Tools / Hands rows in not_tested', () => {
    const out = migrateConfig(baseV6()) as ProjectManagerConfig;
    const cand = out.capabilityCandidates ?? [];
    expect(cand.some((c: CapabilityCandidate) => c.sheet === 'vla')).toBe(true);
    expect(cand.some((c: CapabilityCandidate) => c.id === 'macos:say')).toBe(true);
    expect(cand.some((c: CapabilityCandidate) => c.id === 'tools:microphone:default-input')).toBe(true);
    expect(cand.some((c: CapabilityCandidate) => c.id === 'macos:synthetic-input')).toBe(true);
    expect(cand.every((c: CapabilityCandidate) => c.state === 'not_tested')).toBe(true);
  });

  // T-02
  it('is idempotent on a v7 document', () => {
    const v7 = migrateConfig(baseV6()) as ProjectManagerConfig;
    const v7Again = migrateConfig(v7) as ProjectManagerConfig;
    expect(v7Again.schemaVersion).toBe(7);
    expect(v7Again.capabilityCandidates?.length).toBe(v7.capabilityCandidates?.length);
  });

  it('does not overwrite an existing supports preset on an adapter', () => {
    const cfg = baseV6({
      adapters: {
        ides: [],
        agents: [{
          id: 'claude-code',
          name: 'Claude Code',
          type: 'agent',
          command: 'claude',
          argsTemplate: [],
          supports: ['eyes'],
        }],
      },
    });
    const out = migrateConfig(cfg);
    const claude = out.adapters.agents.find((a) => a.id === 'claude-code');
    expect(claude?.supports).toEqual(['eyes']);
  });

  it('preserves existing capabilityCandidates state during seed merge', () => {
    const cfg = baseV6({
      capabilityCandidates: [
        {
          id: 'anthropic:claude-sonnet-4-6',
          sheet: 'vla',
          label: 'Sonnet 4.6',
          state: 'passed',
        },
      ],
    });
    const out = migrateConfig(cfg) as ProjectManagerConfig;
    const sonnet = (out.capabilityCandidates ?? []).find(
      (c) => c.id === 'anthropic:claude-sonnet-4-6',
    );
    expect(sonnet?.state).toBe('passed');
  });

  it('handles a v6 config with no engineerRoles array', () => {
    const cfg = baseV6();
    delete (cfg as Record<string, unknown>).engineerRoles;
    const out = migrateConfig(cfg);
    expect(out.schemaVersion).toBe(7);
  });
});
