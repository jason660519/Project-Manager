import { describe, expect, it } from 'vitest';
import {
  normalizeBackendProfile,
  redactBackendProfileSecrets,
  toRendererSafeBackendProfile,
} from '../lib/backend-profiles';

describe('backend profile normalization', () => {
  it('normalizes local-files without requiring Supabase connection fields', () => {
    expect(
      normalizeBackendProfile({
        mode: 'local-files',
        url: 'https://should-not-be-required.example.test',
        serviceRoleKey: 'service-secret',
        jwtSecret: 'jwt-secret',
        databasePassword: 'db-password',
      }),
    ).toEqual({
      id: 'local-files',
      label: 'Local files',
      mode: 'local-files',
      enabled: false,
    });
  });

  it.each([
    ['local-docker-supabase', 'Local Docker Supabase'],
    ['self-hosted-supabase', 'Self-hosted Supabase'],
    ['supabase-cloud', 'Supabase Cloud'],
  ] as const)('normalizes %s to a renderer-safe connector shape', (mode, label) => {
    expect(
      normalizeBackendProfile({
        id: `${mode}-custom`,
        mode,
        url: 'https://pm.example.test/',
        anonKeyRef: 'keychain:anon',
        serviceRoleKey: 'service-secret',
        jwtSecret: 'jwt-secret',
        databasePassword: 'db-password',
      }),
    ).toEqual({
      id: `${mode}-custom`,
      label,
      mode,
      url: 'https://pm.example.test',
      anonKeyRef: 'keychain:anon',
    });
  });

  it('rejects Supabase-backed profiles without URL and anon key reference', () => {
    expect(() =>
      normalizeBackendProfile({
        mode: 'supabase-cloud',
        url: '',
        anonKeyRef: '',
      }),
    ).toThrow(/requires url and anonKeyRef/);
  });

  it('never exposes service-role key, JWT secret, or database password to renderer data', () => {
    const renderer = toRendererSafeBackendProfile({
      id: 'prod',
      label: 'Production',
      mode: 'supabase-cloud',
      url: 'https://pm.example.test',
      anonKeyRef: 'keychain:anon',
      anonKey: 'public-anon-key',
      serviceRoleKey: 'service-secret',
      jwtSecret: 'jwt-secret',
      databasePassword: 'db-password',
    });

    expect(renderer).toEqual({
      id: 'prod',
      label: 'Production',
      mode: 'supabase-cloud',
      url: 'https://pm.example.test',
      anonKeyRef: 'keychain:anon',
      anonKey: 'public-anon-key',
    });
    expect(JSON.stringify(renderer)).not.toContain('service-secret');
    expect(JSON.stringify(renderer)).not.toContain('jwt-secret');
    expect(JSON.stringify(renderer)).not.toContain('db-password');
  });

  it('redacts secret values from nested diagnostic output', () => {
    expect(
      redactBackendProfileSecrets({
        profile: {
          serviceRoleKey: 'service-secret',
          jwtSecret: 'jwt-secret',
          databasePassword: 'db-password',
        },
        log: 'service-secret jwt-secret db-password public-value',
      }),
    ).toEqual({
      profile: {
        serviceRoleKey: '[redacted]',
        jwtSecret: '[redacted]',
        databasePassword: '[redacted]',
      },
      log: '[redacted] [redacted] [redacted] public-value',
    });
  });
});
