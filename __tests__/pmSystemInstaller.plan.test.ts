import { describe, expect, it } from 'vitest';
import {
  getMaintenancePolicy,
  planPmSystemInstall,
  PM_SYSTEM_COMMANDS,
  toRendererSafeBackendProfile,
  type InstallerPreflight,
} from '../infra/supabase/pm-system-installer';

const readyPreflight: InstallerPreflight = {
  runtime: {
    kind: 'docker-compatible',
    version: '25.0.0',
  },
  ports: [
    { port: 8000, available: true, service: 'Supabase API gateway' },
    { port: 5432, available: true, service: 'Postgres' },
    { port: 54323, available: true, service: 'Supabase Studio' },
  ],
};

describe('PM System Installer planning', () => {
  it('plans a full install when runtime and ports are available', () => {
    expect(planPmSystemInstall(readyPreflight)).toEqual({
      status: 'ready_to_install',
      actions: [
        'generate-local-secrets',
        'write-ops-env',
        'pull-supabase-images',
        'start-supabase-stack',
        'run-pm-migrations',
        'create-owner-account',
        'write-backend-profile',
        'run-health-checks',
      ],
      blocked: false,
      messages: ['Host preflight passed. PM backend install can proceed with explicit owner approval.'],
    });
  });

  it('blocks with guided runtime install when Docker-compatible runtime is missing', () => {
    expect(
      planPmSystemInstall({
        ...readyPreflight,
        runtime: null,
      }),
    ).toMatchObject({
      status: 'runtime_required',
      actions: ['guide-runtime-install'],
      blocked: true,
    });
  });

  it('blocks install when required ports are occupied', () => {
    const plan = planPmSystemInstall({
      ...readyPreflight,
      ports: [
        { port: 8000, available: false, service: 'Supabase API gateway' },
        { port: 5432, available: true, service: 'Postgres' },
      ],
    });

    expect(plan.status).toBe('port_conflict');
    expect(plan.blocked).toBe(true);
    expect(plan.actions).toEqual(['resolve-port-conflicts']);
    expect(plan.messages[0]).toContain('Port 8000');
  });

  it('does not reinstall over an existing backend stack', () => {
    expect(
      planPmSystemInstall({
        ...readyPreflight,
        existingStack: {
          installed: true,
          schemaVersion: 1,
          volumesDetected: true,
        },
      }),
    ).toMatchObject({
      status: 'existing_stack',
      actions: ['inspect-existing-stack', 'run-health-checks'],
      blocked: false,
    });
  });

  it('supports dry-run planning without host mutation', () => {
    const plan = planPmSystemInstall({
      ...readyPreflight,
      dryRun: true,
    });

    expect(plan.status).toBe('dry_run');
    expect(plan.blocked).toBe(false);
    expect(plan.messages.join(' ')).toContain('No Docker');
  });

  it('strips service-role fields from renderer-safe backend profiles', () => {
    expect(
      toRendererSafeBackendProfile({
        id: 'local-pm',
        label: 'Local PM Backend',
        mode: 'local-self-hosted',
        supabaseUrl: 'http://127.0.0.1:8000',
        supabaseAnonKey: 'anon-test-key',
        serviceRoleKey: 'service-role-secret',
        databasePassword: 'db-password',
      }),
    ).toEqual({
      id: 'local-pm',
      label: 'Local PM Backend',
      mode: 'local-self-hosted',
      supabaseUrl: 'http://127.0.0.1:8000',
      supabaseAnonKey: 'anon-test-key',
    });
  });

  it('defines the required system maintenance commands', () => {
    expect(PM_SYSTEM_COMMANDS).toEqual([
      'install',
      'start',
      'stop',
      'status',
      'doctor',
      'backup',
      'restore',
      'upgrade',
      'logs',
    ]);
  });

  it('requires backup and confirmation before upgrade', () => {
    expect(getMaintenancePolicy('upgrade')).toEqual({
      command: 'upgrade',
      requiresBackup: true,
      requiresConfirmation: true,
      mutatesData: true,
    });
  });

  it('requires confirmation before restore', () => {
    expect(getMaintenancePolicy('restore')).toMatchObject({
      requiresConfirmation: true,
      mutatesData: true,
    });
  });
});
