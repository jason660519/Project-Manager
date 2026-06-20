import type { BackendProfile } from '../types';
import { resolveSupabasePublicConfig } from './publicConfig';

export function buildLocalDockerBackendProfileFromEnv(
  env: Record<string, string | undefined> = process.env,
): BackendProfile | null {
  const config = resolveSupabasePublicConfig(env);
  if (!config) return null;

  return {
    id: env.PM_BACKEND_PROFILE_ID?.trim() || 'local-pm',
    label: 'Local Docker Supabase',
    mode: 'local-docker-supabase',
    url: config.url,
    anonKeyRef: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  };
}
