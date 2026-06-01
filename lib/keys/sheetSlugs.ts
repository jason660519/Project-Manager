/**
 * URL slugs for the three /keys sheets. Kept in a server-safe module (no
 * `'use client'`) so that server components such as `app/keys/[sheet]/page.tsx`
 * can spread the list inside `generateStaticParams`. Mirrors the structure of
 * `lib/integrations/types.ts` for the integrations-hub routes.
 */

export type KeysTab = 'api_key_validation' | 'llm_arena' | 'vlm_arena' | 'coding_agent_candidate';

export const KEYS_SHEET_SLUGS = [
  'api-key-validation',
  'llm-arena',
  'vlm-arena',
  'coding-agent-candidate',
] as const;
export type KeysSheetSlug = (typeof KEYS_SHEET_SLUGS)[number];
export const DEFAULT_KEYS_SHEET_SLUG: KeysSheetSlug = 'api-key-validation';

const SLUG_TO_TAB: Record<KeysSheetSlug, KeysTab> = {
  'api-key-validation': 'api_key_validation',
  'llm-arena': 'llm_arena',
  'vlm-arena': 'vlm_arena',
  'coding-agent-candidate': 'coding_agent_candidate',
};

const TAB_TO_SLUG: Record<KeysTab, KeysSheetSlug> = {
  api_key_validation: 'api-key-validation',
  llm_arena: 'llm-arena',
  vlm_arena: 'vlm-arena',
  coding_agent_candidate: 'coding-agent-candidate',
};

export function isKeysSheetSlug(value: string | undefined | null): value is KeysSheetSlug {
  return typeof value === 'string' && (KEYS_SHEET_SLUGS as readonly string[]).includes(value);
}

export function keysSheetSlugToTab(slug: KeysSheetSlug): KeysTab {
  return SLUG_TO_TAB[slug];
}

export function keysTabToSheetSlug(tab: KeysTab): KeysSheetSlug {
  return TAB_TO_SLUG[tab];
}
