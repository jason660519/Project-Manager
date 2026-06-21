import { describe, expect, it, vi } from 'vitest';
import {
  normalizeSupabaseAuthUser,
  readSupabaseAuthUser,
  signInWithEmailPassword,
  signOutSupabaseAuth,
  type SupabaseAuthClient,
} from '../lib/auth/supabaseAuthSession';

vi.mock('../lib/auth/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowserClient: vi.fn(),
}));

function authClientWithUser(
  user: { id: string; email?: string | null } | null,
  error: { message?: string } | null = null,
): SupabaseAuthClient {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(async () => ({
        data: { user: null },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  } as unknown as SupabaseAuthClient;
}

describe('Supabase auth session helpers', () => {
  it('normalizes valid auth users and drops malformed entries', () => {
    expect(
      normalizeSupabaseAuthUser({
        id: 'user-1',
        email: 'dev@example.test',
      }),
    ).toEqual({
      id: 'user-1',
      email: 'dev@example.test',
    });
    expect(normalizeSupabaseAuthUser({ email: 'missing-id@example.test' })).toBeNull();
  });

  it('reads the current Supabase auth user through the client abstraction', async () => {
    const client = authClientWithUser({
      id: 'user-1',
      email: 'dev@example.test',
    });

    await expect(readSupabaseAuthUser(client)).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'dev@example.test',
      },
      error: null,
    });
  });

  it('returns a visible error when Supabase auth lookup fails', async () => {
    const client = authClientWithUser(null, { message: 'JWT expired' });

    await expect(readSupabaseAuthUser(client)).resolves.toEqual({
      user: null,
      error: 'JWT expired',
    });
  });

  it('signs out through the Supabase client abstraction', async () => {
    const client = authClientWithUser(null);

    await expect(signOutSupabaseAuth(client)).resolves.toEqual({
      error: null,
    });

    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('signs in with email and password through the Supabase client abstraction', async () => {
    const client = {
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: {
            user: {
              id: 'user-1',
              email: 'dev@example.test',
            },
          },
          error: null,
        })),
      },
    } as unknown as SupabaseAuthClient;

    await expect(signInWithEmailPassword('dev@example.test', 'secret', client)).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'dev@example.test',
      },
      error: null,
    });

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'dev@example.test',
      password: 'secret',
    });
  });

  it('returns a visible error when email sign-in is rejected', async () => {
    const client = {
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: { user: null },
          error: { message: 'Invalid login credentials' },
        })),
      },
    } as unknown as SupabaseAuthClient;

    await expect(signInWithEmailPassword('dev@example.test', 'wrong', client)).resolves.toEqual({
      user: null,
      error: 'Invalid login credentials',
    });
  });

  it('requires email and password before calling Supabase', async () => {
    const client = {
      auth: {
        signInWithPassword: vi.fn(),
      },
    } as unknown as SupabaseAuthClient;

    await expect(signInWithEmailPassword('  ', '', client)).resolves.toEqual({
      user: null,
      error: 'Email and password are required.',
    });

    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
