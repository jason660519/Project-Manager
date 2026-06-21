import { createBrowserClient } from '@supabase/ssr';
import {
  isSupabasePublicConfigResolved,
  resolveSupabasePublicConfig,
  type SupabasePublicConfig,
} from '../supabase/publicConfig';

export type { SupabasePublicConfig };

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  return resolveSupabasePublicConfig();
}

export function isSupabaseConfigured(): boolean {
  return isSupabasePublicConfigResolved();
}

export function getSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  browserClient ??= createBrowserClient(config.url, config.anonKey);
  return browserClient;
}
