import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabaseClient';

export interface SupabaseAuthUser {
  id: string;
  email: string | null;
}

export interface SupabaseAuthSessionResult {
  user: SupabaseAuthUser | null;
  error: string | null;
}

export type SupabaseAuthClient = Pick<SupabaseClient, 'auth'>;

export function normalizeSupabaseAuthUser(
  user: { id?: unknown; email?: unknown } | null | undefined,
): SupabaseAuthUser | null {
  if (typeof user?.id !== 'string') {
    return null;
  }

  return {
    id: user.id,
    email: typeof user.email === 'string' ? user.email : null,
  };
}

export async function readSupabaseAuthUser(
  client: SupabaseAuthClient = getSupabaseBrowserClient() as unknown as SupabaseAuthClient,
): Promise<SupabaseAuthSessionResult> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: null };
  }

  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      return {
        user: null,
        error: error.message || 'Supabase auth lookup failed.',
      };
    }

    return {
      user: normalizeSupabaseAuthUser(data.user),
      error: null,
    };
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error.message : 'Supabase auth lookup failed.',
    };
  }
}

export async function signOutSupabaseAuth(
  client: SupabaseAuthClient = getSupabaseBrowserClient() as unknown as SupabaseAuthClient,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: null };
  }

  try {
    const { error } = await client.auth.signOut();
    return {
      error: error?.message ?? null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Supabase sign-out failed.',
    };
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
  client: SupabaseAuthClient = getSupabaseBrowserClient() as unknown as SupabaseAuthClient,
): Promise<SupabaseAuthSessionResult> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: null };
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    return {
      user: null,
      error: 'Email and password are required.',
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      return {
        user: null,
        error: error.message || 'Supabase email sign-in failed.',
      };
    }

    return {
      user: normalizeSupabaseAuthUser(data.user),
      error: null,
    };
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error.message : 'Supabase email sign-in failed.',
    };
  }
}

export function subscribeSupabaseAuthChanges(
  onChange: () => void,
  client: SupabaseAuthClient = getSupabaseBrowserClient() as unknown as SupabaseAuthClient,
): () => void {
  const { data } = client.auth.onAuthStateChange(() => {
    onChange();
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
