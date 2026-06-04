import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  auditScaffoldContent,
  buildDoctorReport,
  buildPmSystemCliResponse,
  createPmBackendProfilePair,
  DEFAULT_PM_BACKEND_PORTS,
  getBlockingDoctorChecks,
  getMaintenancePolicy,
  getRecoveryActions,
  getRequiredPortChecks,
  planBackup,
  planPmSystemInstall,
  planRestore,
  planUpgrade,
  PM_SYSTEM_COMMANDS,
  PM_SUPABASE_SCAFFOLD_FILES,
  renderOpsEnv,
  renderRedactedOpsEnv,
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

function readScaffold(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

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

  it('requires only the ports the compose scaffold actually provisions', () => {
    // Storage (5000) and Realtime (4000) are reserved for a future slice and are
    // NOT started by docker-compose.pm-system.yml, so they must not be claimed
    // as required/checked or doctor/install would report false success.
    expect(getRequiredPortChecks()).toEqual([
      { port: 8000, available: true, service: 'Supabase API gateway' },
      { port: 5432, available: true, service: 'Postgres' },
      { port: 54323, available: true, service: 'Supabase Studio' },
    ]);
  });

  it('creates paired renderer-safe and ops-only backend profiles', () => {
    const pair = createPmBackendProfilePair({
      id: 'local-pm',
      label: 'Local PM Backend',
      mode: 'local-self-hosted',
      host: 'http://127.0.0.1',
      ports: DEFAULT_PM_BACKEND_PORTS,
      composeProjectName: 'pm-system',
      schemaVersion: 1,
      secrets: {
        supabaseAnonKey: 'anon-test-key',
        serviceRoleKey: 'service-role-secret',
        jwtSecret: 'jwt-secret',
        databasePassword: 'db-password',
      },
    });

    expect(pair.renderer).toEqual({
      id: 'local-pm',
      label: 'Local PM Backend',
      mode: 'local-self-hosted',
      supabaseUrl: 'http://127.0.0.1:8000',
      supabaseAnonKey: 'anon-test-key',
    });
    expect(pair.renderer).not.toHaveProperty('serviceRoleKey');
    expect(pair.renderer).not.toHaveProperty('databasePassword');
    expect(pair.ops).toMatchObject({
      serviceRoleKey: 'service-role-secret',
      jwtSecret: 'jwt-secret',
      databasePassword: 'db-password',
      composeProjectName: 'pm-system',
      schemaVersion: 1,
    });
  });

  it('rejects a scheme-less host instead of writing a broken supabaseUrl', () => {
    expect(() =>
      createPmBackendProfilePair({
        id: 'local-pm',
        label: 'Local PM Backend',
        mode: 'local-self-hosted',
        host: 'localhost',
        ports: DEFAULT_PM_BACKEND_PORTS,
        composeProjectName: 'pm-system',
        schemaVersion: 1,
        secrets: {
          supabaseAnonKey: 'anon-test-key',
          serviceRoleKey: 'service-role-secret',
          jwtSecret: 'jwt-secret',
          databasePassword: 'db-password',
        },
      }),
    ).toThrow(/must include an http\(s\):\/\/ scheme/);
  });

  it('renders ops env and a redacted support-safe variant', () => {
    const { ops } = createPmBackendProfilePair({
      id: 'vm-pm',
      label: 'VM PM Backend',
      mode: 'vm-self-hosted',
      host: 'https://pm.example.test',
      ports: {
        api: 443,
        postgres: 5432,
        studio: 54323,
        storage: 5000,
        realtime: 4000,
      },
      composeProjectName: 'pm-vm',
      schemaVersion: 3,
      secrets: {
        supabaseAnonKey: 'anon-vm-key',
        serviceRoleKey: 'service-role-vm-secret',
        jwtSecret: 'jwt-vm-secret',
        databasePassword: 'db-vm-password',
      },
    });

    expect(renderOpsEnv(ops)).toContain('PM_BACKEND_SUPABASE_SERVICE_ROLE_KEY=service-role-vm-secret');
    expect(renderOpsEnv(ops)).toContain('PM_BACKEND_API_PORT=443');

    const redacted = renderRedactedOpsEnv(ops);
    expect(redacted).toContain('PM_BACKEND_SUPABASE_SERVICE_ROLE_KEY=[redacted]');
    expect(redacted).toContain('PM_BACKEND_JWT_SECRET=[redacted]');
    expect(redacted).toContain('PM_BACKEND_DATABASE_PASSWORD=[redacted]');
    expect(redacted).not.toContain('service-role-vm-secret');
    expect(redacted).not.toContain('jwt-vm-secret');
    expect(redacted).not.toContain('db-vm-password');
  });

  it('marks doctor report healthy only when every check passes', () => {
    expect(
      buildDoctorReport([
        { id: 'runtime', status: 'pass', message: 'Runtime reachable.' },
        { id: 'auth', status: 'pass', message: 'Auth reachable.' },
        { id: 'postgres', status: 'pass', message: 'Postgres reachable.' },
      ]),
    ).toEqual({
      status: 'healthy',
      checks: [
        { id: 'runtime', status: 'pass', message: 'Runtime reachable.' },
        { id: 'auth', status: 'pass', message: 'Auth reachable.' },
        { id: 'postgres', status: 'pass', message: 'Postgres reachable.' },
      ],
      summary: 'PM backend doctor checks passed.',
    });
  });

  it('marks doctor report degraded when any check warns', () => {
    const report = buildDoctorReport([
      { id: 'runtime', status: 'pass', message: 'Runtime reachable.' },
      {
        id: 'realtime',
        status: 'warn',
        message: 'Realtime is not configured.',
        recovery: 'Enable Realtime only when live run status requires it.',
      },
    ]);

    expect(report.status).toBe('degraded');
    expect(getRecoveryActions(report)).toEqual([
      'Enable Realtime only when live run status requires it.',
    ]);
  });

  it('marks doctor report failed when any check fails and lists blocking checks', () => {
    const report = buildDoctorReport([
      { id: 'runtime', status: 'pass', message: 'Runtime reachable.' },
      {
        id: 'migrations',
        status: 'fail',
        message: 'Schema version is behind.',
        recovery: 'Run PM backend migrations before allowing writes.',
      },
    ]);

    expect(report.status).toBe('failed');
    expect(report.summary).toContain('blocking failures');
    expect(getBlockingDoctorChecks(report)).toEqual([
      {
        id: 'migrations',
        status: 'fail',
        message: 'Schema version is behind.',
        recovery: 'Run PM backend migrations before allowing writes.',
      },
    ]);
  });

  it('plans backup with manifest verification and optional storage export', () => {
    expect(
      planBackup({
        destination: '/backups/pm-system',
        includeStorage: true,
        retentionDays: 14,
      }),
    ).toEqual({
      destination: '/backups/pm-system',
      steps: [
        'export-postgres',
        'export-storage-artifacts',
        'write-backup-manifest',
        'verify-backup-manifest',
      ],
      retentionDays: 14,
      safeToRun: true,
    });
  });

  it('blocks backup plans with invalid destination or retention', () => {
    expect(
      planBackup({
        destination: '',
        includeStorage: false,
        retentionDays: 0,
      }),
    ).toMatchObject({
      safeToRun: false,
    });
  });

  it('blocks restore without a known backup source and confirmation phrase', () => {
    expect(planRestore({ backupSource: null })).toMatchObject({
      blocked: true,
      message: 'Restore requires a known backup source.',
    });

    expect(
      planRestore({
        backupSource: '/backups/pm-system/2026-06-04',
        confirmationPhrase: 'restore',
      }),
    ).toMatchObject({
      blocked: true,
      message: 'Restore requires explicit confirmation phrase: RESTORE PM BACKEND.',
    });
  });

  it('allows restore only after explicit destructive confirmation', () => {
    expect(
      planRestore({
        backupSource: '/backups/pm-system/2026-06-04',
        confirmationPhrase: 'RESTORE PM BACKEND',
      }),
    ).toEqual({
      blocked: false,
      steps: [
        'stop-supabase-stack',
        'restore-postgres',
        'restore-storage-artifacts',
        'run-health-checks',
        'write-restore-audit-event',
      ],
      message: 'Restore can proceed with explicit confirmation.',
    });
  });

  it('blocks upgrade until backup is verified and doctor is not failed', () => {
    expect(
      planUpgrade({
        targetVersion: '2026.06.04',
        backupVerified: false,
        doctorStatus: 'healthy',
      }),
    ).toEqual({
      blocked: true,
      steps: ['run-backup-first'],
      message: 'Upgrade requires a verified backup before pulling images or running migrations.',
    });

    expect(
      planUpgrade({
        targetVersion: '2026.06.04',
        backupVerified: true,
        doctorStatus: 'failed',
      }),
    ).toEqual({
      blocked: true,
      steps: ['resolve-doctor-failures'],
      message: 'Upgrade is blocked while backend doctor reports failures.',
    });
  });

  it('plans upgrade after backup verification and non-failed doctor state', () => {
    expect(
      planUpgrade({
        targetVersion: '2026.06.04',
        backupVerified: true,
        doctorStatus: 'degraded',
      }),
    ).toEqual({
      blocked: false,
      steps: [
        'pull-target-images',
        'stop-supabase-stack',
        'start-supabase-stack',
        'run-pm-migrations',
        'run-health-checks',
        'write-upgrade-audit-event',
      ],
      message: 'Upgrade to 2026.06.04 can proceed.',
    });
  });

  it('declares the required self-hosted scaffold files', () => {
    expect(PM_SUPABASE_SCAFFOLD_FILES.map((file) => file.path)).toEqual([
      'infra/supabase/docker-compose.pm-system.yml',
      'infra/supabase/pm-system.env.example',
      'infra/supabase/migrations/0001_pm_core.sql',
      'infra/supabase/seed.sql',
      'infra/supabase/templates/kong.yml',
    ]);
  });

  it('keeps scaffold files free of real secret-like values', () => {
    const files = PM_SUPABASE_SCAFFOLD_FILES.map((file) => ({
      path: file.path,
      content: readScaffold(file.path),
    }));

    expect(auditScaffoldContent(files)).toEqual({
      safe: true,
      findings: [],
    });
  });

  it('includes core PM cloud tables and RLS in the initial migration scaffold', () => {
    const migration = readScaffold('infra/supabase/migrations/0001_pm_core.sql');

    expect(migration).toContain('create table if not exists public.workspaces');
    expect(migration).toContain('create extension if not exists pgcrypto');
    expect(migration).toContain('create table if not exists public.workspace_memberships');
    expect(migration).toContain('create table if not exists public.projects');
    expect(migration).toContain('create table if not exists public.agent_runs');
    expect(migration).toContain('alter table public.workspaces enable row level security');
    expect(migration).toContain('alter table public.workspace_memberships enable row level security');
  });

  it('defines membership-scoped RLS policies so RLS is never enabled with zero policies', () => {
    const migration = readScaffold('infra/supabase/migrations/0001_pm_core.sql');

    // Guards against the silent "RLS on + no policies = deny-all" trap.
    expect(migration).toContain('create policy pm_memberships_read_own');
    expect(migration).toContain('create policy pm_workspaces_read_member');
    expect(migration).toContain('create policy pm_projects_read_member');
    expect(migration).toContain('create policy pm_agent_runs_read_member');
    // RLS is only enabled when auth is present; otherwise a loud notice, not a
    // silent deny-all.
    expect(migration).toContain("to_regprocedure('auth.uid()')");
  });

  it('flags a real secret even when the same file also contains an allowed placeholder', () => {
    // Regression: a single allowed placeholder must not exempt the whole file
    // from secret scanning.
    const audit = auditScaffoldContent([
      {
        path: 'infra/supabase/leaky.env',
        content:
          'PM_BACKEND_JWT_SECRET=change-me-jwt-secret\nLEAKED_OPENAI_KEY=sk-ABCDEFG1234567890\n',
      },
    ]);

    expect(audit.safe).toBe(false);
    expect(audit.findings.join('\n')).toContain('infra/supabase/leaky.env:2');
  });

  it('does not report doctor ports as passing when no port data was checked', () => {
    const response = buildPmSystemCliResponse({
      command: 'doctor',
      preflight: {
        runtime: { kind: 'docker-compatible', version: '25.0.0' },
        ports: [],
      },
    });

    // Runtime is healthy, but ports were not verified — doctor must not claim a
    // clean bill of health.
    expect(response.title).not.toBe('PM System doctor: healthy');
    expect(response.lines.join('\n')).toContain('ports were not verified');
  });

  it('builds a dry-run install CLI response without host mutation', () => {
    expect(
      buildPmSystemCliResponse({
        command: 'install',
        dryRun: true,
        preflight: readyPreflight,
      }),
    ).toMatchObject({
      command: 'install',
      blocked: false,
      title: 'PM System install plan: dry_run',
    });
  });

  it('builds a doctor CLI response that blocks when runtime is missing', () => {
    const response = buildPmSystemCliResponse({
      command: 'doctor',
      preflight: {
        runtime: null,
        ports: getRequiredPortChecks(),
      },
    });

    expect(response.blocked).toBe(true);
    expect(response.title).toBe('PM System doctor: failed');
    expect(response.lines.join('\n')).toContain('No Docker-compatible runtime detected.');
  });

  it('builds blocked backup, restore, and upgrade CLI responses for unsafe input', () => {
    expect(
      buildPmSystemCliResponse({
        command: 'backup',
        backup: {
          destination: '',
          includeStorage: true,
          retentionDays: 0,
        },
      }).blocked,
    ).toBe(true);

    expect(
      buildPmSystemCliResponse({
        command: 'restore',
        restore: {
          backupSource: '/backups/pm',
          confirmationPhrase: 'wrong',
        },
      }).blocked,
    ).toBe(true);

    expect(
      buildPmSystemCliResponse({
        command: 'upgrade',
        upgrade: {
          targetVersion: '2026.06.04',
          backupVerified: false,
          doctorStatus: 'healthy',
        },
      }).lines.join('\n'),
    ).toContain('verified backup');
  });
});
