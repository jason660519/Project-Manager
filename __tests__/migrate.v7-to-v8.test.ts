import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from '../lib/storage/migrate';
import type { CronJob, ProjectManagerConfig } from '../lib/types';

const baseV7 = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 7,
  id: 'project-test',
  project: { name: 'P', root: '/r', defaultIDE: 'Cursor' },
  features: [],
  adapters: {
    ides:   [{ id: 'Cursor', name: 'Cursor', type: 'ide',   command: 'cursor', supports: [] }],
    agents: [{ id: 'claude-code', name: 'Claude Code', type: 'agent', command: 'claude', argsTemplate: [], supports: ['eyes'] }],
  },
  engineerRoles: [],
  capabilityCandidates: [],
  ...overrides,
});

const sampleRunCommandJob = (): CronJob => ({
  id: 'job-1',
  name: 'Nightly sync',
  enabled: true,
  schedule: { type: 'every', value: 6, unit: 'hours' },
  action: { type: 'run-command', command: 'git', args: ['fetch', '--all'], workingDir: '/r' },
  createdAt: '2026-05-01T00:00:00.000Z',
});

describe('migrate v7 → v8 (ADR-012 engineer cron dispatch)', () => {
  it('exposes 10 as the current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(10);
  });

  it('bumps schemaVersion to the current version on a v7 document', () => {
    const out = migrateConfig(baseV7());
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('preserves existing run-command cron jobs untouched', () => {
    const job = sampleRunCommandJob();
    const out = migrateConfig(baseV7({ cronJobs: [job] })) as ProjectManagerConfig;
    expect(out.cronJobs).toHaveLength(1);
    expect(out.cronJobs?.[0]).toMatchObject({
      id: 'job-1',
      action: { type: 'run-command', command: 'git', args: ['fetch', '--all'], workingDir: '/r' },
    });
  });

  it('back-fills action.type to run-command on a malformed legacy row', () => {
    // Hypothetical legacy row missing action.type
    const malformed = {
      ...sampleRunCommandJob(),
      action: { command: 'git', args: [], workingDir: '/r' },
    };
    const out = migrateConfig(baseV7({ cronJobs: [malformed] })) as ProjectManagerConfig;
    expect(out.cronJobs?.[0]?.action?.type).toBe('run-command');
  });

  it('handles a v7 config with no cronJobs key', () => {
    const cfg = baseV7();
    delete (cfg as Record<string, unknown>).cronJobs;
    const out = migrateConfig(cfg);
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.cronJobs).toBeUndefined();
  });

  it('handles a v7 config with empty cronJobs array', () => {
    const out = migrateConfig(baseV7({ cronJobs: [] })) as ProjectManagerConfig;
    expect(out.cronJobs).toEqual([]);
  });

  it('is idempotent — re-running migrate on a v8 result is a no-op', () => {
    const first  = migrateConfig(baseV7({ cronJobs: [sampleRunCommandJob()] })) as ProjectManagerConfig;
    const second = migrateConfig(first) as ProjectManagerConfig;
    expect(second.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(second.cronJobs).toEqual(first.cronJobs);
  });

  it('preserves a v7 dispatch-engineer cron job synthesised post-hoc (forward-compat)', () => {
    // Defensive: if a future client wrote a dispatch-engineer row into a v7 file,
    // the migration should not mangle it.
    const dispatchJob = {
      ...sampleRunCommandJob(),
      id: 'job-engineer',
      action: {
        type: 'dispatch-engineer',
        roleId: 'role-frontend',
        promptTemplate: 'Review the diff',
      },
    };
    const out = migrateConfig(baseV7({ cronJobs: [dispatchJob] })) as ProjectManagerConfig;
    expect(out.cronJobs?.[0]?.action).toMatchObject({
      type: 'dispatch-engineer',
      roleId: 'role-frontend',
      promptTemplate: 'Review the diff',
    });
  });
});
