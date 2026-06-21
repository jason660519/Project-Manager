import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const integrationEnabled = process.env.PM_SUPABASE_RLS_INTEGRATION === '1';

describe.skipIf(!integrationEnabled)('Supabase RLS Postgres integration', () => {
  it('passes membership allow/deny SQL fixture against a live Postgres database', () => {
    const result = spawnSync(
      'node',
      ['scripts/test-supabase-rls.mjs', '--integration', '--docker'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PM_SUPABASE_RLS_INTEGRATION: '1',
          PM_SUPABASE_RLS_DOCKER: '1',
        },
      },
    );

    expect(result.status, [result.stdout, result.stderr].filter(Boolean).join('\n')).toBe(0);
    expect(result.stdout).toContain('Supabase RLS integration tests: PASS');
  });
});

describe('Supabase RLS integration gate', () => {
  it('skips live Postgres checks unless PM_SUPABASE_RLS_INTEGRATION=1', () => {
    if (integrationEnabled) {
      expect(integrationEnabled).toBe(true);
      return;
    }

    const result = spawnSync('node', ['scripts/test-supabase-rls.mjs'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Supabase RLS integration tests are opt-in');
  });
});
