export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/** Kong API port used by `docker/supabase` when 54321 is already taken. */
export const LOCAL_DOCKER_SUPABASE_DEFAULT_URL = 'http://localhost:54329';

const ENV_URL_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'PM_BACKEND_SUPABASE_URL'] as const;
const ENV_ANON_KEYS = ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'PM_BACKEND_SUPABASE_ANON_KEY'] as const;

function trim(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function readFirst(env: Record<string, string | undefined>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = trim(env[key]);
    if (value) return value;
  }
  return undefined;
}

export function resolveSupabasePublicConfig(
  env: Record<string, string | undefined> = process.env,
): SupabasePublicConfig | null {
  const url = readFirst(env, ENV_URL_KEYS);
  const anonKey = readFirst(env, ENV_ANON_KEYS);
  if (!url || !anonKey) return null;
  return { url: normalizeSupabaseUrl(url), anonKey };
}

export function isSupabasePublicConfigResolved(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return resolveSupabasePublicConfig(env) !== null;
}
