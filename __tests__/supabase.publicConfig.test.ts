import { describe, expect, it } from 'vitest';
import {
  LOCAL_DOCKER_SUPABASE_DEFAULT_URL,
  resolveSupabasePublicConfig,
} from '../lib/supabase/publicConfig';
import { buildLocalDockerBackendProfileFromEnv } from '../lib/supabase/localBackendProfile';

describe('Supabase public config', () => {
  it('prefers NEXT_PUBLIC_* over PM_BACKEND_*', () => {
    expect(
      resolveSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54329',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-public',
        PM_BACKEND_SUPABASE_URL: 'http://ignored:9999',
        PM_BACKEND_SUPABASE_ANON_KEY: 'anon-ops',
      }),
    ).toEqual({
      url: 'http://localhost:54329',
      anonKey: 'anon-public',
    });
  });

  it('falls back to PM_BACKEND_* when NEXT_PUBLIC_* are absent', () => {
    expect(
      resolveSupabasePublicConfig({
        PM_BACKEND_SUPABASE_URL: 'http://localhost:54329/',
        PM_BACKEND_SUPABASE_ANON_KEY: 'anon-ops',
      }),
    ).toEqual({
      url: 'http://localhost:54329',
      anonKey: 'anon-ops',
    });
  });

  it('returns null when url or anon key is missing', () => {
    expect(resolveSupabasePublicConfig({ NEXT_PUBLIC_SUPABASE_URL: LOCAL_DOCKER_SUPABASE_DEFAULT_URL })).toBeNull();
  });

  it('builds a local-docker backend profile from env', () => {
    expect(
      buildLocalDockerBackendProfileFromEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54329',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-public',
        PM_BACKEND_PROFILE_ID: 'local-pm',
      }),
    ).toEqual({
      id: 'local-pm',
      label: 'Local Docker Supabase',
      mode: 'local-docker-supabase',
      url: 'http://localhost:54329',
      anonKeyRef: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    });
  });
});
