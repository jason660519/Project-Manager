#!/usr/bin/env node
/**
 * Optional Postgres RLS integration runner.
 *
 * Default: print instructions and exit 0 (safe for verify:baseline / CI without Docker).
 * With PM_SUPABASE_RLS_INTEGRATION=1 or --integration: apply migrations + fixture + SQL tests.
 *
 * Env:
 *   PM_BACKEND_DATABASE_URL  postgres://postgres:password@localhost:5432/postgres
 *   PM_SUPABASE_RLS_INTEGRATION=1
 *
 * Flags:
 *   --integration  run live SQL tests
 *   --docker       use ephemeral postgres:17-alpine when psql is missing locally
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'infra/supabase/migrations');
const TESTS_DIR = join(ROOT, 'infra/supabase/tests');

const integrationRequested =
  process.env.PM_SUPABASE_RLS_INTEGRATION === '1' || process.argv.includes('--integration');
const dockerRequested = process.argv.includes('--docker') || process.env.PM_SUPABASE_RLS_DOCKER === '1';

function commandOk(command, args = []) {
  return spawnSync(command, args, { encoding: 'utf8' }).status === 0;
}

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function listRunFiles() {
  return [
    join(TESTS_DIR, 'helpers/auth_uid_stub.sql'),
    ...listMigrationFiles().map((name) => join(MIGRATIONS_DIR, name)),
    join(TESTS_DIR, 'helpers/post_migration_grants.sql'),
    join(TESTS_DIR, 'fixtures/rls_seed.sql'),
    join(TESTS_DIR, 'rls_membership.test.sql'),
    join(TESTS_DIR, 'agent_runs_runner_device_guard.test.sql'),
    join(TESTS_DIR, 'report_metadata_workspace_guard.test.sql'),
    join(TESTS_DIR, 'rls_workspace_scope.test.sql'),
    join(TESTS_DIR, 'membership_role_update.test.sql'),
    join(TESTS_DIR, 'membership_add.test.sql'),
    join(TESTS_DIR, 'membership_remove.test.sql'),
    join(TESTS_DIR, 'portal_features_read.test.sql'),
    join(TESTS_DIR, 'workspace_create.test.sql'),
    join(TESTS_DIR, 'workspace_invite.test.sql'),
  ];
}

function runPsql(databaseUrl, filePath) {
  const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`psql failed for ${filePath}: ${detail || `exit ${result.status}`}`);
  }

  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function sleepMs(ms) {
  spawnSync('sleep', [String(ms / 1000)]);
}

function runDockerEphemeral(files) {
  if (!commandOk('docker', ['--version'])) {
    throw new Error('Docker is required when psql is unavailable. Install Docker or psql.');
  }

  const containerName = `pm-rls-test-${process.pid}`;
  const hostPort = 55432 + (process.pid % 1000);

  const start = spawnSync(
    'docker',
    [
      'run',
      '-d',
      '--name',
      containerName,
      '-e',
      'POSTGRES_PASSWORD=postgres',
      '-e',
      'POSTGRES_DB=postgres',
      '-p',
      `${hostPort}:5432`,
      'postgres:17-alpine',
    ],
    { encoding: 'utf8' },
  );

  if (start.status !== 0) {
    throw new Error(
      `Failed to start ephemeral Postgres container: ${[start.stdout, start.stderr].filter(Boolean).join('\n').trim()}`,
    );
  }

  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const probe = spawnSync(
        'docker',
        ['exec', containerName, 'pg_isready', '-U', 'postgres', '-d', 'postgres'],
        { encoding: 'utf8' },
      );
      if (probe.status === 0) {
        ready = true;
        break;
      }
      sleepMs(500);
    }

    if (!ready) {
      throw new Error('Ephemeral Postgres container did not become ready in time.');
    }

    console.log(`→ docker://postgres:17-alpine on 127.0.0.1:${hostPort}`);

    for (const file of files) {
      if (!existsSync(file)) {
        throw new Error(`Missing RLS test file: ${file}`);
      }
      console.log(`→ ${file.replace(`${ROOT}/`, '')}`);
      const sql = readFileSync(file, 'utf8');
      const result = spawnSync(
        'docker',
        [
          'exec',
          '-i',
          containerName,
          'psql',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-v',
          'ON_ERROR_STOP=1',
          '-f',
          '-',
        ],
        {
          encoding: 'utf8',
          input: sql,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );

      if (result.status !== 0) {
        const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`docker psql failed for ${file}: ${detail || `exit ${result.status}`}`);
      }

      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      if (output) {
        console.log(output);
      }
    }
  } finally {
    spawnSync('docker', ['rm', '-f', containerName], { encoding: 'utf8' });
  }
}

function main() {
  if (!integrationRequested) {
    console.log('Supabase RLS integration tests are opt-in.');
    console.log('Run with: PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls');
    console.log('Docker fallback: PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker');
    console.log('Requires: psql + PM_BACKEND_DATABASE_URL, or Docker for ephemeral Postgres.');
    return;
  }

  const files = listRunFiles();

  const hasLocalPsql = commandOk('psql', ['--version']);
  const useDocker =
    dockerRequested || !hasLocalPsql || !process.env.PM_BACKEND_DATABASE_URL;

  if (useDocker) {
    runDockerEphemeral(files);
    console.log('Supabase RLS integration tests: PASS (docker ephemeral Postgres)');
    return;
  }

  const databaseUrl =
    process.env.PM_BACKEND_DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

  for (const file of files) {
    if (!existsSync(file)) {
      throw new Error(`Missing RLS test file: ${file}`);
    }
    console.log(`→ ${file.replace(`${ROOT}/`, '')}`);
    const output = runPsql(databaseUrl, file);
    if (output) {
      console.log(output);
    }
  }

  console.log('Supabase RLS integration tests: PASS');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
